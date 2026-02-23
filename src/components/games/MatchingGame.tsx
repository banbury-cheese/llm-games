'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Card } from '@/components/ui/Card';
import { initGSAP } from '@/lib/gsap';
import type { Term } from '@/types/study-set';

import type { GameComponentProps } from '@/components/games/types';

interface Pair {
  id: string;
  term: string;
  definition: string;
}

interface MatchLine {
  id: string;
  d: string;
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function normalizePairs(data: unknown, fallbackTerms: Term[]): Pair[] {
  if (
    data &&
    typeof data === 'object' &&
    'pairs' in data &&
    Array.isArray((data as { pairs?: unknown[] }).pairs)
  ) {
    const pairs = (data as { pairs: unknown[] }).pairs
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item, index) => ({
        id: typeof item.id === 'string' ? item.id : `${index + 1}`,
        term: typeof item.term === 'string' ? item.term : '',
        definition: typeof item.definition === 'string' ? item.definition : '',
      }))
      .filter((pair) => pair.term && pair.definition)
      .slice(0, 8);

    if (pairs.length >= 4) return pairs;
  }

  return fallbackTerms.slice(0, 8).map((term, index) => ({
    id: term.id || `${index + 1}`,
    term: term.term,
    definition: term.definition,
  }));
}

export function MatchingGame({ studySet, data }: GameComponentProps) {
  const pairs = useMemo(() => normalizePairs(data, studySet.terms), [data, studySet.terms]);
  const leftItems = useMemo(() => shuffle(pairs.map((pair) => ({ id: pair.id, label: pair.term }))), [pairs]);
  const rightItems = useMemo(() => shuffle(pairs.map((pair) => ({ id: pair.id, label: pair.definition }))), [pairs]);

  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [selectedRightId, setSelectedRightId] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState<string>('Select a term and a definition to match them.');
  const [lines, setLines] = useState<MatchLine[]>([]);

  const boardRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const rightRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const previousMatchedRef = useRef(0);

  const complete = matchedIds.length === pairs.length && pairs.length > 0;

  const animateSelection = (ids: string[], type: 'success' | 'error') => {
    const gsap = initGSAP();
    const nodes = ids
      .flatMap((id) => [leftRefs.current[id], rightRefs.current[id]])
      .filter((node): node is HTMLButtonElement => Boolean(node));

    if (!nodes.length) return;

    if (type === 'success') {
      gsap.fromTo(
        nodes,
        { scale: 0.98 },
        { scale: 1.02, yoyo: true, repeat: 1, duration: 0.12, ease: 'power1.out' },
      );
      return;
    }

    gsap.fromTo(nodes, { x: 0 }, { x: 6, duration: 0.06, yoyo: true, repeat: 3, ease: 'power1.inOut' });
  };

  const resolveAttempt = (leftId: string, rightId: string) => {
    setAttempts((prev) => prev + 1);

    if (leftId === rightId) {
      if (!matchedIds.includes(leftId)) {
        setMatchedIds((prev) => [...prev, leftId]);
        animateSelection([leftId], 'success');
      }
      setStatus('Nice match. Keep going.');
      window.setTimeout(() => {
        setSelectedLeftId(null);
        setSelectedRightId(null);
      }, 120);
      return;
    }

    animateSelection([leftId, rightId], 'error');
    setStatus('That pair does not match. Try again.');
    window.setTimeout(() => {
      setSelectedLeftId(null);
      setSelectedRightId(null);
    }, 320);
  };

  const handleLeftSelect = (id: string) => {
    if (matchedIds.includes(id)) return;
    setSelectedLeftId(id);
    if (selectedRightId) resolveAttempt(id, selectedRightId);
  };

  const handleRightSelect = (id: string) => {
    if (matchedIds.includes(id)) return;
    setSelectedRightId(id);
    if (selectedLeftId) resolveAttempt(selectedLeftId, id);
  };

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const recomputeLines = () => {
      const boardRect = board.getBoundingClientRect();
      const nextLines: MatchLine[] = matchedIds
        .map((id) => {
          const leftNode = leftRefs.current[id];
          const rightNode = rightRefs.current[id];
          if (!leftNode || !rightNode) return null;

          const leftRect = leftNode.getBoundingClientRect();
          const rightRect = rightNode.getBoundingClientRect();
          const x1 = leftRect.right - boardRect.left;
          const y1 = leftRect.top + leftRect.height / 2 - boardRect.top;
          const x2 = rightRect.left - boardRect.left;
          const y2 = rightRect.top + rightRect.height / 2 - boardRect.top;
          const curve = Math.max(28, Math.min(80, (x2 - x1) / 2));
          const d = `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`;
          return { id, d };
        })
        .filter((line): line is MatchLine => Boolean(line));

      setLines(nextLines);
    };

    const raf = window.requestAnimationFrame(recomputeLines);
    window.addEventListener('resize', recomputeLines);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', recomputeLines);
    };
  }, [matchedIds, leftItems, rightItems]);

  useEffect(() => {
    if (lines.length <= previousMatchedRef.current) {
      previousMatchedRef.current = lines.length;
      return;
    }

    const newestLine = lines[lines.length - 1];
    if (!newestLine) return;

    const gsap = initGSAP();
    const selector = `[data-match-line=\"${newestLine.id}\"]`;
    gsap.fromTo(
      selector,
      { strokeDasharray: 400, strokeDashoffset: 400 },
      { strokeDashoffset: 0, duration: 0.28, ease: 'power2.out' },
    );
    previousMatchedRef.current = lines.length;
  }, [lines]);

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">Matching</h2>
            <p className="text-sm text-[var(--text-muted)]">Match term cards to definitions. Correct pairs draw connector lines.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border px-3 py-2 font-semibold" style={{ borderColor: 'var(--border)' }}>
              {matchedIds.length}/{pairs.length} matched
            </span>
            <span className="rounded-full bg-peach px-3 py-2 font-semibold text-black">{attempts} attempts</span>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--border)' }}>
          {complete ? 'All matches complete.' : status}
        </div>
      </Card>

      <Card className="rounded-[28px] p-4 sm:p-5">
        <div ref={boardRef} className="relative">
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            {lines.map((line) => (
              <path
                key={line.id}
                data-match-line={line.id}
                d={line.d}
                fill="none"
                stroke="rgba(166,190,89,0.9)"
                strokeWidth={3}
                strokeLinecap="round"
              />
            ))}
          </svg>

          <div className="grid gap-3 md:grid-cols-[1fr_1fr] md:gap-5">
            <div className="space-y-2">
              <p className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Terms</p>
              {leftItems.map((item) => {
                const selected = selectedLeftId === item.id;
                const matched = matchedIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    ref={(node) => {
                      leftRefs.current[item.id] = node;
                    }}
                    type="button"
                    onClick={() => handleLeftSelect(item.id)}
                    disabled={matched}
                    className="flex w-full items-center rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition"
                    style={{
                      borderColor: matched
                        ? 'rgba(166,190,89,0.6)'
                        : selected
                          ? 'rgba(243,87,87,0.6)'
                          : 'var(--border)',
                      background: matched ? 'rgba(166,190,89,0.08)' : selected ? 'rgba(243,87,87,0.06)' : 'var(--surface)',
                      opacity: matched ? 0.85 : 1,
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <p className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Definitions</p>
              {rightItems.map((item) => {
                const selected = selectedRightId === item.id;
                const matched = matchedIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    ref={(node) => {
                      rightRefs.current[item.id] = node;
                    }}
                    type="button"
                    onClick={() => handleRightSelect(item.id)}
                    disabled={matched}
                    className="flex w-full items-center rounded-2xl border px-4 py-3 text-left text-sm leading-6 transition"
                    style={{
                      borderColor: matched
                        ? 'rgba(166,190,89,0.6)'
                        : selected
                          ? 'rgba(127,178,255,0.6)'
                          : 'var(--border)',
                      background: matched ? 'rgba(166,190,89,0.08)' : selected ? 'rgba(127,178,255,0.06)' : 'var(--surface)',
                      opacity: matched ? 0.85 : 1,
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
