import { Card } from '@/components/ui/Card';

import type { GameComponentProps } from '@/components/games/types';

export function ComingSoonGame({ studySet, gameType }: GameComponentProps) {
  return (
    <Card className="rounded-[28px] p-6 sm:p-8">
      <div className="space-y-3">
        <p className="inline-flex rounded-full bg-lavender px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-black">
          Coming Soon
        </p>
        <h2 className="text-2xl font-semibold sm:text-3xl">{gameType}</h2>
        <p className="text-sm leading-6 text-[var(--text-muted)] sm:text-base">
          This game is listed in the selector grid, but it is intentionally locked until later phases. Your set “{studySet.title}” is ready and cached for the implemented games.
        </p>
      </div>
    </Card>
  );
}
