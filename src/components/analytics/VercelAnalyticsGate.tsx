'use client';

import { Analytics as VercelAnalytics } from '@vercel/analytics/react';

import { useAnalytics } from '@/components/analytics/AnalyticsProvider';

export function VercelAnalyticsGate() {
  const { canTrack } = useAnalytics();

  if (!canTrack) return null;

  return <VercelAnalytics />;
}
