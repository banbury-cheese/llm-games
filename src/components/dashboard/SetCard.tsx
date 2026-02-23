import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { StudySet } from '@/types/study-set';

const CARD_COLORS = ['#F35757', '#A6BE59', '#ECD227', '#AFA3FF', '#EC683E', '#F2995E', '#7FB2FF', '#BFBAB4'] as const;

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getCardStyle(id: string) {
  const hash = hashString(id);
  const color = CARD_COLORS[hash % CARD_COLORS.length];
  const rotation = ((hash % 9) - 4) * 0.7;
  const textColor = '#111111';
  return { color, rotation, textColor };
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface SetCardProps {
  studySet: StudySet;
  onDelete: (studySet: StudySet) => void;
  index: number;
}

export function SetCard({ studySet, onDelete, index }: SetCardProps) {
  const cardStyle = getCardStyle(studySet.id);

  return (
    <div data-set-card style={{ transform: `rotate(${cardStyle.rotation}deg)` }} className="h-full">
      <Card
        className="flex h-full flex-col justify-between rounded-[26px] border-0 p-0 shadow-card"
        style={{
          background: cardStyle.color,
          color: cardStyle.textColor,
          minHeight: 220,
        }}
      >
        <Link href={`/set/${studySet.id}`} className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 text-xs font-semibold">
            <span className="rounded-full bg-black/10 px-3 py-1 uppercase tracking-[0.14em]">
              {studySet.sourceType}
            </span>
            <span className="opacity-70">#{String(index + 1).padStart(2, '0')}</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold leading-tight sm:text-2xl">{studySet.title}</h2>
            <p className="line-clamp-3 text-sm leading-6 opacity-80">
              {studySet.description || `Study set with ${studySet.terms.length} terms.`}
            </p>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-black/10 px-3 py-1">{studySet.terms.length} terms</span>
            <span className="rounded-full bg-black/10 px-3 py-1">{formatDate(studySet.createdAt)}</span>
          </div>
        </Link>

        <div className="flex items-center justify-between gap-3 border-t border-black/10 p-4">
          <p className="text-xs font-semibold opacity-80">Open game grid</p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="!border-black/20 !text-black hover:!bg-black/10"
              onClick={() => onDelete(studySet)}
            >
              Delete
            </Button>
            <Link
              href={`/set/${studySet.id}`}
              className="inline-flex items-center justify-center rounded-full border border-black/20 bg-black/10 px-3 py-2 text-xs font-semibold transition hover:bg-black/15"
            >
              Open →
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
