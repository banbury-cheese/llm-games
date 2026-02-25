import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

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
  try {
    const formData = await request.formData();
    const fileValue = formData.get('file');

    if (!(fileValue instanceof Blob)) {
      return NextResponse.json({ error: 'No PDF file received.' }, { status: 400 });
    }

    const buffer = await fileValue.arrayBuffer();
    if (!buffer.byteLength) {
      return NextResponse.json({ error: 'Uploaded PDF is empty.' }, { status: 400 });
    }

    const text = await extractTextWithNodeScript(buffer);
    return NextResponse.json({ text });
  } catch (error) {
    console.error('[pdf-extract] error', error);
    const message = error instanceof Error ? error.message : 'Failed to extract PDF text.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
