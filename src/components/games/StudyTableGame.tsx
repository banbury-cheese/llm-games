'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';

import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import type { Term } from '@/types/study-set';

import type { GameComponentProps } from '@/components/games/types';

type SortKey = 'term' | 'definition';
type SortDirection = 'asc' | 'desc';
type CellKey = 'term' | 'definition';

type Row = {
  id: string;
  term: string;
  definition: string;
};

type RevealState = Record<string, { term: boolean; definition: boolean }>;

function normalizeRows(data: unknown, fallback: Term[]): Row[] {
  if (
    data &&
    typeof data === 'object' &&
    'rows' in data &&
    Array.isArray((data as { rows?: unknown[] }).rows)
  ) {
    const rows = (data as { rows: unknown[] }).rows
      .filter(
        (item): item is { term?: unknown; definition?: unknown; id?: unknown } =>
          !!item && typeof item === 'object',
      )
      .map((item, index) => ({
        id: typeof item.id === 'string' ? item.id : `${index + 1}`,
        term: typeof item.term === 'string' ? item.term : '',
        definition: typeof item.definition === 'string' ? item.definition : '',
      }))
      .filter((row) => row.term && row.definition);

    if (rows.length) return rows;
  }

  return fallback.map((term, index) => ({
    id: term.id || `${index + 1}`,
    term: term.term,
    definition: term.definition,
  }));
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildAlternatingReveal(rows: Row[]): RevealState {
  const next: RevealState = {};
  rows.forEach((row, index) => {
    next[row.id] = index % 2 === 0 ? { term: true, definition: false } : { term: false, definition: true };
  });
  return next;
}

function applyAllVisibility(rows: Row[], visible: boolean): RevealState {
  const next: RevealState = {};
  rows.forEach((row) => {
    next[row.id] = { term: visible, definition: visible };
  });
  return next;
}

function mergeRevealState(rows: Row[], prev: RevealState): RevealState {
  const next: RevealState = {};
  rows.forEach((row, index) => {
    next[row.id] = prev[row.id] ?? (index % 2 === 0 ? { term: true, definition: false } : { term: false, definition: true });
  });
  return next;
}

function hiddenCellStyles(column: CellKey) {
  if (column === 'term') {
    return {
      background: 'rgba(175, 163, 255, 0.22)',
      color: 'var(--text)',
      boxShadow: 'inset 0 0 0 1px rgba(175, 163, 255, 0.22)',
    };
  }

  return {
    background: 'rgba(127, 178, 255, 0.2)',
    color: 'var(--text)',
    boxShadow: 'inset 0 0 0 1px rgba(127, 178, 255, 0.2)',
  };
}

function visibleCellStyles() {
  return {
    background: 'var(--surface-elevated)',
    color: 'var(--text)',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)',
  };
}

function showBadgeStyles(column: CellKey) {
  return column === 'term'
    ? {
        background: 'linear-gradient(135deg, #afa3ff 0%, #7fb2ff 100%)',
        color: '#111',
        border: '1px solid rgba(17,17,17,0.12)',
      }
    : {
        background: 'linear-gradient(135deg, #7fb2ff 0%, #afa3ff 100%)',
        color: '#111',
        border: '1px solid rgba(17,17,17,0.12)',
      };
}

function ToolButton({
  label,
  onClick,
  active = false,
  subtle = false,
  title,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  subtle?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="rounded-md border px-3 py-2 text-sm font-medium transition"
      style={{
        borderColor: active ? 'rgba(127,178,255,0.55)' : 'var(--border)',
        background: active
          ? 'rgba(127,178,255,0.14)'
          : subtle
            ? 'transparent'
            : 'var(--surface-elevated)',
        color: 'var(--text)',
      }}
    >
      {label}
    </button>
  );
}

