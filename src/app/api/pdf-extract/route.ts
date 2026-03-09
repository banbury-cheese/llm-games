import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { NextResponse } from 'next/server';

import { getAnalyticsHeaders, trackServerApiRequest } from '@/lib/analytics/server';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);
const EXTRACT_SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'pdf-extract.mjs');
const EXTRACT_TIMEOUT_MS = 45_000;
const EXTRACT_MAX_BUFFER_BYTES = 10 * 1024 * 1024;

type ExtractScriptOutput = {
  text?: string;
  error?: string;
};

function parseScriptOutput(raw: string): ExtractScriptOutput {
  const parsed = JSON.parse(raw) as ExtractScriptOutput;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('PDF extraction script returned an invalid payload.');
  }
  return parsed;
}

function extractScriptErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('stdout' in error)) {
    return null;
  }

  const stdout = (error as { stdout?: string }).stdout;
  if (!stdout) {
    return null;
  }

  try {
    const output = parseScriptOutput(stdout);
    return output.error ?? null;
  } catch {
    return null;
  }
}

async function extractText(buffer: ArrayBuffer): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-games-pdf-'));
  const inputPath = path.join(tempDir, 'upload.pdf');
  try {
    await fs.writeFile(inputPath, Buffer.from(buffer));

    const { stdout } = await execFileAsync(process.execPath, [EXTRACT_SCRIPT_PATH, inputPath], {
      timeout: EXTRACT_TIMEOUT_MS,
      maxBuffer: EXTRACT_MAX_BUFFER_BYTES,
    });

    const output = parseScriptOutput(stdout);
    if (output.error) {
      throw new Error(output.error);
    }

    return (output.text ?? '').trim();
  } catch (error) {
    const scriptErrorMessage = extractScriptErrorMessage(error);
    if (scriptErrorMessage) {
      throw new Error(scriptErrorMessage);
    }

    throw error;
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

    const text = await extractText(buffer);
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
