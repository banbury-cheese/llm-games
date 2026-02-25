'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { generateLayout } from 'crossword-layout-generator';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { Term } from '@/types/study-set';

import type { GameComponentProps } from '@/components/games/types';

type Orientation = 'across' | 'down';

type SeedEntry = {
  id: string;
  answer: string;
  displayAnswer: string;
  clue: string;
};

type GeneratorInput = {
  clue: string;
  answer: string;
};

type GeneratorResultWord = {
  clue: string;
  answer: string;
  startx?: number;
  starty?: number;
  position?: number;
  orientation?: string;
};

type GeneratorLayout = {
  rows?: number;
  cols?: number;
  result?: GeneratorResultWord[];
};

type PlacedEntry = {
  id: string;
  number: number;
  answer: string;
  displayAnswer: string;
  clue: string;
  orientation: Orientation;
  row: number;
  col: number;
};

type CellMeta = {
  key: string;
  row: number;
  col: number;
  solution: string;
  number?: number;
  acrossId?: string;
  downId?: string;
};

type LayoutModel = {
  rows: number;
  cols: number;
  cellMap: Map<string, CellMeta>;
  placedEntries: PlacedEntry[];
};

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function cellKey(row: number, col: number) {
  return `${row}-${col}`;
}

function cleanLetters(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();
}

function normalizeSeeds(data: unknown, fallbackTerms: Term[]): SeedEntry[] {
  const fromData = data && typeof data === 'object' && 'entries' in data && Array.isArray((data as { entries?: unknown[] }).entries)
    ? (data as { entries: unknown[] }).entries
    : [];

  const raw = fromData.length
    ? fromData.map((item, index) => {
        const entry = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        const rawAnswer = typeof entry.answer === 'string'
          ? entry.answer
          : typeof entry.term === 'string'
            ? entry.term
            : '';
        return {
          id: typeof entry.id === 'string' ? entry.id : `entry-${index + 1}`,
          answer: cleanLetters(rawAnswer),
          displayAnswer: typeof entry.displayAnswer === 'string' ? entry.displayAnswer : rawAnswer,
          clue: typeof entry.clue === 'string'
            ? entry.clue
            : typeof entry.definition === 'string'
              ? entry.definition
              : '',
        } satisfies SeedEntry;
      })
    : fallbackTerms.map((term) => ({
        id: term.id,
        answer: cleanLetters(term.term),
        displayAnswer: term.term,
        clue: term.definition,
      }));

  const deduped = new Map<string, SeedEntry>();
  for (const entry of raw) {
    if (!entry.clue) continue;
    if (entry.answer.length < 3 || entry.answer.length > 12) continue;
    const key = `${entry.answer}::${entry.clue}`;
    if (!deduped.has(key)) deduped.set(key, entry);
  }

  return Array.from(deduped.values()).slice(0, 12);
}

