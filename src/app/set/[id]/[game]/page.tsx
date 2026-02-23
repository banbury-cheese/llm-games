'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { getGameComponent, isGameAvailableInCurrentBuild, isValidGameType } from '@/components/games/registry';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { generateAndCacheGameData } from '@/lib/game-data';
import { studySetStore } from '@/lib/storage';
import { GAME_LABELS, type GameType } from '@/types/game';
import type { StudySet } from '@/types/study-set';

export default function GamePage() {
  const params = useParams<{ id: string; game: string }>();
  const router = useRouter();

  const [studySet, setStudySet] = useState<StudySet | null>(null);
  const [gameType, setGameType] = useState<GameType | null>(null);
  const [gameData, setGameData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setStatus(null);

      const setId = params?.id;
      const rawGame = params?.game;

      if (!setId || !rawGame) {
        setError('Missing route parameters.');
        setLoading(false);
        return;
      }

      if (!isValidGameType(rawGame)) {
        setError('Unknown game route.');
        setLoading(false);
        return;
      }

      const currentSet = studySetStore.get(setId);
      if (!currentSet) {
        setError('Study set not found in localStorage.');
        setLoading(false);
        return;
      }

      if (cancelled) return;

      setStudySet(currentSet);
      setGameType(rawGame);

      if (!isGameAvailableInCurrentBuild(rawGame)) {
        setGameData({});
        setLoading(false);
        return;
      }

      try {
        const result = await generateAndCacheGameData(currentSet, rawGame);
        if (cancelled) return;
        setGameData(result.data);
        setStatus(
          result.source === 'cache'
            ? 'Loaded cached game data.'
            : result.source === 'llm'
              ? 'Generated game data via LLM.'
              : 'Generated local fallback game data.',
        );
        if (result.warning) {
          setStatus((prev) => `${prev ?? ''} ${result.warning}`.trim());
        }
        setStudySet(studySetStore.get(setId));
      } catch (generationError) {
        if (cancelled) return;
        setError(generationError instanceof Error ? generationError.message : 'Failed to load game data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [params?.id, params?.game]);

  const title = useMemo(() => (gameType ? GAME_LABELS[gameType] : 'Game'), [gameType]);

  if (loading) {
    return (
      <Card className="mx-auto max-w-4xl rounded-[28px] p-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <h1 className="text-2xl font-semibold">Loading game…</h1>
          <p className="text-sm text-[var(--text-muted)]">Preparing data and checking cache.</p>
        </div>
      </Card>
    );
  }

  if (error || !studySet || !gameType) {
    return (
      <Card className="mx-auto max-w-4xl rounded-[28px] p-6 sm:p-8">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold sm:text-3xl">Unable to open game</h1>
          <p className="text-sm leading-6 text-[var(--text-muted)] sm:text-base">{error ?? 'Unknown error.'}</p>
          <Button type="button" variant="secondary" onClick={() => router.push('/')}>
            Back to Dashboard
          </Button>
        </div>
      </Card>
    );
  }

  const GameComponent = getGameComponent(gameType);

  return (
    <section className="space-y-4">
      <Card className="rounded-[30px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]" style={{ borderColor: 'var(--border)' }}>
              {studySet.title}
            </p>
            <h1 className="text-2xl font-semibold leading-tight sm:text-3xl lg:text-4xl">{title}</h1>
            <p className="max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">
              {status || 'Choose answers, flip cards, or match pairs to practice the set.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => router.push(`/set/${studySet.id}`)}>
              ← Back to Games
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push('/')}>
              Dashboard
            </Button>
          </div>
        </div>
      </Card>

      <GameComponent studySet={studySet} gameType={gameType} data={gameData} />
    </section>
  );
}
