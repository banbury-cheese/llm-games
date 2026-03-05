import { sanitizeAnalyticsParams } from '@/lib/analytics/events';
import type { AnalyticsEventParams, ServerAnalyticsInput } from '@/lib/analytics/types';

function isAnalyticsEnabledOnServer() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const apiSecret = process.env.GA_API_SECRET;
  const force = process.env.NEXT_PUBLIC_ANALYTICS_FORCE === 'true';
  const isProd = process.env.NODE_ENV === 'production';

  return Boolean(measurementId && apiSecret && (isProd || force));
}

function toDurationBucket(durationMs: number) {
  if (durationMs < 200) return 'lt_200ms';
  if (durationMs < 700) return '200_700ms';
  if (durationMs < 1500) return '700_1500ms';
  if (durationMs < 3000) return '1500_3000ms';
  return 'gte_3000ms';
}

function normalizeClientId(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return 'anonymous-session';
  return trimmed.slice(0, 64);
}

export function getAnalyticsHeaders(request: Request) {
  const consent = request.headers.get('x-analytics-consent') ?? 'unset';
  const clientId = request.headers.get('x-analytics-session-id') ?? '';

  return {
    consent,
    clientId: normalizeClientId(clientId),
  };
}

export async function trackServerAnalytics(input: ServerAnalyticsInput) {
  if (!isAnalyticsEnabledOnServer()) return;

  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID as string;
  const apiSecret = process.env.GA_API_SECRET as string;

  const body = {
    client_id: normalizeClientId(input.clientId),
    non_personalized_ads: true,
    events: [
      {
        name: input.event,
        params: sanitizeAnalyticsParams(input.params),
      },
    ],
  };

  try {
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      },
    );
  } catch {
    // Swallow analytics delivery failures so user flows never fail.
  }
}

export async function trackServerApiRequest(input: {
  clientId: string;
  consent: string;
  apiRoute: string;
  apiMode?: string;
  provider?: string;
  result: 'start' | 'success' | 'error';
  statusCode?: number;
  durationMs?: number;
  errorCode?: string;
  extra?: AnalyticsEventParams;
}) {
  if (input.consent !== 'granted') return;

  const durationMs = typeof input.durationMs === 'number' ? Math.max(0, Math.round(input.durationMs)) : undefined;

  await trackServerAnalytics({
    event: input.result === 'start' ? 'api_request_start' : 'api_request_result',
    clientId: input.clientId,
    params: {
      api_route: input.apiRoute,
      api_mode: input.apiMode,
      provider: input.provider,
      result: input.result,
      status_code: input.statusCode,
      duration_ms: durationMs,
      duration_bucket: typeof durationMs === 'number' ? toDurationBucket(durationMs) : undefined,
      error_code: input.errorCode,
      ...input.extra,
    },
  });
}

