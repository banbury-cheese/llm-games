'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import { getGameComponent, isGameAvailableInCurrentBuild, isValidGameType } from '@/components/games/registry';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { generateAndCacheGameData } from '@/lib/game-data';
import { computeTermPriority } from '@/lib/personalization';
import { aiSettingsStore, studySetStore } from '@/lib/storage';
import { GAME_LABELS, type GameType } from '@/types/game';
import type { StudySet } from '@/types/study-set';

export default function GamePage() {
  const { trackEvent } = useAnalytics();
  const params = useParams<{ id: string; game: string }>();
  const router = useRouter();

  const [studySet, setStudySet] = useState<StudySet | null>(null);
  const [gameType, setGameType] = useState<GameType | null>(null);
  const [gameData, setGameData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [packRefreshing, setPackRefreshing] = useState(false);
  const loadTokenRef = useRef(0);
  const sessionStartMsRef = useRef<number | null>(null);
  const sessionIncrementedRef = useRef<string | null>(null);

  const isCorePersonalizedGame = gameType === 'flashcards' || gameType === 'quiz' || gameType === 'matching' || gameType === 'type-in';
  const supportsPersonalizedPack = gameType === 'quiz' || gameType === 'type-in';
  const perRoundBase = gameType === 'matching' ? 8 : gameType === 'type-in' ? 10 : gameType === 'quiz' ? 10 : 10;
  const targetRate = studySet?.personalization?.targetRate ?? 0.4;
  const targetPerRound = Math.max(1, Math.round(perRoundBase * targetRate));

  const loadGame = useCallback(async (opts?: { force?: boolean }) => {
    const token = ++loadTokenRef.current;
    setLoading(true);
    setError(null);
    if (opts?.force) {
      setStatus('Re-generating game data…');
    } else {
      setStatus(null);
    }

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

    setStudySet(currentSet);
    setGameType(rawGame);

    if (!isGameAvailableInCurrentBuild(rawGame)) {
      setGameData({});
      setLoading(false);
      trackEvent('game_data_load_result', {
        set_id: setId,
        game_type: rawGame,
        result: 'unavailable',
      });
      return;
    }

    try {
      trackEvent('game_data_load_start', {
        set_id: setId,
        game_type: rawGame,
        mode: opts?.force ? 'regenerate' : 'load',
      });
      const result = await generateAndCacheGameData(currentSet, rawGame, { force: opts?.force });
      if (token !== loadTokenRef.current) return;
      const warning = 'warning' in result ? result.warning : undefined;
      setGameData(result.data);
      setStatus(
        result.source === 'cache'
          ? 'Loaded cached game data.'
          : 'Generated local game data.',
      );
      if (warning) {
        setStatus((prev) => `${prev ?? ''} ${warning}`.trim());
      }
      setStudySet(studySetStore.get(setId));
      trackEvent('game_data_load_result', {
        set_id: setId,
        game_type: rawGame,
        source: result.source,
        has_warning: Boolean(warning),
        result: 'success',
      });
    } catch (generationError) {
      if (token !== loadTokenRef.current) return;
      setError(generationError instanceof Error ? generationError.message : 'Failed to load game data.');
      trackEvent('game_data_load_result', {
        set_id: setId,
        game_type: rawGame,
        result: 'error',
      });
    } finally {
      if (token !== loadTokenRef.current) return;
      setLoading(false);
    }
  }, [params?.game, params?.id, trackEvent]);

  useEffect(() => {
    void loadGame();

    return () => {
      loadTokenRef.current += 1;
    };
  }, [loadGame]);

  const activeSetId = studySet?.id;

  useEffect(() => {
    if (loading || error || !activeSetId || !gameType) return;
    if (sessionIncrementedRef.current !== `${activeSetId}:${gameType}`) {
      const updated = studySetStore.incrementPersonalizationSession(activeSetId);
      if (updated) setStudySet(updated);
      sessionIncrementedRef.current = `${activeSetId}:${gameType}`;
    }
    const startedAt = Date.now();
    sessionStartMsRef.current = startedAt;
    trackEvent('game_session_start', {
      set_id: activeSetId,
      game_type: gameType,
      mode: 'session',
    });

    return () => {
      const duration = sessionStartMsRef.current ? Date.now() - sessionStartMsRef.current : undefined;
      trackEvent('game_session_exit', {
        set_id: activeSetId,
        game_type: gameType,
        elapsed_ms: duration,
        duration_ms: duration,
        result: 'exit',
      });
      sessionStartMsRef.current = null;
    };
  }, [loading, error, activeSetId, gameType, trackEvent]);

  const refreshPersonalizedPack = useCallback(async () => {
    if (!studySet || !gameType || !supportsPersonalizedPack) return;
    setPackRefreshing(true);
    setError(null);
    try {
      const settings = aiSettingsStore.get();
      const priorities = computeTermPriority(studySet);
      const weakTermIds = priorities
        .filter((entry) => entry.isWeak)
        .map((entry) => entry.termId)
        .slice(0, 16);
      const prioritizedIds = priorities.map((entry) => entry.termId).slice(0, 16);
      const selectedIds = weakTermIds.length ? weakTermIds : prioritizedIds;
      const targetTerms = studySet.terms
        .filter((term) => selectedIds.includes(term.id))
        .slice(0, 16)
        .map((term) => ({ id: term.id, term: term.term, definition: term.definition }));

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'personalized-pack',
          gameType,
          weakTermIds,
          targetTerms,
          tutorInstruction: studySet.tutorInstruction,
          settings,
        }),
      });

      const payload = (await response.json()) as { data?: unknown; warning?: string; source?: string; error?: unknown };
      if (!response.ok || !payload.data) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to refresh personalized pack.');
      }

      studySetStore.updateGameData(studySet.id, gameType, payload.data);
      setGameData(payload.data);
      setStatus(
        `${payload.source === 'llm' ? 'Personalized pack refreshed via LLM.' : 'Personalized pack refreshed via fallback.'}${payload.warning ? ` ${payload.warning}` : ''}`,
      );
      const refreshed = studySetStore.get(studySet.id);
      if (refreshed) setStudySet(refreshed);
      trackEvent('personalized_pack_refresh', {
        set_id: studySet.id,
        game_type: gameType,
        source: payload.source ?? 'unknown',
        result: 'success',
      });
    } catch (packError) {
      setError(packError instanceof Error ? packError.message : 'Unable to refresh personalized pack.');
      trackEvent('personalized_pack_refresh', {
        set_id: studySet.id,
        game_type: gameType,
        result: 'error',
      });
    } finally {
      setPackRefreshing(false);
    }
  }, [gameType, studySet, supportsPersonalizedPack, trackEvent]);

  const title = useMemo(() => (gameType ? GAME_LABELS[gameType] : 'Game'), [gameType]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="rounded-[30px] p-5 sm:p-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Spinner size="lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40 rounded-full" />
                <Skeleton className="h-8 w-52" />
              </div>
            </div>
            <Skeleton className="h-5 w-full max-w-[34rem]" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-10 w-28 rounded-full" />
              <Skeleton className="h-10 w-24 rounded-full" />
            </div>
          </div>
        </Card>
        <Card className="rounded-[28px] p-5 sm:p-6">
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-[90%]" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        </Card>
      </div>
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
            {isCorePersonalizedGame ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`rounded-full px-3 py-1 font-semibold uppercase tracking-[0.14em] ${studySet.personalization?.enabled ? 'bg-olive text-black' : 'border'}`}
                  style={studySet.personalization?.enabled ? undefined : { borderColor: 'var(--border)' }}
                >
                  {studySet.personalization?.enabled ? 'Personalized for you' : 'Personalization off'}
                </span>
                {studySet.personalization?.enabled ? (
                  <span className="rounded-full border px-3 py-1 font-semibold tracking-[0.08em]" style={{ borderColor: 'var(--border)' }}>
                    {targetPerRound} of {perRoundBase} targeted
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {supportsPersonalizedPack && studySet.personalization?.enabled ? (
              <Button type="button" variant="ghost" onClick={() => void refreshPersonalizedPack()} loading={packRefreshing}>
                Refresh Personalized Pack
              </Button>
            ) : null}
            {isGameAvailableInCurrentBuild(gameType) ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  trackEvent('set_cache_action', {
                    action: 'regenerate_game_data',
                    set_id: studySet.id,
                    game_type: gameType,
                  });
                  void loadGame({ force: true });
                }}
              >
                Re-generate Data
              </Button>
            ) : null}
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
