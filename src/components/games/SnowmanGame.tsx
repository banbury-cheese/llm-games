'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { initGSAP } from '@/lib/gsap';
import type { Term } from '@/types/study-set';

import type { GameComponentProps } from '@/components/games/types';

type SnowmanRound = {
  id: string;
  answer: string;
  displayAnswer: string;
  clue: string;
  hint: string;
};

const MAX_WRONG = 6;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const BREAK_ORDER = [6, 5, 4, 3, 2, 1] as const;

function normalizeWord(term: Term) {
  return term.term.replace(/[^a-zA-Z]/g, '').toUpperCase();
}

function normalizeRounds(data: unknown, fallbackTerms: Term[]): SnowmanRound[] {
  if (data && typeof data === 'object' && 'rounds' in data && Array.isArray((data as { rounds?: unknown[] }).rounds)) {
    const rounds = (data as { rounds: unknown[] }).rounds
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item, index) => ({
        id: typeof item.id === 'string' ? item.id : `${index + 1}`,
        answer: typeof item.answer === 'string' ? item.answer.toUpperCase() : '',
        displayAnswer:
          typeof item.displayAnswer === 'string'
            ? item.displayAnswer
            : typeof item.answer === 'string'
              ? item.answer
              : '',
        clue: typeof item.clue === 'string' ? item.clue : '',
        hint: typeof item.hint === 'string' ? item.hint : 'Use the clue and reveal one letter if needed.',
      }))
      .filter((round) => round.answer.length >= 3 && round.clue)
      .slice(0, 8);

    if (rounds.length) return rounds;
  }

  return fallbackTerms
    .map((term) => {
      const answer = normalizeWord(term);
      return {
        id: term.id,
        answer,
        displayAnswer: term.term,
        clue: term.definition,
        hint: `Starts with “${answer[0] ?? '?'}” and has ${answer.length} letters.`,
      };
    })
    .filter((round) => round.answer.length >= 3 && round.answer.length <= 12)
    .slice(0, 8);
}

