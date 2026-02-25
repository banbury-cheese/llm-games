import fs from 'node:fs/promises';

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    process.stdout.write(JSON.stringify({ error: 'Missing input PDF path.' }));
    process.exitCode = 1;
    return;
  }

  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const bytes = new Uint8Array(await fs.readFile(inputPath));

    const loadingTask = pdfjs.getDocument({
      data: bytes,
    });

    try {
      const pdf = await loadingTask.promise;
      const pageTexts = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\\s+/g, ' ')
          .trim();

        if (text) pageTexts.push(text);
      }

      process.stdout.write(JSON.stringify({ text: pageTexts.join('\\n\\n') }));
    } finally {
      await loadingTask.destroy();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to extract PDF text.';
    process.stdout.write(JSON.stringify({ error: message }));
    process.exitCode = 1;
  }
}

await main();
