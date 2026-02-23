export async function extractTextFromPdf(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const loadingTask = pdfjs.getDocument(
    {
      data: new Uint8Array(arrayBuffer),
      disableWorker: true,
    } as unknown as Parameters<typeof pdfjs.getDocument>[0],
  );
  const pdf = await loadingTask.promise;

  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (text) pageTexts.push(text);
  }

  return pageTexts.join('\n\n');
}
