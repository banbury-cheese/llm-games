'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { initGSAP } from '@/lib/gsap';
import type { Term } from '@/types/study-set';

import type { GameComponentProps } from '@/components/games/types';

type Puzzle = {
  id: string;
  answer: string;
  displayAnswer: string;
  clue: string;
  scrambled: string;
};

type LetterToken = {
  id: string;
  char: string;
};

type DragPayload = {
  zone: 'bank' | 'answer';
  tokenId: string;
};

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function normalizeWord(term: Term) {
  return term.term.replace(/[^a-zA-Z]/g, '').toUpperCase();
}

function scrambleWord(word: string) {
  const chars = word.split('');
  let next = shuffle(chars);
  if (next.join('') === word && word.length > 1) next = [...chars.slice(1), chars[0]];
  return next.join('');
}

function normalizePuzzles(data: unknown, fallbackTerms: Term[]): Puzzle[] {
  if (data && typeof data === 'object' && 'items' in data && Array.isArray((data as { items?: unknown[] }).items)) {
    const items = (data as { items: unknown[] }).items
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
        scrambled:
          typeof item.scrambled === 'string'
            ? item.scrambled.toUpperCase()
            : typeof item.answer === 'string'
              ? scrambleWord(item.answer.replace(/[^a-zA-Z]/g, '').toUpperCase())
              : '',
      }))
      .filter((item) => item.answer.length >= 3 && item.clue)
      .slice(0, 10);

    if (items.length) return items;
  }

  return fallbackTerms
    .map((term) => {
      const answer = normalizeWord(term);
      return {
        id: term.id,
        answer,
        displayAnswer: term.term,
        clue: term.definition,
        scrambled: scrambleWord(answer),
      };
    })
    .filter((item) => item.answer.length >= 3 && item.answer.length <= 12)
    .slice(0, 10);
}

function buildTokens(puzzle: Puzzle): LetterToken[] {
  return puzzle.scrambled.split('').map((char, index) => ({ id: `${puzzle.id}-${char}-${index}`, char }));
}

