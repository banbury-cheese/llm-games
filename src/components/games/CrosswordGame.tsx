'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { Term } from '@/types/study-set';

import type { GameComponentProps } from '@/components/games/types';

type Entry = {
  id: string;
  number: number;
  answer: string;
  displayAnswer: string;
  clue: string;
  row: number;
  col: number;
};

type CellMeta = {
  key: string;
  row: number;
  col: number;
  entryId: string;
  indexInEntry: number;
  solution: string;
  number?: number;
};

function cleanLetters(value: string) {
  return value.replace(/[^a-zA-Z]/g, '').toUpperCase();
}

function normalizeEntries(data: unknown, fallbackTerms: Term[]): Entry[] {
  if (data && typeof data === 'object' && 'entries' in data && Array.isArray((data as { entries?: unknown[] }).entries)) {
    const parsed = (data as { entries: unknown[] }).entries
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item, index) => {
        const rawAnswer = typeof item.answer === 'string' ? item.answer : typeof item.term === 'string' ? item.term : '';
        return {
          id: typeof item.id === 'string' ? item.id : `${index + 1}`,
          number: index + 1,
          answer: cleanLetters(rawAnswer),
          displayAnswer: typeof item.displayAnswer === 'string' ? item.displayAnswer : rawAnswer,
          clue: typeof item.clue === 'string' ? item.clue : typeof item.definition === 'string' ? item.definition : '',
          row: Math.max(0, index * 2),
          col: (index * 2) % 5,
        };
      })
      .filter((entry) => entry.answer.length >= 3 && entry.answer.length <= 10 && entry.clue)
      .slice(0, 8);

    if (parsed.length) return parsed;
  }

  return fallbackTerms
    .map((term, index) => ({
      id: term.id,
      number: index + 1,
      answer: cleanLetters(term.term),
      displayAnswer: term.term,
      clue: term.definition,
      row: index * 2,
      col: (index * 2) % 5,
    }))
    .filter((entry) => entry.answer.length >= 3 && entry.answer.length <= 10)
    .slice(0, 8);
}

