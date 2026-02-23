import Link from 'next/link';

import { Card } from '@/components/ui/Card';
import type { GameDescriptor } from '@/types/game';

interface GameSelectorCardProps {
  game: GameDescriptor;
  href: string;
  index: number;
}

export function GameSelectorCard({ game, href, index }: GameSelectorCardProps) {
  const colors = ['#F35757', '#A6BE59', '#ECD227', '#AFA3FF', '#EC683E', '#F2995E', '#7FB2FF', '#BFBAB4'];
  const accent = colors[index % colors.length];
  const rotation = ((index % 5) - 2) * 0.7;

  if (!game.available) {
    return (
      <Card
        className="relative rounded-[22px] p-4 opacity-80"
        style={{ transform: `rotate(${rotation}deg)`, background: 'var(--surface-elevated)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="text-2xl" aria-hidden>
              {game.icon}
            </div>
            <h3 className="text-base font-semibold sm:text-lg">{game.label}</h3>
            <p className="text-xs leading-5 text-[var(--text-muted)]">Coming in a later phase</p>
          </div>
          <span className="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ borderColor: 'var(--border)' }}>
            Locked
          </span>
        </div>
      </Card>
    );
  }

  return (
    <Link href={href} className="block h-full" data-game-tile>
      <Card
        interactive
        className="group relative h-full rounded-[22px] border-0 p-4 shadow-card sm:p-5"
        style={{ transform: `rotate(${rotation}deg)`, background: accent, color: '#111' }}
      >
        <div className="flex h-full flex-col justify-between gap-6">
          <div className="flex items-start justify-between gap-3">
            <div className="text-2xl sm:text-3xl" aria-hidden>
              {game.icon}
            </div>
            <span className="rounded-full bg-black/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
              Ready
            </span>
          </div>
          <div>
            <h3 className="text-base font-semibold sm:text-lg">{game.label}</h3>
            <p className="mt-1 text-xs leading-5 opacity-75">Open game</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
