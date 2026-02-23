'use client';

import { useDeferredValue, useMemo, useState } from 'react';

import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import type { Term } from '@/types/study-set';

import type { GameComponentProps } from '@/components/games/types';

type SortKey = 'term' | 'definition';
type SortDirection = 'asc' | 'desc';

function normalizeRows(data: unknown, fallback: Term[]) {
  if (
    data &&
    typeof data === 'object' &&
    'rows' in data &&
    Array.isArray((data as { rows?: unknown[] }).rows)
  ) {
    const rows = (data as { rows: unknown[] }).rows
      .filter((item): item is { term?: unknown; definition?: unknown; id?: unknown } => !!item && typeof item === 'object')
      .map((item, index) => ({
        id: typeof item.id === 'string' ? item.id : `${index + 1}`,
        term: typeof item.term === 'string' ? item.term : '',
        definition: typeof item.definition === 'string' ? item.definition : '',
      }))
      .filter((row) => row.term && row.definition);

    if (rows.length) return rows;
  }

  return fallback;
}

export function StudyTableGame({ studySet, data }: GameComponentProps) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('term');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const deferredQuery = useDeferredValue(query);

  const rows = useMemo(() => normalizeRows(data, studySet.terms), [data, studySet.terms]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    const list = normalizedQuery
      ? rows.filter(
          (row) =>
            row.term.toLowerCase().includes(normalizedQuery) ||
            row.definition.toLowerCase().includes(normalizedQuery),
        )
      : rows;

    return [...list].sort((a, b) => {
      const left = a[sortKey].toLowerCase();
      const right = b[sortKey].toLowerCase();
      const compare = left.localeCompare(right);
      return sortDirection === 'asc' ? compare : -compare;
    });
  }, [rows, deferredQuery, sortKey, sortDirection]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold sm:text-2xl">Study Table</h2>
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              Search and sort all terms in this set. No LLM generation is required for this mode.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border px-3 py-2 font-semibold" style={{ borderColor: 'var(--border)' }}>
              {filteredRows.length} shown
            </span>
            <span className="rounded-full bg-sky px-3 py-2 font-semibold text-black">
              {rows.length} total
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search terms or definitions"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => toggleSort('term')}
              className="rounded-full border px-3 py-2 text-sm font-semibold"
              style={{ borderColor: sortKey === 'term' ? 'rgba(243,87,87,0.5)' : 'var(--border)' }}
            >
              Sort term {sortKey === 'term' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
            </button>
            <button
              type="button"
              onClick={() => toggleSort('definition')}
              className="rounded-full border px-3 py-2 text-sm font-semibold"
              style={{ borderColor: sortKey === 'definition' ? 'rgba(243,87,87,0.5)' : 'var(--border)' }}
            >
              Sort definition {sortKey === 'definition' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
            </button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-[28px] p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-elevated)' }}>
                <th className="px-4 py-3 font-semibold sm:px-6">#</th>
                <th className="px-4 py-3 font-semibold sm:px-6">Term</th>
                <th className="px-4 py-3 font-semibold sm:px-6">Definition</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => (
                <tr key={row.id} className="border-t align-top" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-3 text-xs font-semibold text-[var(--text-muted)] sm:px-6">{index + 1}</td>
                  <td className="px-4 py-3 font-semibold sm:px-6">{row.term}</td>
                  <td className="px-4 py-3 leading-6 text-[var(--text-muted)] sm:px-6">{row.definition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filteredRows.length ? (
          <div className="border-t px-6 py-8 text-center text-sm text-[var(--text-muted)]" style={{ borderColor: 'var(--border)' }}>
            No results found for “{query}”.
          </div>
        ) : null}
      </Card>
    </div>
  );
}
