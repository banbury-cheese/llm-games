'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { GameSelectorCard } from '@/components/games/GameSelectorCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { initGSAP } from '@/lib/gsap';
import { studySetStore } from '@/lib/storage';
import { GAME_CATALOG } from '@/types/game';
import type { StudySet } from '@/types/study-set';

export default function SetPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [studySet, setStudySet] = useState<StudySet | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<StudySet | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!params?.id) return;
    setLoading(true);
    setStudySet(studySetStore.get(params.id));
    setLoading(false);
  }, [params?.id]);

  useEffect(() => {
    if (!studySet) return;

    const gsap = initGSAP();
    const ctx = gsap.context(() => {
      gsap.from('[data-game-tile]', {
        autoAlpha: 0,
        scale: 0.95,
        y: 14,
        duration: 0.38,
        ease: 'power2.out',
        stagger: 0.04,
      });
    }, rootRef);

    return () => ctx.revert();
  }, [studySet]);

  const stats = useMemo(
    () => ({
      terms: studySet?.terms.length ?? 0,
      cachedGames: studySet ? Object.keys(studySet.gameData ?? {}).length : 0,
    }),
    [studySet],
  );

  const clearCachedGameData = () => {
    if (!studySet) return;
    const updated = studySetStore.clearGameData(studySet.id);
    if (!updated) return;
    setStudySet(updated);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    studySetStore.delete(pendingDelete.id);
    setPendingDelete(null);
    router.push('/');
  };

  if (loading) {
    return (
      <section className="space-y-5">
        <Card className="rounded-[30px] p-5 sm:p-6">
          <div className="space-y-3">
            <Skeleton className="h-7 w-36 rounded-full" />
            <Skeleton className="h-10 w-full max-w-[28rem]" />
            <Skeleton className="h-5 w-full max-w-[34rem]" />
            <div className="flex flex-wrap gap-2 pt-1">
              <Skeleton className="h-10 w-24 rounded-full" />
              <Skeleton className="h-10 w-24 rounded-full" />
              <Skeleton className="h-10 w-28 rounded-full" />
            </div>
          </div>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-[156px] rounded-[24px]" />
          ))}
        </div>
      </section>
    );
  }

  if (!studySet) {
    return (
      <Card className="mx-auto max-w-3xl rounded-[28px] p-6 sm:p-8">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold sm:text-3xl">Study set not found</h1>
          <p className="text-sm leading-6 text-[var(--text-muted)] sm:text-base">
            This set may have been deleted from localStorage.
          </p>
          <div>
            <Button type="button" variant="secondary" onClick={() => router.push('/')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <section ref={rootRef} className="space-y-5">
      <Card className="rounded-[30px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]" style={{ borderColor: 'var(--border)' }}>
              Game Selector
            </p>
            <h1 className="text-2xl font-semibold leading-tight sm:text-3xl lg:text-4xl">{studySet.title}</h1>
            <p className="max-w-3xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">
              {studySet.description || 'Choose a mini-game to practice this study set.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border px-3 py-2 font-semibold" style={{ borderColor: 'var(--border)' }}>
              {stats.terms} terms
            </span>
            <span className="rounded-full bg-lavender px-3 py-2 font-semibold text-black">
              {stats.cachedGames} cached
            </span>
            <Button type="button" variant="ghost" onClick={() => router.push(`/create?edit=${studySet.id}&regen=1`)}>
              Re-generate Terms
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push(`/create?edit=${studySet.id}`)}>
              Edit Set
            </Button>
            <Button type="button" variant="ghost" onClick={clearCachedGameData}>
              Clear Game Cache
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPendingDelete(studySet)}>
              Delete
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push('/')}>
              Dashboard
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {GAME_CATALOG.map((game, index) => (
          <GameSelectorCard key={game.type} game={game} href={`/set/${studySet.id}/${game.type}`} index={index} />
        ))}
      </div>

      <Modal
        open={Boolean(pendingDelete)}
        title="Delete study set"
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        confirmLabel="Delete"
      >
        <p>
          Delete <strong>{pendingDelete?.title}</strong>? This removes the deck and all cached game data from localStorage.
        </p>
      </Modal>
    </section>
  );
}