export function UnscrambleGame({ studySet, data }: GameComponentProps) {
  const puzzles = useMemo(() => normalizePuzzles(data, studySet.terms), [data, studySet.terms]);
  const [index, setIndex] = useState(0);
  const [bank, setBank] = useState<LetterToken[]>([]);
  const [answer, setAnswer] = useState<LetterToken[]>([]);
  const [feedback, setFeedback] = useState<{ kind: 'idle' | 'correct' | 'wrong'; message: string }>({ kind: 'idle', message: '' });
  const [solvedIds, setSolvedIds] = useState<string[]>([]);

  const bankRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const dragPayloadRef = useRef<DragPayload | null>(null);

  const current = puzzles[index];
  const currentPuzzleId = current?.id ?? null;
  const completed = puzzles.length > 0 && index >= puzzles.length;
  const progress = puzzles.length ? Math.round((solvedIds.length / puzzles.length) * 100) : 0;

  useEffect(() => {
    if (!current) return;
    setBank(buildTokens(current));
    setAnswer([]);
    setFeedback({ kind: 'idle', message: '' });
  }, [currentPuzzleId, current]);

  useEffect(() => {
    const gsap = initGSAP();
    if (bankRef.current) {
      gsap.fromTo(
        bankRef.current.querySelectorAll('[data-letter-chip]'),
        { y: 10, autoAlpha: 0, scale: 0.95 },
        { y: 0, autoAlpha: 1, scale: 1, duration: 0.2, stagger: 0.025, ease: 'power2.out' },
      );
    }
  }, [bank, currentPuzzleId]);

  const answerString = answer.map((token) => token.char).join('');

  const moveToAnswer = (tokenId: string) => {
    const token = bank.find((item) => item.id === tokenId);
    if (!token) return;
    setBank((prev) => prev.filter((item) => item.id !== tokenId));
    setAnswer((prev) => [...prev, token]);
    setFeedback({ kind: 'idle', message: '' });
  };

  const moveToBank = (tokenId: string) => {
    const token = answer.find((item) => item.id === tokenId);
    if (!token) return;
    setAnswer((prev) => prev.filter((item) => item.id !== tokenId));
    setBank((prev) => [...prev, token]);
    setFeedback({ kind: 'idle', message: '' });
  };

  const reorderAnswer = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    setAnswer((prev) => {
      const fromIndex = prev.findIndex((token) => token.id === draggedId);
      const toIndex = prev.findIndex((token) => token.id === targetId);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const handleShuffleBank = () => {
    setBank((prev) => shuffle(prev));
    setFeedback({ kind: 'idle', message: '' });
    const gsap = initGSAP();
    if (bankRef.current) {
      gsap.fromTo(
        bankRef.current.querySelectorAll('[data-letter-chip]'),
        { y: -4, rotation: 0 },
        { y: 0, rotation: 0, duration: 0.18, stagger: 0.02, ease: 'power2.out' },
      );
    }
  };

  const submitGuess = () => {
    if (!current) return;
    if (answer.length !== current.answer.length) {
      setFeedback({ kind: 'wrong', message: 'Fill all letter slots before checking.' });
      return;
    }

    if (answerString === current.answer) {
      setFeedback({ kind: 'correct', message: `Correct! ${current.displayAnswer}` });
      setSolvedIds((prev) => (prev.includes(current.id) ? prev : [...prev, current.id]));
      const gsap = initGSAP();
      if (answerRef.current) {
        gsap.fromTo(
          answerRef.current.querySelectorAll('[data-letter-chip]'),
          { scale: 1 },
          { scale: 1.06, yoyo: true, repeat: 1, duration: 0.1, stagger: 0.02, ease: 'power1.out' },
        );
      }
      return;
    }

    setFeedback({ kind: 'wrong', message: 'Not quite. Reorder or move letters and try again.' });
    const gsap = initGSAP();
    if (answerRef.current) {
      gsap.fromTo(answerRef.current, { x: 0 }, { x: 6, yoyo: true, repeat: 3, duration: 0.05, ease: 'power1.inOut' });
    }
  };

  const goNext = () => {
    setIndex((prev) => prev + 1);
  };

  if (!puzzles.length) {
    return (
      <Card className="rounded-[28px] p-6">
        <p className="text-sm text-[var(--text-muted)]">No puzzles available for Unscramble.</p>
      </Card>
    );
  }

  if (completed) {
    return (
      <Card className="rounded-[28px] p-6 sm:p-8">
        <div className="space-y-4">
          <p className="inline-flex rounded-full bg-lavender px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-black">Unscramble Complete</p>
          <h2 className="text-2xl font-semibold sm:text-3xl">Solved {solvedIds.length} / {puzzles.length} puzzles</h2>
          <p className="text-sm leading-6 text-[var(--text-muted)]">Replay to practice speed and pattern recognition.</p>
          <Button type="button" onClick={() => { setSolvedIds([]); setIndex(0); }}>Restart Unscramble</Button>
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
            <h2 className="text-xl font-semibold sm:text-2xl">Unscramble</h2>
            <p className="text-sm text-[var(--text-muted)]">Click letters to build the answer. Drag answer letters to reorder them.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border px-3 py-2 text-sm font-semibold" style={{ borderColor: 'var(--border)' }}>
              {index + 1} / {puzzles.length}
            </span>
            <span className="rounded-full bg-lavender px-3 py-2 text-sm font-semibold text-black">{progress}% solved</span>
          </div>
        </div>
      </Card>

      <Card className="rounded-[28px] p-5 sm:p-6">
        <div className="space-y-4">
          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Clue</p>
            <p className="mt-2 text-sm leading-6 sm:text-base">{current.clue}</p>
            <p className="mt-2 text-xs text-[var(--text-muted)]">Answer length: {current.answer.length}</p>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Answer slots</p>
            <div ref={answerRef} className="flex min-h-[72px] flex-wrap gap-2 rounded-2xl border p-3" style={{ borderColor: 'var(--border)' }}>
              {Array.from({ length: current.answer.length }).map((_, slotIndex) => {
                const token = answer[slotIndex];
                return token ? (
                  <button
                    key={token.id}
                    type="button"
                    data-letter-chip
                    draggable
                    onDragStart={() => {
                      dragPayloadRef.current = { zone: 'answer', tokenId: token.id };
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const drag = dragPayloadRef.current;
                      if (!drag || drag.zone !== 'answer') return;
                      reorderAnswer(drag.tokenId, token.id);
                    }}
                    onClick={() => moveToBank(token.id)}
                    className="grid h-12 w-12 place-items-center rounded-xl border text-base font-semibold shadow-sm transition hover:-translate-y-0.5"
                    style={{ borderColor: 'rgba(127,178,255,0.35)', background: 'rgba(127,178,255,0.14)' }}
                    title="Click to return to letter bank. Drag to reorder."
                  >
                    {token.char}
                  </button>
                ) : (
                  <div key={`slot-${slotIndex}`} className="grid h-12 w-12 place-items-center rounded-xl border border-dashed text-xs font-semibold text-[var(--text-muted)]" style={{ borderColor: 'var(--border)' }}>
                    _
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Letter bank</p>
              <Button type="button" size="sm" variant="ghost" onClick={handleShuffleBank}>Shuffle Letters</Button>
            </div>
            <div ref={bankRef} className="flex min-h-[72px] flex-wrap gap-2 rounded-2xl border p-3" style={{ borderColor: 'var(--border)' }}>
              {bank.map((token) => (
                <button
                  key={token.id}
                  type="button"
                  data-letter-chip
                  onClick={() => moveToAnswer(token.id)}
                  className="grid h-12 w-12 place-items-center rounded-xl border text-base font-semibold shadow-sm transition hover:-translate-y-0.5"
                  style={{ borderColor: 'rgba(175,163,255,0.35)', background: 'rgba(175,163,255,0.14)' }}
                  title="Click to move into answer"
                >
                  {token.char}
                </button>
              ))}
              {!bank.length ? <p className="text-sm text-[var(--text-muted)]">All letters placed in answer slots.</p> : null}
            </div>
          </div>

          {feedback.kind !== 'idle' ? (
            <div
              className="rounded-2xl border px-4 py-3 text-sm"
              style={{
                borderColor: feedback.kind === 'correct' ? 'rgba(166,190,89,0.45)' : 'rgba(243,87,87,0.4)',
                background: feedback.kind === 'correct' ? 'rgba(166,190,89,0.08)' : 'rgba(243,87,87,0.08)',
              }}
            >
              {feedback.message}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={submitGuess}>Check</Button>
            <Button type="button" onClick={goNext} disabled={feedback.kind !== 'correct'}>
              {index === puzzles.length - 1 ? 'Finish' : 'Next Puzzle'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
