'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { getAnalyticsConsent, setAnalyticsConsent } from '@/lib/analytics/consent';
import {
  getAnalyticsConfig,
  isAnalyticsEnvironmentEnabled,
  loadGoogleAnalytics,
  trackAnalyticsEvent,
  trackAnalyticsPageView,
} from '@/lib/analytics/client';
import type { AnalyticsConsent, AnalyticsEventParams } from '@/lib/analytics/types';
import type { AnalyticsEventName } from '@/lib/analytics/events';
import { getOrCreateAnalyticsSessionId } from '@/lib/analytics/session';

interface AnalyticsContextValue {
  consent: AnalyticsConsent;
  setConsent: (next: Exclude<AnalyticsConsent, 'unset'>) => void;
  canTrack: boolean;
  sessionId: string;
  trackEvent: (event: AnalyticsEventName, params?: AnalyticsEventParams) => void;
  trackPageView: (path: string) => void;
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

function routeContext(pathname: string) {
  if (pathname === '/') {
    return { routeEvent: 'dashboard_view' as const, params: { route_kind: 'dashboard' } };
  }
  if (pathname === '/create') {
    return { routeEvent: 'create_view' as const, params: { route_kind: 'create' } };
  }
  if (pathname === '/settings') {
    return { routeEvent: 'settings_view' as const, params: { route_kind: 'settings' } };
  }

  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'set' && parts.length >= 2) {
    if (parts.length === 2) {
      return {
        routeEvent: 'set_view' as const,
        params: { route_kind: 'set', set_id: parts[1] },
      };
    }

    if (parts.length >= 3) {
      return {
        routeEvent: 'game_view' as const,
        params: { route_kind: 'game', set_id: parts[1], game_type: parts[2] },
      };
    }
  }

  return { routeEvent: null, params: { route_kind: 'other' } };
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const config = useMemo(() => getAnalyticsConfig(), []);
  const [consent, setConsentState] = useState<AnalyticsConsent>('unset');
  const [sessionId, setSessionId] = useState('');

  const canTrack = consent === 'granted' && isAnalyticsEnvironmentEnabled(config);

  useEffect(() => {
    setConsentState(getAnalyticsConsent());
    setSessionId(getOrCreateAnalyticsSessionId());
  }, []);

  useEffect(() => {
    if (consent !== 'granted') return;
    loadGoogleAnalytics(config);
  }, [config, consent]);

  const trackEvent = useCallback((event: AnalyticsEventName, params?: AnalyticsEventParams) => {
    if (!canTrack) return;
    trackAnalyticsEvent(event, params);
  }, [canTrack]);

  const trackPageView = useCallback((path: string) => {
    if (!canTrack) return;
    trackAnalyticsPageView(path);
  }, [canTrack]);

  const setConsent = useCallback((next: Exclude<AnalyticsConsent, 'unset'>) => {
    setAnalyticsConsent(next);
    setConsentState(next);
    if (next === 'granted') {
      loadGoogleAnalytics(config);
    }
  }, [config]);

  useEffect(() => {
    if (!pathname || !canTrack) return;

    const query = searchParams?.toString();
    const fullPath = query ? `${pathname}?${query}` : pathname;
    trackPageView(fullPath);

    const mapped = routeContext(pathname);
    if (mapped.routeEvent) {
      trackEvent(mapped.routeEvent, { ...mapped.params, path: fullPath });
    }
  }, [canTrack, pathname, searchParams, trackEvent, trackPageView]);

  const value = useMemo<AnalyticsContextValue>(() => ({
    consent,
    setConsent,
    canTrack,
    sessionId,
    trackEvent,
    trackPageView,
  }), [canTrack, consent, sessionId, setConsent, trackEvent, trackPageView]);

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used inside AnalyticsProvider');
  }
  return context;
}

