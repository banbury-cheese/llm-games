'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { initGSAP } from '@/lib/gsap';
import type { Term } from '@/types/study-set';

import type { GameComponentProps } from '@/components/games/types';

type ChunkPuzzle = {
  id: string;
  answer: string;
  displayAnswer: string;
  clue: string;
  chunks: string[];
};

type ChunkToken = {
  id: string;
  text: string;
  puzzleId: string;
};

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function cleanLetters(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();
}

function splitIntoChunks(answer: string, seed: number) {
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < answer.length) {
    const remaining = answer.length - cursor;
    if (remaining <= 3) {
      chunks.push(answer.slice(cursor));
      break;
    }
    const width = ((seed + cursor) % 2) + 2;
    chunks.push(answer.slice(cursor, cursor + Math.min(width, remaining - 2)));
    cursor += Math.min(width, remaining - 2);
  }
  return chunks.filter(Boolean);
}

function normalizeChunksForAnswer(rawChunks: unknown, answer: string, seed: number) {
  if (!Array.isArray(rawChunks)) return splitIntoChunks(answer, seed);

  const cleaned = rawChunks
    .filter((chunk): chunk is string => typeof chunk === 'string')
    .map(cleanLetters)
    .filter(Boolean);

  // LLM output can include invalid chunk sets (missing letters, wrong order, duplicates).
  // Fall back to a deterministic split so every clue is always solvable.
  if (cleaned.length >= 2 && cleaned.join('') === answer) {
    return cleaned;
  }

  return splitIntoChunks(answer, seed);
}

function normalizePuzzles(data: unknown, fallbackTerms: Term[]): ChunkPuzzle[] {
  if (data && typeof data === 'object' && 'puzzles' in data && Array.isArray((data as { puzzles?: unknown[] }).puzzles)) {
    const puzzles = (data as { puzzles: unknown[] }).puzzles
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item, index) => {
        const rawAnswer = typeof item.answer === 'string' ? item.answer : typeof item.term === 'string' ? item.term : '';
        const answer = cleanLetters(rawAnswer);
        const chunks = normalizeChunksForAnswer(item.chunks, answer, index);
        return {
          id: typeof item.id === 'string' ? item.id : `${index + 1}`,
          answer,
          displayAnswer: typeof item.displayAnswer === 'string' ? item.displayAnswer : rawAnswer,
          clue: typeof item.clue === 'string' ? item.clue : typeof item.definition === 'string' ? item.definition : '',
          chunks,
        };
      })
      .filter((puzzle) => puzzle.answer.length >= 4 && puzzle.chunks.length >= 2 && puzzle.clue)
      .slice(0, 8);

    if (puzzles.length) return puzzles;
  }

  return fallbackTerms
    .map((term, index) => {
      const answer = cleanLetters(term.term);
      return {
        id: term.id,
        answer,
        displayAnswer: term.term,
        clue: term.definition,
        chunks: splitIntoChunks(answer, index),
      };
    })
    .filter((puzzle) => puzzle.answer.length >= 4 && puzzle.answer.length <= 14 && puzzle.chunks.length >= 2)
    .slice(0, 8);
}

function buildChunkPool(puzzles: ChunkPuzzle[]) {
  return shuffle(
    puzzles.flatMap((puzzle, puzzleIndex) =>
      puzzle.chunks.map((text, chunkIndex) => ({
        id: `${puzzle.id}-${puzzleIndex}-${chunkIndex}`,
        text,
        puzzleId: puzzle.id,
      })),
    ),
  );
}