function buildLayoutFromSeeds(seeds: SeedEntry[]): LayoutModel | null {
  if (!seeds.length) return null;

  let best: LayoutModel | null = null;
  const tries = Math.min(6, Math.max(2, seeds.length));

  for (let attempt = 0; attempt < tries; attempt += 1) {
    const ordered = attempt === 0 ? seeds : shuffle(seeds);
    const input: GeneratorInput[] = ordered.map((seed) => ({ clue: seed.clue, answer: seed.answer.toLowerCase() }));
    const generated = generateLayout(input) as GeneratorLayout;
    const result = Array.isArray(generated.result) ? generated.result : [];

    const seedBuckets = new Map<string, SeedEntry[]>();
    for (const seed of ordered) {
      const key = `${seed.answer.toLowerCase()}::${seed.clue}`;
      const bucket = seedBuckets.get(key) ?? [];
      bucket.push(seed);
      seedBuckets.set(key, bucket);
    }

    const placedEntries: PlacedEntry[] = [];

    for (const word of result) {
      const orientation = word.orientation === 'across' || word.orientation === 'down' ? word.orientation : null;
      if (!orientation) continue;
      if (typeof word.startx !== 'number' || typeof word.starty !== 'number' || typeof word.position !== 'number') continue;

      const key = `${cleanLetters(word.answer ?? '').toLowerCase()}::${word.clue ?? ''}`;
      const bucket = seedBuckets.get(key);
      const seed = bucket?.shift();
      if (!seed) continue;

      placedEntries.push({
        id: seed.id,
        number: word.position,
        answer: seed.answer,
        displayAnswer: seed.displayAnswer,
        clue: seed.clue,
        orientation,
        row: Math.max(0, word.starty - 1),
        col: Math.max(0, word.startx - 1),
      });
    }

    if (!placedEntries.length) continue;

    const cellMap = new Map<string, CellMeta>();
    let maxRow = 0;
    let maxCol = 0;

    for (const entry of placedEntries) {
      entry.answer.split('').forEach((letter, index) => {
        const row = entry.row + (entry.orientation === 'down' ? index : 0);
        const col = entry.col + (entry.orientation === 'across' ? index : 0);
        const key = cellKey(row, col);
        const existing = cellMap.get(key);

        if (existing && existing.solution !== letter) {
          return;
        }

        const nextCell: CellMeta = {
          key,
          row,
          col,
          solution: letter,
          number: index === 0 ? (existing?.number ?? entry.number) : existing?.number,
          acrossId: entry.orientation === 'across' ? entry.id : existing?.acrossId,
          downId: entry.orientation === 'down' ? entry.id : existing?.downId,
        };

        if (entry.orientation === 'across' && existing?.downId) nextCell.downId = existing.downId;
        if (entry.orientation === 'down' && existing?.acrossId) nextCell.acrossId = existing.acrossId;

        cellMap.set(key, nextCell);
        maxRow = Math.max(maxRow, row);
        maxCol = Math.max(maxCol, col);
      });
    }

    const connectedScore = Array.from(cellMap.values()).filter((cell) => cell.acrossId && cell.downId).length;
    const model: LayoutModel = {
      rows: Math.max(1, typeof generated.rows === 'number' ? generated.rows : maxRow + 1, maxRow + 1),
      cols: Math.max(1, typeof generated.cols === 'number' ? generated.cols : maxCol + 1, maxCol + 1),
      cellMap,
      placedEntries: placedEntries.sort((a, b) => (a.number - b.number) || a.orientation.localeCompare(b.orientation)),
    };

    if (!best) {
      best = model;
      continue;
    }

    const bestConnected = Array.from(best.cellMap.values()).filter((cell) => cell.acrossId && cell.downId).length;
    if (
      model.placedEntries.length > best.placedEntries.length ||
      (model.placedEntries.length === best.placedEntries.length && connectedScore > bestConnected)
    ) {
      best = model;
    }
  }

  return best;
}

function getEntryCellKey(entry: PlacedEntry, index: number) {
  const row = entry.row + (entry.orientation === 'down' ? index : 0);
  const col = entry.col + (entry.orientation === 'across' ? index : 0);
  return cellKey(row, col);
}

function getCellIndexInEntry(cell: CellMeta, entry: PlacedEntry) {
  return entry.orientation === 'across' ? cell.col - entry.col : cell.row - entry.row;
}

function keyToOrientation(key: string): Orientation | null {
  if (key === 'ArrowLeft' || key === 'ArrowRight') return 'across';
  if (key === 'ArrowUp' || key === 'ArrowDown') return 'down';
  return null;
}

function getArrowDelta(key: string) {
  if (key === 'ArrowLeft') return { dr: 0, dc: -1 };
  if (key === 'ArrowRight') return { dr: 0, dc: 1 };
  if (key === 'ArrowUp') return { dr: -1, dc: 0 };
  if (key === 'ArrowDown') return { dr: 1, dc: 0 };
  return null;
}