function HeaderCell({
  label,
  sortKey,
  activeSortKey,
  sortDirection,
  onSort,
  onHideColumn,
  onShowColumn,
}: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  sortDirection: SortDirection;
  onSort: () => void;
  onHideColumn: () => void;
  onShowColumn: () => void;
}) {
  const isActive = activeSortKey === sortKey;

  return (
    <div
      className="flex min-h-[88px] flex-col justify-between border-r p-3 last:border-r-0 sm:min-h-[96px] sm:p-4"
      style={{
        borderColor: 'var(--border)',
        background:
          sortKey === 'term'
            ? 'linear-gradient(180deg, rgba(175,163,255,0.12) 0%, var(--surface-elevated) 72%)'
            : 'linear-gradient(180deg, rgba(127,178,255,0.12) 0%, var(--surface-elevated) 72%)',
        color: 'var(--text)',
      }}
    >
      <button
        type="button"
        onClick={onSort}
        className="flex items-center justify-between gap-3 text-left"
        title={`Sort by ${label}`}
      >
        <span className="text-lg font-semibold leading-tight sm:text-xl">{label}</span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          {isActive ? (sortDirection === 'asc' ? 'A-Z' : 'Z-A') : 'Sort'}
          <span aria-hidden>▾</span>
        </span>
      </button>

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={onHideColumn}
          className="rounded border px-2 py-1 font-semibold hover:opacity-90"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          Hide
        </button>
        <button
          type="button"
          onClick={onShowColumn}
          className="rounded border px-2 py-1 font-semibold hover:opacity-90"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          Show
        </button>
      </div>
    </div>
  );
}

