import { Card } from '@/components/ui/Card';

import type { GameComponentProps } from '@/components/games/types';

export function GroupAPreviewGame({ studySet, gameType, data }: GameComponentProps) {
  const preview = JSON.stringify(data, null, 2);

  return (
    <Card className="rounded-[28px] p-5 sm:p-6">
      <div className="space-y-4">
        <div>
          <p className="inline-flex rounded-full bg-olive px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-black">
            Phase 4 Wrapper Ready
          </p>
          <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">{gameType}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)] sm:text-base">
            Data generation and caching are live. This placeholder will be replaced by the interactive {gameType} component in Phase 5.
          </p>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Study set summary</p>
          <p className="text-sm font-semibold">{studySet.title}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{studySet.terms.length} terms loaded</p>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)' }}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Cached game data preview</p>
          <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap break-words text-xs leading-5">{preview}</pre>
        </div>
      </div>
    </Card>
  );
}