export function CrosswordGame({ studySet, data }: GameComponentProps) {
  const seeds = useMemo(() => normalizeSeeds(data, studySet.terms), [data, studySet.terms]);
  const layout = useMemo(() => buildLayoutFromSeeds(seeds), [seeds]);

  const [values, setValues] = useState<Record<string, string>>({});
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);
  const [direction, setDirection] = useState<Orientation>('across');
  const [status, setStatus] = useState('Fill intersecting clues with your keyboard. Click a clue or square to focus.');

  useEffect(() => {
    if (!layout || !layout.placedEntries.length) {
      setValues({});
      setSelectedCellKey(null);
      setDirection('across');
      setStatus('No valid crossword layout could be generated from this deck.');
      return;
    }

    const firstAcross = layout.placedEntries.find((entry) => entry.orientation === 'across');
    const firstEntry = firstAcross ?? layout.placedEntries[0];
    setValues({});
    setSelectedCellKey(firstEntry ? getEntryCellKey(firstEntry, 0) : null);
    setDirection(firstEntry?.orientation ?? 'across');
    setStatus('Fill intersecting clues with your keyboard. Click a clue or square to focus.');
  }, [layout]);

  const entryById = useMemo(() => {
    const map = new Map<string, PlacedEntry>();
    if (!layout) return map;
    layout.placedEntries.forEach((entry) => map.set(entry.id, entry));
    return map;
  }, [layout]);

  const selectedCell = selectedCellKey && layout ? layout.cellMap.get(selectedCellKey) ?? null : null;
  const resolvedDirection: Orientation = selectedCell
    ? direction === 'across'
      ? (selectedCell.acrossId ? 'across' : 'down')
      : (selectedCell.downId ? 'down' : 'across')
    : direction;

  const selectedEntry = selectedCell
    ? entryById.get((resolvedDirection === 'across' ? selectedCell.acrossId : selectedCell.downId) ?? '')
    : layout?.placedEntries[0] ?? null;

  const acrossEntries = useMemo(
    () => (layout?.placedEntries.filter((entry) => entry.orientation === 'across') ?? []),
    [layout],
  );
  const downEntries = useMemo(
    () => (layout?.placedEntries.filter((entry) => entry.orientation === 'down') ?? []),
    [layout],
  );

  const progressRows = useMemo(() => {
    if (!layout) return [] as Array<{ entry: PlacedEntry; filled: number; correct: boolean }>;
    return layout.placedEntries.map((entry) => {
      const keys = entry.answer.split('').map((_, index) => getEntryCellKey(entry, index));
      const filled = keys.filter((key) => (values[key] ?? '').length === 1).length;
      const correct = keys.every((key, index) => (values[key] ?? '') === entry.answer[index]);
      return { entry, filled, correct };
    });
  }, [layout, values]);

  const progressById = useMemo(() => new Map(progressRows.map((row) => [row.entry.id, row])), [progressRows]);
  const solvedCount = progressRows.filter((row) => row.correct).length;
  const complete = Boolean(layout?.placedEntries.length) && solvedCount === (layout?.placedEntries.length ?? 0);

  const focusEntry = (entry: PlacedEntry) => {
    setDirection(entry.orientation);
    setSelectedCellKey(getEntryCellKey(entry, 0));
    setStatus(`Focused ${entry.orientation} clue ${entry.number}.`);
  };

  const moveSelectionByArrow = useCallback((arrowKey: string) => {
    if (!layout || !selectedCell) return;
    const delta = getArrowDelta(arrowKey);
    const nextOrientation = keyToOrientation(arrowKey);
    if (!delta || !nextOrientation) return;

    const nextRow = selectedCell.row + delta.dr;
    const nextCol = selectedCell.col + delta.dc;
    const target = layout.cellMap.get(cellKey(nextRow, nextCol));
    if (!target) return;

    setSelectedCellKey(target.key);
    setDirection(target[nextOrientation === 'across' ? 'acrossId' : 'downId'] ? nextOrientation : (target.acrossId ? 'across' : 'down'));
  }, [layout, selectedCell]);

  useEffect(() => {
    if (!layout) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!selectedCell) return;

      if (event.key === 'Tab') return;

      if (event.key === ' ') {
        if (selectedCell.acrossId && selectedCell.downId) {
          event.preventDefault();
          setDirection((prev) => (prev === 'across' ? 'down' : 'across'));
          setStatus('Switched clue direction.');
        }
        return;
      }

      if (event.key.startsWith('Arrow')) {
        event.preventDefault();
        moveSelectionByArrow(event.key);
        return;
      }

      const activeEntry = selectedEntry;
      if (!activeEntry) return;
      const currentIndex = getCellIndexInEntry(selectedCell, activeEntry);

      if (event.key === 'Backspace') {
        event.preventDefault();
        const currentVal = values[selectedCell.key] ?? '';
        if (currentVal) {
          setValues((prev) => ({ ...prev, [selectedCell.key]: '' }));
          setStatus('Cleared current cell.');
          return;
        }

        const prevIndex = Math.max(0, currentIndex - 1);
        const prevKey = getEntryCellKey(activeEntry, prevIndex);
        setSelectedCellKey(prevKey);
        setValues((prev) => ({ ...prev, [prevKey]: '' }));
        setStatus('Moved back one cell.');
        return;
      }

      const char = event.key.toUpperCase();
      if (!/^[A-Z]$/.test(char)) return;

      event.preventDefault();
      setValues((prev) => ({ ...prev, [selectedCell.key]: char }));
      setStatus('Updated current cell.');

      const nextIndex = Math.min(activeEntry.answer.length - 1, currentIndex + 1);
      const nextKey = getEntryCellKey(activeEntry, nextIndex);
      setSelectedCellKey(nextKey);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [layout, moveSelectionByArrow, selectedCell, selectedEntry, values]);

  const revealEntry = (entry: PlacedEntry) => {
    setValues((prev) => {
      const next = { ...prev };
      entry.answer.split('').forEach((char, index) => {
        next[getEntryCellKey(entry, index)] = char;
      });
      return next;
    });
    setStatus(`Revealed ${entry.orientation} clue ${entry.number}.`);
  };

  const revealAll = () => {
    if (!layout) return;
    setValues((prev) => {
      const next = { ...prev };
      layout.placedEntries.forEach((entry) => {
        entry.answer.split('').forEach((char, index) => {
          next[getEntryCellKey(entry, index)] = char;
        });
      });
      return next;
    });
    setStatus('Revealed all answers.');
  };

  const clearGrid = () => {
    setValues({});
    setStatus('Cleared the grid.');
  };

  if (!layout || !layout.placedEntries.length) {
    return (
      <Card className="rounded-[28px] p-6">
        <p className="text-sm text-[var(--text-muted)]">No crossword entries available.</p>
      </Card>
    );
  }

  const totalCells = layout.rows * layout.cols;

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">Crossword</h2>
            <p className="text-sm text-[var(--text-muted)]">True intersecting crossword layout with across/down clues. Space toggles direction on intersections.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full border px-3 py-2 font-semibold" style={{ borderColor: 'var(--border)' }}>
              {solvedCount}/{layout.placedEntries.length} solved
            </span>
            <span className={`rounded-full px-3 py-2 font-semibold ${complete ? 'bg-olive text-black' : 'bg-sky text-black'}`}>
              {complete ? 'Complete' : 'In Progress'}
            </span>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>
          {status}
        </div>
      </Card>

      <Card className="rounded-[28px] p-4 sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] xl:items-start">
          <div className="overflow-x-auto">
            <div
              className="grid gap-1 rounded-2xl border p-3"
              style={{
                gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 2.35rem))`,
                borderColor: 'var(--border)',
                background: 'linear-gradient(135deg, rgba(127,178,255,0.05) 0%, rgba(175,163,255,0.04) 100%)',
                width: 'fit-content',
                minWidth: '100%',
              }}
            >
              {Array.from({ length: totalCells }).map((_, flatIndex) => {
                const row = Math.floor(flatIndex / layout.cols);
                const col = flatIndex % layout.cols;
                const key = cellKey(row, col);
                const cell = layout.cellMap.get(key);

                if (!cell) {
                  return (
                    <div
                      key={key}
                      className="h-9 w-9 rounded-md border"
                      style={{
                        borderColor: 'rgba(0,0,0,0.08)',
                        background: 'rgba(0,0,0,0.78)',
                        opacity: 0.88,
                      }}
                      aria-hidden
                    />
                  );
                }

                const isSelected = selectedCellKey === cell.key;
                const inSelectedEntry = Boolean(selectedEntry && ((selectedEntry.orientation === 'across' && cell.acrossId === selectedEntry.id) || (selectedEntry.orientation === 'down' && cell.downId === selectedEntry.id)));
                const expected = values[cell.key] ?? '';
                const isCorrectCell = expected.length === 1 && expected === cell.solution;
                const wrongFilled = expected.length === 1 && expected !== cell.solution;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (selectedCellKey === cell.key && cell.acrossId && cell.downId) {
                        setDirection((prev) => (prev === 'across' ? 'down' : 'across'));
                        return;
                      }
                      setSelectedCellKey(cell.key);
                      setDirection(cell.acrossId ? 'across' : 'down');
                    }}
                    className="relative h-9 w-9 rounded-md border text-center text-sm font-semibold uppercase transition"
                    style={{
                      borderColor: isSelected
                        ? 'rgba(243,87,87,0.65)'
                        : wrongFilled
                          ? 'rgba(243,87,87,0.4)'
                          : isCorrectCell
                            ? 'rgba(166,190,89,0.45)'
                            : inSelectedEntry
                              ? 'rgba(127,178,255,0.4)'
                              : 'var(--border)',
                      background: isSelected
                        ? 'rgba(243,87,87,0.10)'
                        : wrongFilled
                          ? 'rgba(243,87,87,0.08)'
                          : isCorrectCell
                            ? 'rgba(166,190,89,0.08)'
                            : inSelectedEntry
                              ? 'rgba(127,178,255,0.08)'
                              : 'var(--surface)',
                    }}
                    aria-label={`Crossword cell row ${row + 1} column ${col + 1}`}
                  >
                    {typeof cell.number === 'number' ? (
                      <span className="absolute left-1 top-0.5 text-[9px] font-semibold text-[var(--text-muted)]">{cell.number}</span>
                    ) : null}
                    <span>{expected}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Selected clue</p>
              {selectedEntry ? (
                <>
                  <p className="mt-2 text-sm font-semibold">
                    {selectedEntry.number}. {selectedEntry.clue}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {selectedEntry.orientation.toUpperCase()} · {selectedEntry.answer.length} letters
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-[var(--text-muted)]">Select a clue or cell.</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => (selectedEntry ? revealEntry(selectedEntry) : undefined)} disabled={!selectedEntry}>
                  Reveal Clue
                </Button>
                <Button type="button" variant="ghost" onClick={clearGrid}>Clear Grid</Button>
                <Button type="button" variant="ghost" onClick={revealAll}>Reveal All</Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Across Clues</p>
                <div className="mt-3 space-y-2">
                  {acrossEntries.length ? acrossEntries.map((entry) => {
                    const progress = progressById.get(entry.id);
                    const isSelected = selectedEntry?.id === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => focusEntry(entry)}
                        className="w-full rounded-xl border px-3 py-3 text-left text-sm transition"
                        style={{
                          borderColor: isSelected ? 'rgba(127,178,255,0.55)' : 'var(--border)',
                          background: progress?.correct
                            ? 'rgba(166,190,89,0.08)'
                            : isSelected
                              ? 'rgba(127,178,255,0.08)'
                              : 'transparent',
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{entry.number}. {entry.clue}</span>
                          <span className="text-xs text-[var(--text-muted)]">{progress?.filled ?? 0}/{entry.answer.length}</span>
                        </div>
                      </button>
                    );
                  }) : <p className="text-sm text-[var(--text-muted)]">No across clues in this layout.</p>}
                </div>
              </div>

              <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Down Clues</p>
                <div className="mt-3 space-y-2">
                  {downEntries.length ? downEntries.map((entry) => {
                    const progress = progressById.get(entry.id);
                    const isSelected = selectedEntry?.id === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => focusEntry(entry)}
                        className="w-full rounded-xl border px-3 py-3 text-left text-sm transition"
                        style={{
                          borderColor: isSelected ? 'rgba(175,163,255,0.55)' : 'var(--border)',
                          background: progress?.correct
                            ? 'rgba(166,190,89,0.08)'
                            : isSelected
                              ? 'rgba(175,163,255,0.08)'
                              : 'transparent',
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{entry.number}. {entry.clue}</span>
                          <span className="text-xs text-[var(--text-muted)]">{progress?.filled ?? 0}/{entry.answer.length}</span>
                        </div>
                      </button>
                    );
                  }) : <p className="text-sm text-[var(--text-muted)]">No down clues in this layout.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
