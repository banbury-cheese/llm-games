'use client';

import { useEffect, useRef, useState } from 'react';

import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import { SetGrid } from '@/components/dashboard/SetGrid';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { initGSAP } from '@/lib/gsap';
import { studySetStore } from '@/lib/storage';
import type { StudySet } from '@/types/study-set';

export default function DashboardPage() {
  const { trackEvent } = useAnalytics();
  const [sets, setSets] = useState<StudySet[]>([]);
  const [hydrating, setHydrating] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<StudySet | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSets(studySetStore.list());
    setHydrating(false);
  }, []);

  useEffect(() => {
    const gsap = initGSAP();
    const ctx = gsap.context(() => {
      gsap.from('[data-set-card]', {
        y: 18,
        autoAlpha: 0,
        scale: 0.98,
        duration: 0.38,
        ease: 'power2.out',
        stagger: 0.06,
      });
    }, rootRef);

    return () => ctx.revert();
  }, [sets.length]);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    trackEvent('set_cache_action', {
      action: 'delete_set',
      set_id: pendingDelete.id,
      result: 'success',
    });
    studySetStore.delete(pendingDelete.id);
    setSets(studySetStore.list());
    setPendingDelete(null);
  };

  return (
    <section ref={rootRef} className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 rounded-[30px] border p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between" style={{ borderColor: 'var(--border)', background: 'var(--surface-ghost)' }}>
        <div className="space-y-2">
          <p className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]" style={{ borderColor: 'var(--border)' }}>
            Study Arcade Dashboard
          </p>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">Your study sets</h1>
          <p className="max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">
            Colorful tilted cards, local-first persistence, and a game-selector flow optimized for fast iteration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full border px-3 py-2 font-semibold" style={{ borderColor: 'var(--border)' }}>
            {sets.length} set{sets.length === 1 ? '' : 's'}
          </span>
          <span className="rounded-full bg-olive px-3 py-2 font-semibold text-black">Responsive</span>
          <span className="rounded-full bg-lavender px-3 py-2 font-semibold text-black">Local Storage</span>
        </div>
      </div>

      {hydrating ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-full"
              style={{ transform: `rotate(${(index % 2 === 0 ? -1 : 1) * (1 + (index % 3) * 0.3)}deg)` }}
            >
              <Skeleton className="h-[220px] rounded-[26px] border-0 shadow-card" />
            </div>
          ))}
        </div>
      ) : (
        <SetGrid sets={sets} onDelete={setPendingDelete} />
      )}

      <Modal
        open={Boolean(pendingDelete)}
        title="Delete study set"
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        confirmLabel="Delete"
      >
        <p>
          Delete <strong>{pendingDelete?.title}</strong>? This removes cached game data and terms from localStorage.
        </p>
      </Modal>
    </section>
  );
}
