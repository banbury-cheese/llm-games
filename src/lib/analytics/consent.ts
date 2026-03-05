import { ANALYTICS_CONSENT_KEY } from '@/lib/analytics/types';
import type { AnalyticsConsent } from '@/lib/analytics/types';

function isBrowser() {
  return typeof window !== 'undefined';
}

export function getAnalyticsConsent(): AnalyticsConsent {
  if (!isBrowser()) return 'unset';
  const raw = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
  if (raw === 'granted' || raw === 'denied') return raw;
  return 'unset';
}

export function setAnalyticsConsent(value: Exclude<AnalyticsConsent, 'unset'>) {
  if (!isBrowser()) return;
  window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
}

export function clearAnalyticsConsent() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ANALYTICS_CONSENT_KEY);
}

export function isAnalyticsGranted(consent: AnalyticsConsent) {
  return consent === 'granted';
}

