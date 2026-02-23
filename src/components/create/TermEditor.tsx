'use client';

import { v4 as uuidv4 } from 'uuid';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import type { Term } from '@/types/study-set';

interface TermEditorProps {
  terms: Term[];
  onChange: (terms: Term[]) => void;
}

export function TermEditor({ terms, onChange }: TermEditorProps) {
  const updateTerm = (id: string, patch: Partial<Term>) => {
    onChange(terms.map((term) => (term.id === id ? { ...term, ...patch } : term)));
  };

  const addTerm = () => {
    onChange([
      ...terms,
      {
        id: uuidv4(),
        term: '',
        definition: '',
      },
    ]);
  };

  const removeTerm = (id: string) => {
    onChange(terms.filter((term) => term.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Review terms</h2>
          <p className="text-sm text-[var(--text-muted)]">Edit, add, or remove terms before saving.</p>
        </div>
        <Button type="button" variant="secondary" onClick={addTerm}>
          + Add Term
        </Button>
      </div>

      <div className="grid gap-3">
        {terms.map((term, index) => (
          <Card key={term.id} className="rounded-[22px] p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--text-muted)]">Term {index + 1}</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeTerm(term.id)}>
                Remove
              </Button>
            </div>
            <div className="grid gap-3">
              <Input
                value={term.term}
                onChange={(event) => updateTerm(term.id, { term: event.target.value })}
                placeholder="Term"
              />
              <TextArea
                value={term.definition}
                onChange={(event) => updateTerm(term.id, { definition: event.target.value })}
                placeholder="Definition"
                className="min-h-[110px]"
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
