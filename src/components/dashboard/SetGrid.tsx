import Link from 'next/link';

import { SetCard } from '@/components/dashboard/SetCard';
import type { StudySet } from '@/types/study-set';

interface SetGridProps {
  sets: StudySet[];
  onDelete: (studySet: StudySet) => void;
}

export function SetGrid({ sets, onDelete }: SetGridProps) {
  if (!sets.length) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="grid-bg rounded-[30px] border border-dashed p-6 sm:p-8" style={{ borderColor: 'var(--border)' }}>
          <div className="space-y-4">
            <p className="inline-flex rounded-full bg-coral px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              Empty Arcade
            </p>
            <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
              Create your first study set to unlock the mini-game grid.
            </h2>
            <p className="max-w-xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">
              Paste notes, upload a PDF, or type a topic. The app extracts terms and stores everything locally so you can iterate quickly.
            </p>
            <Link
              href="/create"
              className="inline-flex items-center justify-center rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(243,87,87,0.28)] transition hover:-translate-y-0.5 hover:bg-[#ee4d4d]"
            >
              Create Study Set
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          {[
            ['Flashcards', '#AFA3FF', '-2deg'],
            ['Quiz', '#ECD227', '1.4deg'],
            ['Matching', '#7FB2FF', '-1deg'],
            ['Study Table', '#A6BE59', '2deg'],
          ].map(([label, color, rotation]) => (
            <div
              key={label}
              className="rounded-[22px] p-4 text-sm font-semibold text-black shadow-card"
              style={{ background: color, transform: `rotate(${rotation})` }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {sets.map((studySet, index) => (
        <SetCard key={studySet.id} studySet={studySet} onDelete={onDelete} index={index} />
      ))}
    </div>
  );
}