function SnowmanSvg({ wrongCount }: { wrongCount: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const previousWrongRef = useRef(0);

  useEffect(() => {
    const gsap = initGSAP();
    const svg = svgRef.current;
    if (!svg) return;

    const parts = BREAK_ORDER.map((id) => ({
      id,
      el: svg.querySelector(`[data-snow-part="${id}"]`) as SVGElement | null,
    })).filter((part): part is { id: (typeof BREAK_ORDER)[number]; el: SVGElement } => !!part.el);

    const hiddenParts = new Set(BREAK_ORDER.slice(0, wrongCount));
    const previous = previousWrongRef.current;

    if (wrongCount < previous) {
      parts.forEach(({ id, el }) => {
        gsap.killTweensOf(el);
        gsap.set(el, {
          autoAlpha: hiddenParts.has(id) ? 0 : 1,
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1,
          transformOrigin: '50% 50%',
        });
      });
      previousWrongRef.current = wrongCount;
      return;
    }

    if (wrongCount === previous) {
      parts.forEach(({ id, el }) => {
        gsap.set(el, {
          autoAlpha: hiddenParts.has(id) ? 0 : 1,
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1,
          transformOrigin: '50% 50%',
        });
      });
      previousWrongRef.current = wrongCount;
      return;
    }

    const newlyBroken = BREAK_ORDER.slice(previous, wrongCount);
    newlyBroken.forEach((id, index) => {
      const target = parts.find((part) => part.id === id)?.el;
      if (!target) return;

      const driftX = id % 2 === 0 ? 18 : -18;
      const driftY = id <= 2 ? 22 : 12;
      const rotation = id % 2 === 0 ? 12 : -12;

      gsap.killTweensOf(target);
      gsap.to(target, {
        autoAlpha: 0,
        x: driftX,
        y: driftY,
        rotation,
        scale: 0.78,
        duration: 0.24,
        delay: index * 0.02,
        ease: 'power2.in',
        transformOrigin: '50% 50%',
      });
    });

    previousWrongRef.current = wrongCount;
  }, [wrongCount]);

  return (
    <svg ref={svgRef} viewBox="0 0 240 220" className="h-[220px] w-full max-w-[280px]" aria-label="Snowman progress illustration">
      <circle cx="120" cy="204" r="16" fill="#dfe8ff" opacity="0.35" />
      <ellipse cx="120" cy="207" rx="54" ry="9" fill="#9fb6e8" opacity="0.22" />

      <g data-snow-part="1">
        <circle cx="120" cy="168" r="28" fill="#f1f5ff" stroke="#b7c7ef" strokeWidth="3" />
      </g>
      <g data-snow-part="2">
        <circle cx="120" cy="122" r="22" fill="#f1f5ff" stroke="#b7c7ef" strokeWidth="3" />
      </g>
      <g data-snow-part="3">
        <circle cx="120" cy="84" r="17" fill="#f1f5ff" stroke="#b7c7ef" strokeWidth="3" />
      </g>
      <g data-snow-part="4">
        <line x1="100" y1="124" x2="77" y2="112" stroke="#7a532f" strokeWidth="4" strokeLinecap="round" />
        <line x1="140" y1="124" x2="163" y2="112" stroke="#7a532f" strokeWidth="4" strokeLinecap="round" />
      </g>
      <g data-snow-part="5">
        <circle cx="114" cy="81" r="2.3" fill="#232323" />
        <circle cx="126" cy="81" r="2.3" fill="#232323" />
        <polygon points="120,86 132,90 120,93" fill="#ec683e" />
      </g>
      <g data-snow-part="6">
        <rect x="103" y="56" width="34" height="9" rx="2" fill="#232323" />
        <rect x="111" y="39" width="18" height="20" rx="2" fill="#232323" />
      </g>
    </svg>
  );
}

export function SnowmanGame({ studySet, data }: GameComponentProps) {
  const { trackEvent } = useAnalytics();
  const rounds = useMemo(() => normalizeRounds(data, studySet.terms), [data, studySet.terms]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
  const [wrongLetters, setWrongLetters] = useState<string[]>([]);
  const [usedHint, setUsedHint] = useState(false);
  const [solvedCount, setSolvedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [totalHintsUsed, setTotalHintsUsed] = useState(0);
  const [status, setStatus] = useState('Guess letters to complete the word before the snowman breaks apart.');
  const completionTrackedRef = useRef(false);

  const current = rounds[roundIndex];
  const roundComplete = roundIndex >= rounds.length;

  const wrongCount = wrongLetters.length;
  const uniqueAnswerLetters = useMemo(
    () => (current ? Array.from(new Set(current.answer.split(''))) : []),
    [current],
  );
  const isSolved = current ? uniqueAnswerLetters.every((letter) => guessedLetters.includes(letter)) : false;
  const isFailed = wrongCount >= MAX_WRONG;

  const maskedWord = current
    ? current.answer
        .split('')
        .map((letter) => (guessedLetters.includes(letter) || isFailed ? letter : '_'))
        .join(' ')
    : '';

  useEffect(() => {
    setGuessedLetters([]);
    setWrongLetters([]);
    setUsedHint(false);
    if (roundIndex < rounds.length) {
      setStatus('Guess letters to complete the word before the snowman breaks apart.');
    }
  }, [roundIndex, rounds.length]);

  const finalizeRound = useCallback((result: 'solved' | 'failed') => {
    if (!current) return;
    if (result === 'solved') {
      setSolvedCount((prev) => prev + 1);
      setStatus(`Solved! The answer was ${current.displayAnswer}.`);
    } else {
      setFailedCount((prev) => prev + 1);
      setStatus(`Snowman broke apart. The answer was ${current.displayAnswer}.`);
    }
    trackEvent('snowman_round_complete', {
      set_id: studySet.id,
      result,
      index: roundIndex,
    });
  }, [current, roundIndex, studySet.id, trackEvent]);

  const guessLetter = useCallback((letter: string) => {
    if (!current || isSolved || isFailed) return;
    if (guessedLetters.includes(letter) || wrongLetters.includes(letter)) return;

    if (current.answer.includes(letter)) {
      const nextGuessed = [...guessedLetters, letter];
      setGuessedLetters(nextGuessed);
      setStatus(`Nice! ${letter} is in the word.`);
      trackEvent('snowman_guess', {
        set_id: studySet.id,
        result: 'correct',
      });

      const solved = uniqueAnswerLetters.every((l) => nextGuessed.includes(l));
      if (solved) {
        window.setTimeout(() => finalizeRound('solved'), 20);
      }
      return;
    }

    const nextWrong = [...wrongLetters, letter];
    setWrongLetters(nextWrong);
    setStatus(`${letter} is not in the word.`);
    trackEvent('snowman_guess', {
      set_id: studySet.id,
      result: 'wrong',
    });

    if (nextWrong.length >= MAX_WRONG) {
      window.setTimeout(() => finalizeRound('failed'), 20);
    }
  }, [current, isSolved, isFailed, guessedLetters, wrongLetters, uniqueAnswerLetters, finalizeRound, studySet.id, trackEvent]);

  const useHint = () => {
    if (!current || usedHint || isSolved || isFailed) return;
    const remaining = uniqueAnswerLetters.filter((letter) => !guessedLetters.includes(letter));
    const reveal = remaining[0];
    if (!reveal) return;
    setGuessedLetters((prev) => [...prev, reveal]);
    setUsedHint(true);
    setTotalHintsUsed((prev) => prev + 1);
    setStatus(`Hint used: revealed the letter ${reveal}.`);
    trackEvent('snowman_hint', { set_id: studySet.id, index: roundIndex });
  };

  useEffect(() => {
    if (!roundComplete || completionTrackedRef.current) return;
    completionTrackedRef.current = true;
    trackEvent('snowman_game_complete', {
      set_id: studySet.id,
      total_count: rounds.length,
      correct_count: solvedCount,
      wrong_count: failedCount,
      attempts: totalHintsUsed,
    });
    trackEvent('game_session_complete', {
      set_id: studySet.id,
      game_type: 'snowman',
      result: 'complete',
      score: solvedCount,
    });
  }, [roundComplete, rounds.length, solvedCount, failedCount, totalHintsUsed, studySet.id, trackEvent]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!current || isSolved || isFailed) return;
      const key = event.key.toUpperCase();
      if (/^[A-Z]$/.test(key)) {
        event.preventDefault();
        guessLetter(key);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [current, isSolved, isFailed, guessLetter]);

  if (!rounds.length) {
    return (
      <Card className="rounded-[28px] p-6">
        <p className="text-sm text-[var(--text-muted)]">No rounds available for Snowman.</p>
      </Card>
    );
  }

  if (roundComplete) {
    return (
      <Card className="rounded-[28px] p-6 sm:p-8">
        <div className="space-y-4">
          <p className="inline-flex rounded-full bg-sky px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-black">Snowman Complete</p>
          <h2 className="text-2xl font-semibold sm:text-3xl">Solved {solvedCount} / {rounds.length}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Solved</p>
              <p className="mt-2 text-2xl font-semibold">{solvedCount}</p>
            </div>
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Missed</p>
              <p className="mt-2 text-2xl font-semibold">{failedCount}</p>
            </div>
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Hints used</p>
              <p className="mt-2 text-2xl font-semibold">{totalHintsUsed}</p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => {
              completionTrackedRef.current = false;
              setRoundIndex(0);
              setSolvedCount(0);
              setFailedCount(0);
              setTotalHintsUsed(0);
              setStatus('Guess letters to complete the word before the snowman breaks apart.');
            }}
          >
            Restart Snowman
          </Button>
        </div>
      </Card>
    );
  }

  if (!current) return null;

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">Snowman</h2>
            <p className="text-sm text-[var(--text-muted)]">Guess the word letter by letter. Wrong guesses break the snowman.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full border px-3 py-2 font-semibold" style={{ borderColor: 'var(--border)' }}>
              Round {roundIndex + 1} / {rounds.length}
            </span>
            <span className="rounded-full bg-sky px-3 py-2 font-semibold text-black">Wrong {wrongCount}/{MAX_WRONG}</span>
          </div>
        </div>
      </Card>

      <Card className="rounded-[28px] p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>
            <div className="flex flex-col items-center gap-2">
              <SnowmanSvg wrongCount={wrongCount} />
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Snowman integrity</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Clue</p>
              <p className="mt-2 text-sm leading-6 sm:text-base">{current.clue}</p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">{status}</p>
            </div>

            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Word</p>
              <p className="mt-3 break-all text-2xl font-semibold tracking-[0.18em] sm:text-3xl">{maskedWord}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={useHint} disabled={usedHint || isSolved || isFailed}>
                {usedHint ? 'Hint Used' : 'Use Hint'}
              </Button>
              {usedHint ? <span className="text-xs text-[var(--text-muted)] self-center">{current.hint}</span> : null}
            </div>

            <div className="grid grid-cols-7 gap-2 sm:grid-cols-9">
              {LETTERS.map((letter) => {
                const guessed = guessedLetters.includes(letter);
                const wrong = wrongLetters.includes(letter);
                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => guessLetter(letter)}
                    disabled={guessed || wrong || isSolved || isFailed}
                    className="grid h-10 place-items-center rounded-xl border text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-65"
                    style={{
                      borderColor: guessed ? 'rgba(166,190,89,0.4)' : wrong ? 'rgba(243,87,87,0.4)' : 'var(--border)',
                      background: guessed ? 'rgba(166,190,89,0.12)' : wrong ? 'rgba(243,87,87,0.10)' : 'var(--surface)',
                    }}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>

            {(isSolved || isFailed) ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => setRoundIndex((prev) => prev + 1)}>
                  {roundIndex === rounds.length - 1 ? 'Finish Snowman' : 'Next Round'}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
