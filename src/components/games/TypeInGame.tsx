'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { initGSAP } from '@/lib/gsap';
import type { Term } from '@/types/study-set';

import type { GameComponentProps } from '@/components/games/types';

type PromptItem = {
  id: string;
  answer: string;
  clue: string;
};

type AttemptRecord = {
  answer: string;
  score: number;
};

function normalizeItems(data: unknown, fallback: Term[]): PromptItem[] {
  if (data && typeof data === 'object' && 'items' in data && Array.isArray((data as { items?: unknown[] }).items)) {
    const items = (data as { items: unknown[] }).items
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item, index) => ({
        id: typeof item.id === 'string' ? item.id : `${index + 1}`,
        answer: typeof item.answer === 'string' ? item.answer : typeof item.term === 'string' ? item.term : '',
        clue: typeof item.clue === 'string' ? item.clue : typeof item.definition === 'string' ? item.definition : '',
      }))
      .filter((item) => item.answer.trim() && item.clue.trim())
      .slice(0, 20);

    if (items.length) return items;
  }

  return fallback.slice(0, 20).map((term) => ({ id: term.id, answer: term.term, clue: term.definition }));
}

function normalizeString(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[a.length][b.length];
}

function fuzzyScore(input: string, target: string) {
  const normalizedInput = normalizeString(input);
  const normalizedTarget = normalizeString(target);

  if (!normalizedInput || !normalizedTarget) return 0;
  if (normalizedInput === normalizedTarget) return 1;

  const compactInput = normalizedInput.replace(/\s+/g, '');
  const compactTarget = normalizedTarget.replace(/\s+/g, '');
  if (compactInput === compactTarget) return 0.98;
  if (compactTarget.includes(compactInput) || compactInput.includes(compactTarget)) return 0.82;

  const distance = levenshtein(compactInput, compactTarget);
  const maxLen = Math.max(compactInput.length, compactTarget.length, 1);
  const ratio = 1 - distance / maxLen;
  return Math.max(0, Math.min(1, ratio));
}

function scoreLabel(score: number) {
  if (score >= 0.95) return { label: 'Correct', color: 'rgba(166,190,89,0.16)', border: 'rgba(166,190,89,0.45)' };
  if (score >= 0.75) return { label: 'Close', color: 'rgba(236,210,39,0.14)', border: 'rgba(236,210,39,0.45)' };
  return { label: 'Needs work', color: 'rgba(243,87,87,0.12)', border: 'rgba(243,87,87,0.4)' };
}

