'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Draggable } from 'gsap/dist/Draggable';

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

type FeedbackState = {
  kind: 'idle' | 'correct' | 'wrong';
  message: string;
};

type DraggableInstance = ReturnType<typeof Draggable.create>[number];

const CHIP_SIZE = 56;
const GAP = 8;
const SLOT_PITCH = CHIP_SIZE + GAP;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

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
  if (
    data &&
    typeof data === 'object' &&
    'items' in data &&
    Array.isArray((data as { items?: unknown[] }).items)
  ) {
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
  const [tokens, setTokens] = useState<LetterToken[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState>({ kind: 'idle', message: '' });
  const [solvedIds, setSolvedIds] = useState<string[]>([]);

  const rowRef = useRef<HTMLDivElement>(null);
  const tokenRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const draggablesRef = useRef<Record<string, DraggableInstance | undefined>>({});
  const tokensRef = useRef<LetterToken[]>([]);
  const finalizeGuardRef = useRef<Record<string, boolean>>({});
  const animatedPuzzleRef = useRef<string | null>(null);

  const current = puzzles[index];
  const currentPuzzleId = current?.id ?? null;
  const completed = puzzles.length > 0 && index >= puzzles.length;
  const progress = puzzles.length ? Math.round((solvedIds.length / puzzles.length) * 100) : 0;
  const totalWidth = Math.max(CHIP_SIZE, tokens.length * SLOT_PITCH - GAP);
  const maxX = Math.max(0, (tokens.length - 1) * SLOT_PITCH);

  useEffect(() => {
    tokensRef.current = tokens;
  }, [tokens]);

  useEffect(() => {
    if (!current) return;
    setTokens(buildTokens(current));
    setFeedback({ kind: 'idle', message: '' });
    animatedPuzzleRef.current = null;
  }, [currentPuzzleId, current]);

  const answerString = tokens.map((token) => token.char).join('');

  const animateLayout = useCallback(
    (options?: { immediate?: boolean; excludeId?: string }) => {
      const gsap = initGSAP();
      const currentTokens = tokensRef.current;

      currentTokens.forEach((token, tokenIndex) => {
        const node = tokenRefs.current[token.id];
        if (!node || options?.excludeId === token.id) return;

        const targetX = tokenIndex * SLOT_PITCH;
        if (options?.immediate) {
          gsap.set(node, { x: targetX, y: 0, rotation: 0, zIndex: 2 });
        } else {
          gsap.to(node, {
            x: targetX,
            y: 0,
            rotation: 0,
            duration: 0.18,
            ease: 'power2.out',
            overwrite: 'auto',
          });
        }
      });
    },
    [],
  );

  useEffect(() => {
    if (!tokens.length) return;

    const isNewPuzzle = Boolean(currentPuzzleId && animatedPuzzleRef.current !== currentPuzzleId);
    animateLayout({ immediate: isNewPuzzle });

    if (!isNewPuzzle) return;

    const gsap = initGSAP();
    const nodes = tokens.map((token) => tokenRefs.current[token.id]).filter(Boolean);
    if (!nodes.length) return;

    gsap.fromTo(
      nodes,
      { y: 10, autoAlpha: 0, scale: 0.92 },
      { y: 0, autoAlpha: 1, scale: 1, duration: 0.2, stagger: 0.03, ease: 'power2.out' },
    );
    animatedPuzzleRef.current = currentPuzzleId;
  }, [currentPuzzleId, tokens, animateLayout]);

  const finalizeDrag = useCallback(
    (tokenId: string) => {
      const gsap = initGSAP();
      const drag = draggablesRef.current[tokenId];
      const node = tokenRefs.current[tokenId];
      if (!drag || !node) return;
      if (finalizeGuardRef.current[tokenId]) return;
      finalizeGuardRef.current[tokenId] = true;

      const currentOrder = tokensRef.current;
      const fromIndex = currentOrder.findIndex((token) => token.id === tokenId);
      if (fromIndex < 0) {
        finalizeGuardRef.current[tokenId] = false;
        return;
      }

      const snappedIndex = clamp(Math.round((drag.x ?? 0) / SLOT_PITCH), 0, currentOrder.length - 1);

      gsap.to(node, {
        scale: 1,
        y: 0,
        duration: 0.12,
        ease: 'power1.out',
        overwrite: 'auto',
      });

      if (snappedIndex !== fromIndex) {
        setTokens((prev) => moveItem(prev, fromIndex, snappedIndex));
        setFeedback({ kind: 'idle', message: '' });
      } else {
        gsap.to(node, {
          x: fromIndex * SLOT_PITCH,
          duration: 0.16,
          ease: 'power2.out',
          overwrite: 'auto',
          onComplete: () => {
            gsap.set(node, { zIndex: 2 });
          },
        });
      }
    },
    [],
  );

  useEffect(() => {
    const gsap = initGSAP();

    Object.values(draggablesRef.current).forEach((instance) => instance?.kill());
    draggablesRef.current = {};
    finalizeGuardRef.current = {};

    if (!current || feedback.kind === 'correct') {
      return;
    }

    const activeTokens = tokensRef.current;

    activeTokens.forEach((token) => {
      const node = tokenRefs.current[token.id];
      if (!node) return;

      const [instance] = Draggable.create(node, {
        type: 'x',
        inertia: true,
        zIndexBoost: false,
        edgeResistance: 0.88,
        dragResistance: 0.04,
        bounds: { minX: 0, maxX },
        cursor: 'grab',
        activeCursor: 'grabbing',
        liveSnap: {
          x: (value: number) => clamp(Math.round(value / SLOT_PITCH) * SLOT_PITCH, 0, maxX),
        },
        onPress: () => {
          finalizeGuardRef.current[token.id] = false;
          gsap.killTweensOf(node);
          gsap.set(node, { zIndex: 30 });
          gsap.to(node, { scale: 1.07, y: -6, duration: 0.12, ease: 'power2.out' });
        },
        onDrag: () => {
          const drag = draggablesRef.current[token.id];
          if (!drag) return;
          const targetIndex = clamp(Math.round((drag.x ?? 0) / SLOT_PITCH), 0, tokensRef.current.length - 1);
          const currentIndex = tokensRef.current.findIndex((item) => item.id === token.id);
          if (targetIndex !== currentIndex) {
            setTokens((prev) => moveItem(prev, currentIndex, targetIndex));
          } else {
            animateLayout({ excludeId: token.id });
          }
        },
        onRelease: () => {
          const drag = draggablesRef.current[token.id];
          if (!drag?.isThrowing) finalizeDrag(token.id);
        },
        onThrowUpdate: () => {
          const drag = draggablesRef.current[token.id];
          if (!drag) return;
          const targetIndex = clamp(Math.round((drag.x ?? 0) / SLOT_PITCH), 0, tokensRef.current.length - 1);
          const currentIndex = tokensRef.current.findIndex((item) => item.id === token.id);
          if (targetIndex !== currentIndex) {
            setTokens((prev) => moveItem(prev, currentIndex, targetIndex));
          } else {
            animateLayout({ excludeId: token.id });
          }
        },
        onThrowComplete: () => {
          finalizeDrag(token.id);
        },
      });

      draggablesRef.current[token.id] = instance;
    });

    return () => {
      Object.values(draggablesRef.current).forEach((instance) => instance?.kill());
      draggablesRef.current = {};
    };
  }, [currentPuzzleId, tokens.length, current, feedback.kind, maxX, animateLayout, finalizeDrag]);

  const handleShuffleLetters = () => {
    setTokens((prev) => shuffle(prev));
    setFeedback({ kind: 'idle', message: '' });
    const gsap = initGSAP();
    const nodes = tokens.map((token) => tokenRefs.current[token.id]).filter(Boolean);
    if (nodes.length) {
      gsap.fromTo(nodes, { rotation: -2, y: -4 }, { rotation: 0, y: 0, duration: 0.18, stagger: 0.015, ease: 'power2.out' });
    }
  };

  const submitGuess = () => {
    if (!current) return;

    if (answerString === current.answer) {
      setFeedback({ kind: 'correct', message: `Correct! ${current.displayAnswer}` });
      setSolvedIds((prev) => (prev.includes(current.id) ? prev : [...prev, current.id]));
      const gsap = initGSAP();
      const nodes = tokens.map((token) => tokenRefs.current[token.id]).filter(Boolean);
      if (nodes.length) {
        gsap.fromTo(nodes, { scale: 1 }, { scale: 1.06, yoyo: true, repeat: 1, duration: 0.1, stagger: 0.02, ease: 'power1.out' });
      }
      return;
    }

    setFeedback({ kind: 'wrong', message: 'Not quite. Drag letters to reorder them and try again.' });
    if (rowRef.current) {
      const gsap = initGSAP();
      gsap.fromTo(rowRef.current, { x: 0 }, { x: 6, yoyo: true, repeat: 3, duration: 0.05, ease: 'power1.inOut' });
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
          <p className="inline-flex rounded-full bg-lavender px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-black">
            Unscramble Complete
          </p>
          <h2 className="text-2xl font-semibold sm:text-3xl">
            Solved {solvedIds.length} / {puzzles.length} puzzles
          </h2>
          <p className="text-sm leading-6 text-[var(--text-muted)]">
            Replay to practice speed and letter pattern recognition.
          </p>
          <Button
            type="button"
            onClick={() => {
              setSolvedIds([]);
              setIndex(0);
            }}
          >
            Restart Unscramble
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
            <h2 className="text-xl font-semibold sm:text-2xl">Unscramble</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Drag letters to rearrange them. Throw motion snaps letters into place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border px-3 py-2 text-sm font-semibold" style={{ borderColor: 'var(--border)' }}>
              {index + 1} / {puzzles.length}
            </span>
            <span className="rounded-full bg-lavender px-3 py-2 text-sm font-semibold text-black">
              {progress}% solved
            </span>
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

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Drag to reorder letters</p>
              <p className="text-xs text-[var(--text-muted)]">Current guess: {answerString}</p>
            </div>
            <div className="overflow-x-auto pb-1">
              <div
                ref={rowRef}
                className="relative rounded-2xl border p-3"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--surface-elevated)',
                  width: `${totalWidth + 24}px`,
                  minWidth: '100%',
                  height: '86px',
                }}
              >
                <div
                  className="relative mx-auto"
                  style={{ width: `${totalWidth}px`, height: `${CHIP_SIZE}px` }}
                >
                  {tokens.map((token) => (
                    <button
                      key={token.id}
                      ref={(node) => {
                        tokenRefs.current[token.id] = node;
                      }}
                      type="button"
                      draggable={false}
                      data-letter-chip
                      className="absolute left-0 top-0 grid h-14 w-14 place-items-center rounded-2xl border text-lg font-semibold shadow-sm touch-none select-none"
                      style={{
                        borderColor: 'rgba(175,163,255,0.35)',
                        background: 'linear-gradient(135deg, rgba(175,163,255,0.16) 0%, rgba(127,178,255,0.14) 100%)',
                        color: 'var(--text)',
                        boxShadow: '0 8px 14px rgba(0,0,0,0.08)',
                      }}
                      title="Drag to reorder"
                    >
                      {token.char}
                    </button>
                  ))}
                </div>
              </div>
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
            <Button type="button" variant="ghost" onClick={handleShuffleLetters} disabled={feedback.kind === 'correct'}>
              Shuffle Letters
            </Button>
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
