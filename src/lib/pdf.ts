import { getAnalyticsRequestHeaders } from '@/lib/analytics/session';

type PdfExtractResponse = {
  text?: string;
  error?: string;
};

export async function extractTextFromPdf(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/pdf-extract', {
    method: 'POST',
    headers: getAnalyticsRequestHeaders(),
    body: formData,
  });

  const payload = (await response.json()) as PdfExtractResponse;

  if (!response.ok || typeof payload.text !== 'string') {
    throw new Error(payload.error || 'Failed to extract PDF text.');
  }

  return payload.text;
}
