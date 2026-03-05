import { NextResponse } from 'next/server';

import { getAnalyticsHeaders, trackServerApiRequest } from '@/lib/analytics/server';

export const runtime = 'nodejs';

let pdfRuntimeReadyPromise: Promise<void> | null = null;
let pdfWorkerReadyPromise: Promise<void> | null = null;

async function ensurePdfRuntimePolyfills() {
  if (pdfRuntimeReadyPromise) {
    return pdfRuntimeReadyPromise;
  }

  pdfRuntimeReadyPromise = (async () => {
    const globals = globalThis as {
      DOMMatrix?: unknown;
      ImageData?: unknown;
      Path2D?: unknown;
      [key: string]: unknown;
    };

    if (globals.DOMMatrix && globals.ImageData && globals.Path2D) {
      return;
    }

    try {
      const canvas = await import('@napi-rs/canvas');

      if (!globals.DOMMatrix && canvas.DOMMatrix) {
        globals.DOMMatrix = canvas.DOMMatrix;
      }
      if (!globals.ImageData && canvas.ImageData) {
        globals.ImageData = canvas.ImageData;
      }
      if (!globals.Path2D && canvas.Path2D) {
        globals.Path2D = canvas.Path2D;
      }
    } catch (error) {
      console.warn('[pdf-extract] Failed to load @napi-rs/canvas polyfills:', error);
    }
  })();

  return pdfRuntimeReadyPromise;
}

async function extractTextWithPdfJs(buffer: ArrayBuffer) {
  await ensurePdfRuntimePolyfills();
  if (!pdfWorkerReadyPromise) {
    pdfWorkerReadyPromise = import('pdfjs-dist/legacy/build/pdf.worker.mjs')
      .then(() => undefined)
      .catch((error) => {
        console.warn('[pdf-extract] Failed to preload pdf.worker.mjs:', error);
      });
  }
  await pdfWorkerReadyPromise;

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const globalWorkerOptions = pdfjs.GlobalWorkerOptions as { workerSrc?: string };
  if (!globalWorkerOptions.workerSrc || globalWorkerOptions.workerSrc === './pdf.worker.mjs') {
    globalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';
  }
  const bytes = new Uint8Array(buffer);

  const loadingTask = pdfjs.getDocument({
    data: bytes,
    useSystemFonts: true,
    isEvalSupported: false,
  });

  try {
    const pdf = await loadingTask.promise;
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (text) pageTexts.push(text);
      page.cleanup();
    }

    return pageTexts.join('\n\n');
  } finally {
    await loadingTask.destroy();
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const analytics = getAnalyticsHeaders(request);
  try {
    const formData = await request.formData();
    const fileValue = formData.get('file');

    if (!(fileValue instanceof Blob)) {
      await trackServerApiRequest({
        clientId: analytics.clientId,
        consent: analytics.consent,
        apiRoute: '/api/pdf-extract',
        result: 'error',
        statusCode: 400,
        durationMs: Date.now() - startedAt,
        errorCode: 'missing_file',
      });
      return NextResponse.json({ error: 'No PDF file received.' }, { status: 400 });
    }

    const buffer = await fileValue.arrayBuffer();
    if (!buffer.byteLength) {
      await trackServerApiRequest({
        clientId: analytics.clientId,
        consent: analytics.consent,
        apiRoute: '/api/pdf-extract',
        result: 'error',
        statusCode: 400,
        durationMs: Date.now() - startedAt,
        errorCode: 'empty_file',
      });
      return NextResponse.json({ error: 'Uploaded PDF is empty.' }, { status: 400 });
    }

    await trackServerApiRequest({
      clientId: analytics.clientId,
      consent: analytics.consent,
      apiRoute: '/api/pdf-extract',
      result: 'start',
      extra: {
        file_size_bucket:
          buffer.byteLength < 300_000
            ? 'lt_300kb'
            : buffer.byteLength < 1_000_000
              ? '300kb_1mb'
              : buffer.byteLength < 5_000_000
                ? '1mb_5mb'
                : 'gte_5mb',
      },
    });

    const text = await extractTextWithPdfJs(buffer);
    const response = NextResponse.json({ text });
    await trackServerApiRequest({
      clientId: analytics.clientId,
      consent: analytics.consent,
      apiRoute: '/api/pdf-extract',
      result: 'success',
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
    });
    return response;
  } catch (error) {
    console.error('[pdf-extract] error', error);
    const message = error instanceof Error ? error.message : 'Failed to extract PDF text.';
    const response = NextResponse.json({ error: message }, { status: 500 });
    await trackServerApiRequest({
      clientId: analytics.clientId,
      consent: analytics.consent,
      apiRoute: '/api/pdf-extract',
      result: 'error',
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
      errorCode: error instanceof Error ? error.name : 'unexpected_error',
    });
    return response;
  }
}
