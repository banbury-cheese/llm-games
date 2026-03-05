import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { getAnalyticsHeaders, trackServerApiRequest } from '@/lib/analytics/server';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

async function extractTextWithNodeScript(buffer: ArrayBuffer) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-games-pdf-'));
  const inputPath = path.join(tempDir, 'upload.pdf');
  const scriptPath = path.join(process.cwd(), 'scripts', 'pdf-extract.mjs');

  try {
    await fs.writeFile(inputPath, Buffer.from(buffer));

    const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath, inputPath], {
      maxBuffer: 20 * 1024 * 1024,
    });

    if (stderr?.trim()) {
      // Keep stderr visible in dev in case pdfjs emits warnings.
      console.warn('[pdf-extract] worker stderr:', stderr.trim());
    }

    const payload = JSON.parse(stdout) as { text?: string; error?: string };
    if (typeof payload.text !== 'string') {
      throw new Error(payload.error || 'PDF extraction script returned no text.');
    }

    return payload.text;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
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

    const text = await extractTextWithNodeScript(buffer);
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
