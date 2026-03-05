'use client';

import type { AnalyticsEventParams, AnalyticsConfig } from '@/lib/analytics/types';
import { sanitizeAnalyticsParams, type AnalyticsEventName } from '@/lib/analytics/events';
import { getOrCreateAnalyticsSessionId } from '@/lib/analytics/session';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let scriptLoaded = false;

function isBrowser() {
  return typeof window !== 'undefined';
}

export function getAnalyticsConfig(): AnalyticsConfig {
  return {
    measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '',
    forceEnabled: process.env.NEXT_PUBLIC_ANALYTICS_FORCE === 'true',
    env: process.env.NODE_ENV ?? 'development',
  };
}

export function isAnalyticsEnvironmentEnabled(config = getAnalyticsConfig()) {
  if (!config.measurementId) return false;
  if (config.forceEnabled) return true;
  return config.env === 'production';
}

function ensureGtagBootstrap(measurementId: string, sessionId: string) {
  if (!isBrowser()) return;

  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    };
  }

  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    send_page_view: false,
    anonymize_ip: true,
    client_id: sessionId,
  });
}

export function loadGoogleAnalytics(config = getAnalyticsConfig()) {
  if (!isBrowser() || scriptLoaded || !isAnalyticsEnvironmentEnabled(config)) return;

  const sessionId = getOrCreateAnalyticsSessionId();
  ensureGtagBootstrap(config.measurementId, sessionId);

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.measurementId)}`;
  script.onload = () => {
    ensureGtagBootstrap(config.measurementId, sessionId);
  };
  document.head.appendChild(script);

  scriptLoaded = true;
}

function withBaseParams(params: AnalyticsEventParams | undefined) {
  const sessionId = getOrCreateAnalyticsSessionId();
  return sanitizeAnalyticsParams({
    ...params,
    session_id: sessionId,
  });
}

export function trackAnalyticsEvent(event: AnalyticsEventName, params?: AnalyticsEventParams) {
  if (!isBrowser() || !window.gtag) return;
  window.gtag('event', event, withBaseParams(params));
}

export function trackAnalyticsPageView(path: string) {
  if (!isBrowser() || !window.gtag) return;
  window.gtag('event', 'page_view', withBaseParams({ path }));
}

