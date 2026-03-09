import fs from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    process.stdout.write(JSON.stringify({ error: 'Missing input PDF path.' }));
    process.exitCode = 1;
    return;
  }

  try {
    const bytes = await fs.readFile(inputPath);
    const parser = new PDFParse({ data: bytes });

    try {
      const result = await parser.getText();
      process.stdout.write(JSON.stringify({ text: (result.text ?? '').trim() }));
    } finally {
      await parser.destroy();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to extract PDF text.';
    process.stdout.write(JSON.stringify({ error: message }));
    process.exitCode = 1;
  }
}

await main();
