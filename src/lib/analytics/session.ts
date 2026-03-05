import { getAnalyticsConsent } from '@/lib/analytics/consent';
import { ANALYTICS_SESSION_KEY } from '@/lib/analytics/types';

function isBrowser() {
  return typeof window !== 'undefined';
}

function createSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateAnalyticsSessionId() {
  if (!isBrowser()) return '';
  const existing = window.sessionStorage.getItem(ANALYTICS_SESSION_KEY);
  if (existing) return existing;
  const next = createSessionId();
  window.sessionStorage.setItem(ANALYTICS_SESSION_KEY, next);
  return next;
}

export function getAnalyticsRequestHeaders(): Record<string, string> {
  if (!isBrowser()) return {};
  return {
    'x-analytics-session-id': getOrCreateAnalyticsSessionId(),
    'x-analytics-consent': getAnalyticsConsent(),
  };
}
