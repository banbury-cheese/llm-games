'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import type { Term } from '@/types/study-set';

import type { GameComponentProps } from '@/components/games/types';

type TestKind = 'mcq' | 'type-in' | 'true-false';

type TestItem = {
  id: string;
  kind: TestKind;
  prompt: string;
  options?: string[];
  correctIndex?: number;
  answer?: string;
  explanation?: string;
};

type TestResponse = {
  mcqIndex?: number;
  text?: string;
};

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function typeInScore(input: string, target: string) {
  const a = normalizeText(input);
  const b = normalizeText(target);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.replace(/\s+/g, '') === b.replace(/\s+/g, '')) return 0.96;
  if (a.includes(b) || b.includes(a)) return 0.75;
  return 0;
}

function buildFallbackTest(terms: Term[]): TestItem[] {
  const selected = terms.slice(0, 9);
  if (!selected.length) return [];

  return selected.map((term, index) => {
    const mode = index % 3;

    if (mode === 0) {
      const distractors = shuffle(
        selected.filter((item) => item.id !== term.id).map((item) => item.term),
      ).slice(0, 3);
      while (distractors.length < 3) distractors.push(`Option ${distractors.length + 1}`);
      const options = shuffle([...distractors, term.term]);
      return {
        id: `mcq-${term.id}`,
        kind: 'mcq' as const,
        prompt: `Which term matches this definition? ${term.definition}`,
        options,
        correctIndex: options.findIndex((option) => option === term.term),
        explanation: `${term.term}: ${term.definition}`,
      };
    }

    if (mode === 1) {
      return {
        id: `type-${term.id}`,
        kind: 'type-in' as const,
        prompt: `Type the term for this definition: ${term.definition}`,
        answer: term.term,
        explanation: `${term.term}: ${term.definition}`,
      };
    }

    const alternate = selected[(index + 1) % selected.length] ?? term;
    const isTrue = index % 2 === 0;
    const statementDef = isTrue ? term.definition : alternate.definition;
    return {
      id: `tf-${term.id}`,
      kind: 'true-false' as const,
      prompt: `True or False: "${term.term}" is defined as "${statementDef}".`,
      options: ['True', 'False'],
      correctIndex: isTrue ? 0 : 1,
      explanation: `${term.term}: ${term.definition}`,
    };
  });
}

function normalizeItems(data: unknown, fallbackTerms: Term[]): TestItem[] {
  if (data && typeof data === 'object' && 'items' in data && Array.isArray((data as { items?: unknown[] }).items)) {
    const items = (data as { items: unknown[] }).items
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item, index): TestItem => {
        const kind: TestKind =
          item.kind === 'mcq' || item.kind === 'type-in' || item.kind === 'true-false'
            ? item.kind
            : 'mcq';

        return {
          id: typeof item.id === 'string' ? item.id : `${index + 1}`,
          kind,
          prompt: typeof item.prompt === 'string' ? item.prompt : '',
          options: Array.isArray(item.options)
            ? item.options.filter((option): option is string => typeof option === 'string')
            : undefined,
          correctIndex: typeof item.correctIndex === 'number' ? item.correctIndex : undefined,
          answer: typeof item.answer === 'string' ? item.answer : undefined,
          explanation: typeof item.explanation === 'string' ? item.explanation : undefined,
        };
      })
      .filter((item) => {
        if (!item.prompt) return false;
        if (item.kind === 'type-in') return Boolean(item.answer);
        return Array.isArray(item.options) && item.options.length >= 2 && typeof item.correctIndex === 'number';
      })
      .slice(0, 12);

    if (items.length) return items;
  }

  return buildFallbackTest(fallbackTerms);
}

function isAnswered(item: TestItem, response?: TestResponse) {
  if (!response) return false;
  if (item.kind === 'type-in') return Boolean(response.text?.trim());
  return typeof response.mcqIndex === 'number';
}

function scoreItem(item: TestItem, response?: TestResponse) {
  if (!response) return { correct: false, score: 0 };

  if (item.kind === 'type-in') {
    const score = typeInScore(response.text ?? '', item.answer ?? '');
    return { correct: score >= 0.95, score };
  }

  const correct = response.mcqIndex === item.correctIndex;
  return { correct, score: correct ? 1 : 0 };
}