export function TypeInGame({ studySet, data }: GameComponentProps) {
  const { trackEvent } = useAnalytics();
  const items = useMemo(() => normalizeItems(data, studySet.terms), [data, studySet.terms]);
  const [index, setIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [attempts, setAttempts] = useState<Record<string, AttemptRecord>>({});
  const [submittedScore, setSubmittedScore] = useState<number | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const completionTrackedRef = useRef(false);
  const currentItem = items[index];
  const currentItemId = currentItem?.id ?? null;

  const answeredCount = Object.keys(attempts).length;
  const averageScore = answeredCount
    ? Math.round(
        (Object.values(attempts).reduce((sum, attempt) => sum + attempt.score, 0) / answeredCount) * 100,
      )
    : 0;
  const progress = items.length ? Math.round((answeredCount / items.length) * 100) : 0;
  const completed = items.length > 0 && answeredCount === items.length;

  useEffect(() => {
    const node = cardRef.current;
    if (!node || !currentItem) return;
    const gsap = initGSAP();
    gsap.fromTo(node, { y: 12, autoAlpha: 0.4, scale: 0.99 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.26, ease: 'power2.out' });
  }, [currentItemId, currentItem]);

  useEffect(() => {
    if (submittedScore == null || !feedbackRef.current) return;
    const gsap = initGSAP();
    gsap.fromTo(feedbackRef.current, { y: 8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.22, ease: 'power2.out' });
  }, [submittedScore]);

  useEffect(() => {
    if (!currentItem) return;
    const previous = attempts[currentItem.id];
    setInputValue(previous?.answer ?? '');
    setSubmittedScore(previous?.score ?? null);
  }, [currentItem, attempts]);

  useEffect(() => {
    if (!completed || completionTrackedRef.current) return;
    completionTrackedRef.current = true;
    trackEvent('typein_complete', {
      set_id: studySet.id,
      score: averageScore,
      total_count: items.length,
    });
    trackEvent('game_session_complete', {
      set_id: studySet.id,
      game_type: 'type-in',
      score: averageScore,
      result: 'complete',
    });
  }, [completed, averageScore, items.length, studySet.id, trackEvent]);

  if (!items.length) {
    return (
      <Card className="rounded-[28px] p-6">
        <p className="text-sm text-[var(--text-muted)]">No prompts available for Type In.</p>
      </Card>
    );
  }

  if (completed && !currentItem) {
    return (
      <Card className="rounded-[28px] p-6 sm:p-8">
        <div className="space-y-4">
          <div>
            <p className="inline-flex rounded-full bg-peach px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-black">Type In Complete</p>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Average score: {averageScore}%</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Review your typed answers and retry to improve fuzzy-match accuracy.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => {
              const attempt = attempts[item.id];
              const badge = scoreLabel(attempt?.score ?? 0);
              return (
                <div key={item.id} className="rounded-2xl border p-4" style={{ borderColor: badge.border, background: badge.color }}>
                  <p className="text-sm font-semibold">{item.answer}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">You typed: {attempt?.answer || '—'}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em]">{Math.round((attempt?.score ?? 0) * 100)}% · {badge.label}</p>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                trackEvent('typein_restart', { set_id: studySet.id });
                setAttempts({});
                setIndex(0);
                setInputValue('');
                setSubmittedScore(null);
                completionTrackedRef.current = false;
              }}
            >
              Restart Type In
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const feedback = submittedScore == null ? null : scoreLabel(submittedScore);
  const currentAttempt = currentItem ? attempts[currentItem.id] : undefined;

  const submitAnswer = () => {
    if (!currentItem) return;
    const score = fuzzyScore(inputValue, currentItem.answer);
    setAttempts((prev) => ({
      ...prev,
      [currentItem.id]: {
        answer: inputValue,
        score,
      },
    }));
    setSubmittedScore(score);
    trackEvent('typein_submit', {
      set_id: studySet.id,
      score: Math.round(score * 100),
      score_bucket: score >= 0.95 ? 'high' : score >= 0.75 ? 'medium' : 'low',
    });
  };

  const goNext = () => {
    trackEvent('typein_next', {
      set_id: studySet.id,
      index,
    });
    if (index >= items.length - 1) {
      setIndex(items.length);
      return;
    }
    setIndex((prev) => prev + 1);
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">Type In</h2>
            <p className="text-sm text-[var(--text-muted)]">Type the matching term from the definition. Fuzzy matching gives partial credit.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full border px-3 py-2 font-semibold" style={{ borderColor: 'var(--border)' }}>
              {Math.min(index + 1, items.length)} / {items.length}
            </span>
            <span className="rounded-full bg-peach px-3 py-2 font-semibold text-black">Avg {averageScore}%</span>
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full bg-peach transition-all" style={{ width: `${progress}%` }} />
        </div>
      </Card>

      {currentItem ? (
        <div ref={cardRef}>
          <Card className="rounded-[28px] p-5 sm:p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Definition prompt</p>
              <p className="text-base leading-7 sm:text-xl sm:leading-8">{currentItem.clue}</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="type-in-answer" className="text-sm font-semibold">Your answer</label>
              <Input
                id="type-in-answer"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Type the term"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    submitAnswer();
                  }
                }}
              />
            </div>

            {feedback ? (
              <div ref={feedbackRef} className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: feedback.border, background: feedback.color }}>
                <p className="font-semibold">{feedback.label} · {Math.round((submittedScore ?? 0) * 100)}%</p>
                <p className="mt-1 leading-6">Expected answer: <strong>{currentItem.answer}</strong></p>
                {currentAttempt?.answer ? <p className="mt-1 text-[var(--text-muted)]">You typed: {currentAttempt.answer}</p> : null}
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-[var(--text-muted)]">Tip: exact answer scores highest, close spelling still gets partial credit.</div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={submitAnswer} disabled={!inputValue.trim()}>
                  Check Answer
                </Button>
                <Button type="button" onClick={goNext} disabled={!attempts[currentItem.id]}>
                  {index === items.length - 1 ? 'Finish' : 'Next'}
                </Button>
              </div>
            </div>
          </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
