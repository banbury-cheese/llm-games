'use client';

import { Button } from '@/components/ui/Button';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';

export function ConsentBanner() {
  const { consent, setConsent } = useAnalytics();

  if (consent !== 'unset') return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[120] border-t px-4 py-4 shadow-[0_-8px_24px_rgba(0,0,0,0.2)]" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Analytics & Privacy</p>
          <p className="text-xs leading-5 text-[var(--text-muted)]">
            Help improve the app by sharing anonymous usage metrics. We never send API keys, prompts, PDF text, terms, or chat content.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => setConsent('denied')}>Decline</Button>
          <Button type="button" onClick={() => setConsent('granted')}>Allow Analytics</Button>
        </div>
      </div>
    </div>
  );
}