export function TestModeGame({ studySet, data }: GameComponentProps) {
  const items = useMemo(() => normalizeItems(data, studySet.terms), [data, studySet.terms]);
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, TestResponse>>({});
  const [showResults, setShowResults] = useState(false);

  const current = items[index];
  const answeredCount = items.filter((item) => isAnswered(item, responses[item.id])).length;
  const progress = items.length ? Math.round((answeredCount / items.length) * 100) : 0;

  const results = useMemo(() => {
    const perItem = items.map((item) => ({
      item,
      response: responses[item.id],
      ...scoreItem(item, responses[item.id]),
    }));
    const rawPoints = perItem.reduce((sum, row) => sum + row.score, 0);
    const maxPoints = perItem.length || 1;
    const percent = Math.round((rawPoints / maxPoints) * 100);
    return { perItem, rawPoints, maxPoints, percent };
  }, [items, responses]);

  if (!items.length) {
    return (
      <Card className="rounded-[28px] p-6">
        <p className="text-sm text-[var(--text-muted)]">No test items available.</p>
      </Card>
    );
  }

  if (showResults) {
    return (
      <div className="space-y-4">
        <Card className="rounded-[28px] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="inline-flex rounded-full bg-yellow px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-black">
                Test Complete
              </p>
              <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Score: {results.percent}%</h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {results.rawPoints.toFixed(2)} / {results.maxPoints} points across mixed question types.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowResults(false)}>
                Review Test
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setResponses({});
                  setIndex(0);
                  setShowResults(false);
                }}
              >
                Restart Test
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid gap-3">
          {results.perItem.map((row, itemIndex) => {
            const badgeBg = row.correct ? 'rgba(166,190,89,0.12)' : 'rgba(243,87,87,0.10)';
            const badgeBorder = row.correct ? 'rgba(166,190,89,0.45)' : 'rgba(243,87,87,0.35)';
            return (
              <Card key={row.item.id} className="rounded-[22px] p-4 sm:p-5">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--text-muted)]">Question {itemIndex + 1} · {row.item.kind}</p>
                    <span className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: badgeBorder, background: badgeBg }}>
                      {row.item.kind === 'type-in' ? `${Math.round(row.score * 100)}%` : row.correct ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>
                  <p className="font-semibold leading-6">{row.item.prompt}</p>
                  {row.item.kind === 'type-in' ? (
                    <div className="rounded-2xl border p-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>
                      <p>Your answer: <strong>{row.response?.text || '—'}</strong></p>
                      <p className="mt-1">Correct answer: <strong>{row.item.answer}</strong></p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(row.item.options ?? []).map((option, optionIndex) => {
                        const isCorrect = optionIndex === row.item.correctIndex;
                        const isSelected = optionIndex === row.response?.mcqIndex;
                        return (
                          <div
                            key={`${row.item.id}-${optionIndex}`}
                            className="rounded-xl border px-3 py-2 text-sm"
                            style={{
                              borderColor: isCorrect
                                ? 'rgba(166,190,89,0.55)'
                                : isSelected
                                  ? 'rgba(243,87,87,0.4)'
                                  : 'var(--border)',
                              background: isCorrect ? 'rgba(166,190,89,0.08)' : 'transparent',
                            }}
                          >
                            {option}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {row.item.explanation ? <p className="text-sm text-[var(--text-muted)]">{row.item.explanation}</p> : null}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  if (!current) return null;

  const currentResponse = responses[current.id];
  const currentAnswered = isAnswered(current, currentResponse);

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">Test Mode</h2>
            <p className="text-sm text-[var(--text-muted)]">Mixed MCQ, type-in, and true/false questions graded at the end.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full border px-3 py-2 font-semibold" style={{ borderColor: 'var(--border)' }}>
              {Math.min(index + 1, items.length)} / {items.length}
            </span>
            <span className="rounded-full bg-yellow px-3 py-2 font-semibold text-black">{answeredCount} answered</span>
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full bg-yellow transition-all" style={{ width: `${progress}%` }} />
        </div>
      </Card>

      <Card className="rounded-[28px] p-5 sm:p-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{current.kind.replace('-', ' ')} · Question {index + 1}</p>
            <h3 className="text-lg font-semibold leading-7 sm:text-2xl sm:leading-8">{current.prompt}</h3>
          </div>

          {current.kind === 'type-in' ? (
            <div className="space-y-2">
              <label htmlFor={`test-${current.id}`} className="text-sm font-semibold">Your answer</label>
              <Input
                id={`test-${current.id}`}
                value={currentResponse?.text ?? ''}
                onChange={(event) =>
                  setResponses((prev) => ({
                    ...prev,
                    [current.id]: { ...prev[current.id], text: event.target.value },
                  }))
                }
                placeholder="Type your answer"
              />
            </div>
          ) : (
            <fieldset className="space-y-2">
              <legend className="sr-only">Answer options</legend>
              {(current.options ?? []).map((option, optionIndex) => {
                const checked = currentResponse?.mcqIndex === optionIndex;
                return (
                  <label
                    key={`${current.id}-${optionIndex}`}
                    className="flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition"
                    style={{
                      borderColor: checked ? 'rgba(127,178,255,0.55)' : 'var(--border)',
                      background: checked ? 'rgba(127,178,255,0.08)' : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name={current.id}
                      checked={checked}
                      onChange={() =>
                        setResponses((prev) => ({
                          ...prev,
                          [current.id]: { ...prev[current.id], mcqIndex: optionIndex },
                        }))
                      }
                      className="mt-1"
                    />
                    <span className="text-sm leading-6">{option}</span>
                  </label>
                );
              })}
            </fieldset>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="secondary" onClick={() => setIndex((prev) => Math.max(0, prev - 1))} disabled={index === 0}>
              Previous
            </Button>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {index < items.length - 1 ? (
                <Button type="button" onClick={() => setIndex((prev) => Math.min(items.length - 1, prev + 1))} disabled={!currentAnswered}>
                  Next Question
                </Button>
              ) : (
                <Button type="button" onClick={() => setShowResults(true)} disabled={answeredCount !== items.length}>
                  Finish Test
                </Button>
              )}
            </div>
          </div>

          {index === items.length - 1 && answeredCount !== items.length ? (
            <p className="text-xs text-[var(--text-muted)]">Answer all questions to finish the test.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