function ControlStrip({
  onHideAll,
  onShowAll,
  onShuffle,
  onResetPattern,
  onToggleHelp,
  helpOpen,
  compact = false,
}: {
  onHideAll: () => void;
  onShowAll: () => void;
  onShuffle: () => void;
  onResetPattern: () => void;
  onToggleHelp: () => void;
  helpOpen: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? 'justify-center' : ''}`}>
      <ToolButton label="Hide All" onClick={onHideAll} />
      <ToolButton label="Show All" onClick={onShowAll} />
      <ToolButton label="Shuffle" onClick={onShuffle} />
      <ToolButton label="Reset" onClick={onResetPattern} title="Restore alternating reveal pattern" />
      {!compact ? <ToolButton label={helpOpen ? 'Hide Help' : 'Help!'} onClick={onToggleHelp} subtle active={helpOpen} /> : null}
    </div>
  );
}

export function StudyTableGame({ studySet, data }: GameComponentProps) {
  const rows = useMemo(() => normalizeRows(data, studySet.terms), [data, studySet.terms]);

  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [sortKey, setSortKey] = useState<SortKey>('term');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [shuffledIds, setShuffledIds] = useState<string[]>([]);
  const [useShuffledOrder, setUseShuffledOrder] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [status, setStatus] = useState(
    'Tap any visible cell to hide it. Tap any accent "show" cell to reveal it.',
  );
  const [revealState, setRevealState] = useState<RevealState>({});

  useEffect(() => {
    setRevealState((prev) => mergeRevealState(rows, prev));
  }, [rows]);

  const filteredSortedRows = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    const filtered = normalizedQuery
      ? rows.filter(
          (row) =>
            row.term.toLowerCase().includes(normalizedQuery) ||
            row.definition.toLowerCase().includes(normalizedQuery),
        )
      : rows;

    return [...filtered].sort((a, b) => {
      const left = a[sortKey].toLowerCase();
      const right = b[sortKey].toLowerCase();
      const compare = left.localeCompare(right);
      return sortDirection === 'asc' ? compare : -compare;
    });
  }, [rows, deferredQuery, sortKey, sortDirection]);

  const displayRows = useMemo(() => {
    if (!useShuffledOrder || !shuffledIds.length) return filteredSortedRows;

    const byId = new Map(filteredSortedRows.map((row) => [row.id, row]));
    const ordered = shuffledIds.map((id) => byId.get(id)).filter((row): row is Row => Boolean(row));
    const orderedIds = new Set(ordered.map((row) => row.id));
    const leftovers = filteredSortedRows.filter((row) => !orderedIds.has(row.id));
    return [...ordered, ...leftovers];
  }, [filteredSortedRows, shuffledIds, useShuffledOrder]);

  const visibleCount = useMemo(() => {
    return rows.reduce((count, row) => {
      const state = revealState[row.id];
      if (!state) return count;
      return count + (state.term ? 1 : 0) + (state.definition ? 1 : 0);
    }, 0);
  }, [rows, revealState]);

  const totalCellCount = rows.length * 2;

  const setAllVisible = (visible: boolean) => {
    setRevealState(applyAllVisibility(rows, visible));
    setStatus(visible ? 'All cells revealed.' : 'All cells hidden. Use “show” to reveal one at a time.');
  };

  const setColumnVisible = (column: CellKey, visible: boolean) => {
    setRevealState((prev) => {
      const next: RevealState = {};
      rows.forEach((row, index) => {
        const existing = prev[row.id] ?? (index % 2 === 0 ? { term: true, definition: false } : { term: false, definition: true });
        next[row.id] = { ...existing, [column]: visible };
      });
      return next;
    });
    setStatus(`${column === 'term' ? 'Term' : 'Definition'} column ${visible ? 'shown' : 'hidden'}.`);
  };

  const applyRandomRevealPattern = (targetRows: Row[]) => {
    setRevealState((prev) => {
      const next: RevealState = { ...prev };
      targetRows.forEach((row) => {
        const revealTerm = Math.random() > 0.5;
        next[row.id] = { term: revealTerm, definition: !revealTerm };
      });
      return next;
    });
  };

  const handleShuffle = () => {
    const target = filteredSortedRows.length ? filteredSortedRows : rows;
    setShuffledIds(shuffle(target.map((row) => row.id)));
    setUseShuffledOrder(true);
    applyRandomRevealPattern(target);
    setStatus('Rows shuffled and reveal pattern randomized.');
  };

  const handleResetPattern = () => {
    const basis = useShuffledOrder ? displayRows : filteredSortedRows.length ? filteredSortedRows : rows;
    const patch = buildAlternatingReveal(basis.length ? basis : rows);
    setRevealState((prev) => ({ ...prev, ...patch }));
    setStatus('Alternating reveal pattern restored.');
  };

  const toggleSort = (key: SortKey) => {
    setUseShuffledOrder(false);
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setStatus(`Sorted by ${key} (${sortKey === key && sortDirection === 'asc' ? 'descending' : 'ascending'}).`);
  };

  const toggleCell = (rowId: string, column: CellKey) => {
    setRevealState((prev) => {
      const current = prev[rowId] ?? { term: true, definition: true };
      const nextVisible = !current[column];
      return {
        ...prev,
        [rowId]: {
          ...current,
          [column]: nextVisible,
        },
      };
    });
  };

  if (!rows.length) {
    return (
      <Card className="rounded-[28px] p-6 sm:p-8">
        <p className="text-sm text-[var(--text-muted)]">No rows available for Study Table.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold sm:text-2xl">Study Table</h2>
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              Reveal-table mode inspired by classic study grids. Hide/show cells, shuffle order, and practice recall.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border px-3 py-2 font-semibold" style={{ borderColor: 'var(--border)' }}>
              {displayRows.length} rows
            </span>
            <span className="rounded-full bg-sky px-3 py-2 font-semibold text-black">
              {visibleCount}/{totalCellCount} visible
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search states / capitals… (terms or definitions)"
          />
          <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
            <button
              type="button"
              onClick={() => setColumnVisible('term', false)}
              className="rounded-full border px-3 py-2 font-semibold"
              style={{ borderColor: 'var(--border)' }}
            >
              Hide Terms
            </button>
            <button
              type="button"
              onClick={() => setColumnVisible('term', true)}
              className="rounded-full border px-3 py-2 font-semibold"
              style={{ borderColor: 'var(--border)' }}
            >
              Show Terms
            </button>
            <button
              type="button"
              onClick={() => setColumnVisible('definition', false)}
              className="rounded-full border px-3 py-2 font-semibold"
              style={{ borderColor: 'var(--border)' }}
            >
              Hide Definitions
            </button>
            <button
              type="button"
              onClick={() => setColumnVisible('definition', true)}
              className="rounded-full border px-3 py-2 font-semibold"
              style={{ borderColor: 'var(--border)' }}
            >
              Show Definitions
            </button>
          </div>
        </div>
      </Card>

      <div
        className="grid-bg rounded-[30px] border p-4 sm:p-6"
        style={{
          borderColor: 'var(--border)',
          background:
            'radial-gradient(circle at 8% 12%, rgba(243,87,87,0.08), transparent 42%), radial-gradient(circle at 92% 8%, rgba(127,178,255,0.08), transparent 40%), radial-gradient(circle at 15% 92%, rgba(166,190,89,0.08), transparent 36%), var(--surface)',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-coral px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                Study Table
              </span>
              <span className="rounded-full bg-lavender px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-black">
                Reveal Mode
              </span>
            </div>
            <h3 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">{studySet.title}</h3>
            <p className="max-w-3xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">{status}</p>
          </div>

          <ControlStrip
            onHideAll={() => setAllVisible(false)}
            onShowAll={() => setAllVisible(true)}
            onShuffle={handleShuffle}
            onResetPattern={handleResetPattern}
            onToggleHelp={() => setShowHelp((prev) => !prev)}
            helpOpen={showHelp}
          />

          {showHelp ? (
            <div
              className="rounded-2xl border p-4 text-sm leading-6"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)', color: 'var(--text-muted)' }}
            >
              <p className="font-semibold text-[var(--text)]">How to use Study Table</p>
              <p className="mt-2">
                Accent cells are hidden and show a <strong className="text-[var(--text)]">show</strong> button. Click to reveal. Click any visible cell to hide it again. Use Shuffle to randomize row order and switch which side starts hidden.
              </p>
              <p className="mt-2">
                Click a column header to sort. Use the Hide/Show buttons under each header for column-wide practice.
              </p>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <div
              className="min-w-[640px] rounded-[18px] border-2 overflow-hidden"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--surface)',
                boxShadow: '0 12px 28px rgba(0,0,0,0.12)',
              }}
            >
              <div
                className="grid grid-cols-[minmax(210px,1fr)_minmax(210px,1fr)] border-b"
                style={{ borderColor: 'var(--border)' }}
              >
                <HeaderCell
                  label="Term"
                  sortKey="term"
                  activeSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={() => toggleSort('term')}
                  onHideColumn={() => setColumnVisible('term', false)}
                  onShowColumn={() => setColumnVisible('term', true)}
                />
                <HeaderCell
                  label="Definition"
                  sortKey="definition"
                  activeSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={() => toggleSort('definition')}
                  onHideColumn={() => setColumnVisible('definition', false)}
                  onShowColumn={() => setColumnVisible('definition', true)}
                />
              </div>

              {displayRows.map((row) => {
                const reveal = revealState[row.id] ?? { term: true, definition: true };
                const termHidden = !reveal.term;
                const definitionHidden = !reveal.definition;

                return (
                  <div
                    key={row.id}
                    className="grid grid-cols-[minmax(210px,1fr)_minmax(210px,1fr)] border-b last:border-b-0"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleCell(row.id, 'term')}
                      className="min-h-[72px] border-r px-4 py-3 text-left transition hover:brightness-[0.99] sm:min-h-[76px] sm:px-5"
                      style={{
                        borderColor: 'var(--border)',
                        ...(termHidden ? hiddenCellStyles('term') : visibleCellStyles()),
                      }}
                      title={termHidden ? 'Reveal term' : 'Hide term'}
                    >
                      {termHidden ? (
                        <span
                          className="inline-flex min-h-[44px] items-center justify-center rounded-full px-4 py-2 text-center text-lg font-semibold tracking-tight shadow-[0_6px_14px_rgba(0,0,0,0.08)] sm:text-xl"
                          style={showBadgeStyles('term')}
                        >
                          show
                        </span>
                      ) : (
                        <span className="block text-xl font-semibold tracking-tight sm:text-2xl">{row.term}</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleCell(row.id, 'definition')}
                      className="min-h-[72px] px-4 py-3 text-left transition hover:brightness-[0.99] sm:min-h-[76px] sm:px-5"
                      style={definitionHidden ? hiddenCellStyles('definition') : visibleCellStyles()}
                      title={definitionHidden ? 'Reveal definition' : 'Hide definition'}
                    >
                      {definitionHidden ? (
                        <span
                          className="inline-flex min-h-[44px] items-center justify-center rounded-full px-4 py-2 text-center text-lg font-semibold tracking-tight shadow-[0_6px_14px_rgba(0,0,0,0.08)] sm:text-xl"
                          style={showBadgeStyles('definition')}
                        >
                          show
                        </span>
                      ) : (
                        <span className="block text-base leading-6 text-[var(--text-muted)] sm:text-lg">{row.definition}</span>
                      )}
                    </button>
                  </div>
                );
              })}

              {!displayRows.length ? (
                <div className="px-6 py-8 text-center text-sm text-[var(--text-muted)]">No rows match “{query}”.</div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {useShuffledOrder ? 'Shuffle mode active' : 'Sorted mode active'}
            </div>
            <ControlStrip
              onHideAll={() => setAllVisible(false)}
              onShowAll={() => setAllVisible(true)}
              onShuffle={handleShuffle}
              onResetPattern={handleResetPattern}
              onToggleHelp={() => setShowHelp((prev) => !prev)}
              helpOpen={showHelp}
              compact
            />
          </div>
        </div>
      </div>
    </div>
  );
}