export function ChoppedGame({ studySet, data }: GameComponentProps) {
  const puzzles = useMemo(() => normalizePuzzles(data, studySet.terms), [data, studySet.terms]);
  const [pool, setPool] = useState<ChunkToken[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [solvedAnswers, setSolvedAnswers] = useState<Record<string, string>>({});
  const [activePuzzleId, setActivePuzzleId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'idle' | 'correct' | 'wrong'; message: string }>({ kind: 'idle', message: '' });

  const chunkRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const composeRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPool(buildChunkPool(puzzles));
    setSelectedIds([]);
    setSolvedAnswers({});
    setFeedback({ kind: 'idle', message: '' });
    setActivePuzzleId(puzzles[0]?.id ?? null);
  }, [puzzles]);

  useEffect(() => {
    if (!pool.length) return;
    const gsap = initGSAP();
    const nodes = pool.map((token) => chunkRefs.current[token.id]).filter(Boolean);
    if (!nodes.length) return;
    gsap.fromTo(nodes, { y: 8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.18, stagger: 0.015, ease: 'power2.out' });
  }, [pool]);

  const selectedTokens = selectedIds
    .map((id) => pool.find((token) => token.id === id))
    .filter((token): token is ChunkToken => Boolean(token));
  const assembledGuess = selectedTokens.map((token) => token.text).join('');

  const activePuzzle = puzzles.find((puzzle) => puzzle.id === activePuzzleId) ?? puzzles.find((puzzle) => !solvedAnswers[puzzle.id]) ?? null;
  const solvedCount = Object.keys(solvedAnswers).length;
  const progress = puzzles.length ? Math.round((solvedCount / puzzles.length) * 100) : 0;
  const complete = puzzles.length > 0 && solvedCount === puzzles.length;

  const nextUnsolvedId = () => puzzles.find((puzzle) => !solvedAnswers[puzzle.id])?.id ?? null;

  const pulseChunk = (id: string, color: 'good' | 'bad') => {
    const node = chunkRefs.current[id];
    if (!node) return;
    const gsap = initGSAP();
    gsap.fromTo(
      node,
      { scale: 1 },
      {
        scale: color === 'good' ? 1.08 : 0.96,
        yoyo: true,
        repeat: 1,
        duration: 0.12,
        ease: 'power1.out',
      },
    );
  };

  const selectChunk = (id: string) => {
    if (!activePuzzle || complete) return;
    if (selectedIds.includes(id)) return;
    setSelectedIds((prev) => [...prev, id]);
    setFeedback({ kind: 'idle', message: '' });
    pulseChunk(id, 'good');
  };

  const removeSelected = (id: string) => {
    setSelectedIds((prev) => prev.filter((currentId) => currentId !== id));
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setFeedback({ kind: 'idle', message: '' });
  };

  const checkGuess = () => {
    if (!activePuzzle || !selectedIds.length) return;

    if (assembledGuess === activePuzzle.answer) {
      setSolvedAnswers((prev) => ({ ...prev, [activePuzzle.id]: activePuzzle.displayAnswer || activePuzzle.answer }));
      setPool((prev) => prev.filter((token) => !selectedIds.includes(token.id)));
      setSelectedIds([]);
      setFeedback({ kind: 'correct', message: `Nice. ${activePuzzle.displayAnswer || activePuzzle.answer} is correct.` });

      const gsap = initGSAP();
      if (composeRef.current) {
        gsap.fromTo(composeRef.current, { scale: 0.99 }, { scale: 1.01, yoyo: true, repeat: 1, duration: 0.14, ease: 'power1.out' });
      }
      if (tableRef.current) {
        gsap.fromTo(tableRef.current, { y: 0 }, { y: -2, yoyo: true, repeat: 1, duration: 0.1, ease: 'power1.out' });
      }

      window.setTimeout(() => {
        setActivePuzzleId((prev) => {
          const solvedSnapshot = { ...solvedAnswers, [activePuzzle.id]: activePuzzle.displayAnswer || activePuzzle.answer };
          return puzzles.find((puzzle) => !solvedSnapshot[puzzle.id])?.id ?? prev;
        });
      }, 0);
      return;
    }

    setFeedback({ kind: 'wrong', message: 'Not quite. Try a different chunk combination for this clue.' });
    const gsap = initGSAP();
    if (composeRef.current) {
      gsap.fromTo(composeRef.current, { x: 0 }, { x: 6, yoyo: true, repeat: 3, duration: 0.05, ease: 'power1.inOut' });
    }
    selectedIds.forEach((id) => pulseChunk(id, 'bad'));
  };

  const giveUp = () => {
    setSolvedAnswers(
      Object.fromEntries(puzzles.map((puzzle) => [puzzle.id, puzzle.displayAnswer || puzzle.answer])),
    );
    setPool([]);
    setSelectedIds([]);
    setFeedback({ kind: 'wrong', message: 'Answers revealed. You can restart to try again.' });
  };

  if (!puzzles.length) {
    return (
      <Card className="rounded-[28px] p-6">
        <p className="text-sm text-[var(--text-muted)]">No chunk puzzles available for Chopped.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">Chopped</h2>
            <p className="text-sm text-[var(--text-muted)]">Combine word chunks to solve clues. Each chunk can be used once.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border px-3 py-2 font-semibold" style={{ borderColor: 'var(--border)' }}>
              {solvedCount}/{puzzles.length} solved
            </span>
            <span className="rounded-full bg-olive px-3 py-2 font-semibold text-black">{progress}%</span>
          </div>
        </div>
      </Card>

      <Card className="rounded-[28px] p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-4">
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Chunk bank</p>
                <p className="text-xs text-[var(--text-muted)]">{pool.length} chunks left</p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
                {pool.map((token) => {
                  const selected = selectedIds.includes(token.id);
                  return (
                    <button
                      key={token.id}
                      ref={(node) => {
                        chunkRefs.current[token.id] = node;
                      }}
                      type="button"
                      onClick={() => (selected ? removeSelected(token.id) : selectChunk(token.id))}
                      disabled={Boolean(solvedAnswers[token.puzzleId]) || complete}
                      className="rounded-xl border px-3 py-3 text-center text-sm font-semibold transition"
                      style={{
                        borderColor: selected ? 'rgba(127,178,255,0.55)' : 'var(--border)',
                        background: selected ? 'rgba(127,178,255,0.12)' : 'var(--surface)',
                        opacity: solvedAnswers[token.puzzleId] ? 0.5 : 1,
                      }}
                    >
                      {token.text}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div
              ref={composeRef}
              className="rounded-2xl border p-4 sm:p-5"
              style={{
                borderColor: 'rgba(127,178,255,0.35)',
                background: 'linear-gradient(135deg, rgba(127,178,255,0.10) 0%, rgba(175,163,255,0.08) 100%)',
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Active clue</p>
              {activePuzzle ? (
                <>
                  <p className="mt-2 text-base font-semibold sm:text-lg">{activePuzzle.clue}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{activePuzzle.answer.length} letters</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-[var(--text-muted)]">All clues solved.</p>
              )}

              <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Current guess</p>
                <p className="mt-2 min-h-8 break-words text-xl font-semibold tracking-[0.08em]">
                  {assembledGuess || '—'}
                </p>
              </div>

              {feedback.kind !== 'idle' ? (
                <div
                  className="mt-3 rounded-xl border px-3 py-2 text-sm"
                  style={{
                    borderColor: feedback.kind === 'correct' ? 'rgba(166,190,89,0.5)' : 'rgba(243,87,87,0.4)',
                    background: feedback.kind === 'correct' ? 'rgba(166,190,89,0.08)' : 'rgba(243,87,87,0.08)',
                  }}
                >
                  {feedback.message}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={checkGuess} disabled={!activePuzzle || !selectedIds.length || complete}>
                  Check Guess
                </Button>
                <Button type="button" variant="ghost" onClick={clearSelection} disabled={!selectedIds.length}>
                  Clear
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setActivePuzzleId(nextUnsolvedId())}
                  disabled={complete}
                >
                  Next Clue
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 px-1">
              <button type="button" onClick={giveUp} className="text-sm text-[var(--text-muted)] underline-offset-4 hover:underline">
                give up
              </button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPool(buildChunkPool(puzzles));
                  setSolvedAnswers({});
                  setSelectedIds([]);
                  setFeedback({ kind: 'idle', message: '' });
                  setActivePuzzleId(puzzles[0]?.id ?? null);
                }}
              >
                Restart
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="rounded-[28px] p-4 sm:p-5">
        <div ref={tableRef} className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                <th className="border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>Word</th>
                <th className="border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>Clue</th>
                <th className="border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>Answer</th>
              </tr>
            </thead>
            <tbody>
              {puzzles.map((puzzle) => {
                const solved = Boolean(solvedAnswers[puzzle.id]);
                const active = activePuzzleId === puzzle.id && !solved;
                return (
                  <tr key={puzzle.id}>
                    <td className="border px-3 py-2 align-top" style={{ borderColor: 'var(--border)' }}>{puzzle.answer.length} letters</td>
                    <td className="border px-3 py-2 align-top" style={{ borderColor: 'var(--border)' }}>
                      <button
                        type="button"
                        onClick={() => setActivePuzzleId(puzzle.id)}
                        className="text-left hover:underline"
                        style={{ color: active ? 'var(--text)' : 'inherit' }}
                      >
                        {puzzle.clue}
                      </button>
                    </td>
                    <td
                      className="border px-3 py-2 align-top font-semibold"
                      style={{
                        borderColor: 'var(--border)',
                        background: solved ? 'rgba(166,190,89,0.08)' : active ? 'rgba(127,178,255,0.06)' : 'transparent',
                        color: solved ? 'var(--text)' : 'var(--text-muted)',
                      }}
                    >
                      {solved ? solvedAnswers[puzzle.id] : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