export function CrosswordGame({ studySet, data }: GameComponentProps) {
  const entries = useMemo(() => normalizeEntries(data, studySet.terms), [data, studySet.terms]);

  const layout = useMemo(() => {
    const cellMap = new Map<string, CellMeta>();
    let maxCol = 0;
    let maxRow = 0;

    entries.forEach((entry) => {
      entry.answer.split('').forEach((char, indexInEntry) => {
        const row = entry.row;
        const col = entry.col + indexInEntry;
        const key = `${row}-${col}`;
        cellMap.set(key, {
          key,
          row,
          col,
          entryId: entry.id,
          indexInEntry,
          solution: char,
          number: indexInEntry === 0 ? entry.number : undefined,
        });
        maxCol = Math.max(maxCol, col);
        maxRow = Math.max(maxRow, row);
      });
    });

    return {
      cellMap,
      rows: maxRow + 1,
      cols: maxCol + 1,
    };
  }, [entries]);

  const allCells = useMemo(() => Array.from(layout.cellMap.values()), [layout.cellMap]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(allCells[0]?.key ?? null);
  const [status, setStatus] = useState('Fill the grid using the clues. Use arrow keys to move between entries.');

  useEffect(() => {
    setValues({});
    setSelectedCellKey(allCells[0]?.key ?? null);
    setStatus('Fill the grid using the clues. Use arrow keys to move between entries.');
  }, [entries, allCells]);

  const selectedCell = selectedCellKey ? layout.cellMap.get(selectedCellKey) ?? null : null;
  const selectedEntry = selectedCell ? entries.find((entry) => entry.id === selectedCell.entryId) ?? null : entries[0] ?? null;

  const entryProgress = useMemo(() => {
    return entries.map((entry) => {
      const cells = entry.answer.split('').map((_, indexInEntry) => layout.cellMap.get(`${entry.row}-${entry.col + indexInEntry}`)).filter(Boolean) as CellMeta[];
      const filled = cells.filter((cell) => (values[cell.key] ?? '').length === 1).length;
      const correct = cells.every((cell) => (values[cell.key] ?? '') === cell.solution);
      return { entry, cells, filled, correct };
    });
  }, [entries, layout.cellMap, values]);

  const solvedCount = entryProgress.filter((row) => row.correct).length;
  const complete = entries.length > 0 && solvedCount === entries.length;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!selectedCell) return;
      const selectedEntryLocal = entries.find((entry) => entry.id === selectedCell.entryId);
      if (!selectedEntryLocal) return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        const nextIndex = Math.min(selectedEntryLocal.answer.length - 1, selectedCell.indexInEntry + 1);
        setSelectedCellKey(`${selectedEntryLocal.row}-${selectedEntryLocal.col + nextIndex}`);
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        const nextIndex = Math.max(0, selectedCell.indexInEntry - 1);
        setSelectedCellKey(`${selectedEntryLocal.row}-${selectedEntryLocal.col + nextIndex}`);
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const currentEntryIndex = entries.findIndex((entry) => entry.id === selectedEntryLocal.id);
        if (currentEntryIndex < 0) return;
        const nextEntryIndex = event.key === 'ArrowDown'
          ? Math.min(entries.length - 1, currentEntryIndex + 1)
          : Math.max(0, currentEntryIndex - 1);
        const nextEntry = entries[nextEntryIndex];
        const nextPos = Math.min(selectedCell.indexInEntry, nextEntry.answer.length - 1);
        setSelectedCellKey(`${nextEntry.row}-${nextEntry.col + nextPos}`);
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        setValues((prev) => ({ ...prev, [selectedCell.key]: '' }));
        setStatus('Updated current cell.');
        return;
      }
      if (event.key === 'Tab') {
        return;
      }

      const char = event.key.toUpperCase();
      if (/^[A-Z]$/.test(char)) {
        event.preventDefault();
        setValues((prev) => ({ ...prev, [selectedCell.key]: char }));
        const nextIndex = Math.min(selectedEntryLocal.answer.length - 1, selectedCell.indexInEntry + 1);
        setSelectedCellKey(`${selectedEntryLocal.row}-${selectedEntryLocal.col + nextIndex}`);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [entries, selectedCell]);

  const revealEntry = (entry: Entry) => {
    setValues((prev) => {
      const next = { ...prev };
      entry.answer.split('').forEach((char, indexInEntry) => {
        next[`${entry.row}-${entry.col + indexInEntry}`] = char;
      });
      return next;
    });
    setStatus(`Revealed entry ${entry.number}.`);
  };

  const revealAll = () => {
    setValues((prev) => {
      const next = { ...prev };
      entries.forEach((entry) => {
        entry.answer.split('').forEach((char, indexInEntry) => {
          next[`${entry.row}-${entry.col + indexInEntry}`] = char;
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

  if (!entries.length) {
    return (
      <Card className="rounded-[28px] p-6">
        <p className="text-sm text-[var(--text-muted)]">No crossword entries available.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">Crossword</h2>
            <p className="text-sm text-[var(--text-muted)]">Crossword-style clue grid with keyboard navigation. (Across-focused MVP)</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full border px-3 py-2 font-semibold" style={{ borderColor: 'var(--border)' }}>
              {solvedCount}/{entries.length} solved
            </span>
            <span className="rounded-full bg-sky px-3 py-2 font-semibold text-black">{complete ? 'Complete' : 'In Progress'}</span>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>
          {status}
        </div>
      </Card>

      <Card className="rounded-[28px] p-4 sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] xl:items-start">
          <div className="overflow-x-auto">
            <div
              className="grid gap-1 rounded-2xl border p-3"
              style={{
                gridTemplateColumns: `repeat(${Math.max(layout.cols, 8)}, minmax(0, 2.2rem))`,
                borderColor: 'var(--border)',
                background: 'var(--surface-elevated)',
                width: 'fit-content',
                minWidth: '100%',
              }}
            >
              {Array.from({ length: Math.max(layout.rows, 1) * Math.max(layout.cols, 8) }).map((_, flatIndex) => {
                const row = Math.floor(flatIndex / Math.max(layout.cols, 8));
                const col = flatIndex % Math.max(layout.cols, 8);
                const key = `${row}-${col}`;
                const cell = layout.cellMap.get(key);

                if (!cell) {
                  return <div key={key} className="h-9 w-9 rounded-md" aria-hidden />;
                }

                const isSelected = selectedCellKey === cell.key;
                const isCorrect = (values[cell.key] ?? '') === cell.solution && (values[cell.key] ?? '').length === 1;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedCellKey(cell.key)}
                    className="relative h-9 w-9 rounded-md border text-center text-sm font-semibold uppercase transition"
                    style={{
                      borderColor: isSelected ? 'rgba(243,87,87,0.65)' : isCorrect ? 'rgba(166,190,89,0.55)' : 'var(--border)',
                      background: isSelected ? 'rgba(243,87,87,0.08)' : isCorrect ? 'rgba(166,190,89,0.08)' : 'var(--surface)',
                    }}
                  >
                    {typeof cell.number === 'number' ? (
                      <span className="absolute left-1 top-0.5 text-[9px] font-semibold text-[var(--text-muted)]">{cell.number}</span>
                    ) : null}
                    <span>{values[cell.key] ?? ''}</span>
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
                  <p className="mt-2 text-sm font-semibold">{selectedEntry.number}. {selectedEntry.clue}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{selectedEntry.answer.length} letters</p>
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

            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Across Clues</p>
              <div className="mt-3 space-y-2">
                {entryProgress.map((row) => {
                  const isSelected = row.entry.id === selectedEntry?.id;
                  return (
                    <button
                      key={row.entry.id}
                      type="button"
                      onClick={() => setSelectedCellKey(`${row.entry.row}-${row.entry.col}`)}
                      className="w-full rounded-xl border px-3 py-3 text-left text-sm transition"
                      style={{
                        borderColor: isSelected ? 'rgba(127,178,255,0.55)' : 'var(--border)',
                        background: row.correct
                          ? 'rgba(166,190,89,0.08)'
                          : isSelected
                            ? 'rgba(127,178,255,0.08)'
                            : 'transparent',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{row.entry.number}. {row.entry.clue}</span>
                        <span className="text-xs text-[var(--text-muted)]">{row.filled}/{row.entry.answer.length}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
