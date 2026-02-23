import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function HomePage() {
  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <p
          className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]"
          style={{ borderColor: 'var(--border)' }}
        >
          Phase 1 Foundation
        </p>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
          Build study sets into a playful mini-game arcade.
        </h1>
        <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)] sm:text-lg">
          Theme system, shared UI, storage helpers, and app shell are ready. Next phases add LLM generation,
          creation flow, dashboard cards, and games.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <Card className="grid-bg relative overflow-hidden rounded-[28px] border-0 bg-[var(--surface-elevated)] p-5 sm:p-6">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-[var(--text-muted)]">
              <span className="rounded-full bg-coral px-3 py-1 text-white">12 games</span>
              <span className="rounded-full bg-olive px-3 py-1 text-black">LLM-powered</span>
              <span className="rounded-full bg-lavender px-3 py-1 text-black">Local-first</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['Flashcards', '#F35757', '-3deg'],
                ['Quiz', '#ECD227', '2deg'],
                ['Matching', '#AFA3FF', '-2deg'],
                ['Study Table', '#7FB2FF', '3deg'],
              ].map(([label, color, rotate], index) => (
                <div
                  key={label}
                  className="rounded-3xl p-4 text-sm font-semibold text-black shadow-card"
                  style={{ background: color, transform: `rotate(${rotate})`, marginTop: index % 2 ? '0.75rem' : 0 }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="rounded-[28px] p-5 sm:p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold sm:text-2xl">Start a study set</h2>
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              Paste text, upload a PDF, or enter a topic. Review extracted terms, then launch a game grid.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-2xl border px-3 py-2" style={{ borderColor: 'var(--border)' }}>
                <span>Theme toggle</span>
                <span className="font-semibold text-olive">Ready</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border px-3 py-2" style={{ borderColor: 'var(--border)' }}>
                <span>Local storage</span>
                <span className="font-semibold text-olive">Ready</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border px-3 py-2" style={{ borderColor: 'var(--border)' }}>
                <span>LLM APIs</span>
                <span className="font-semibold text-yellow">Next phase</span>
              </div>
            </div>
            <Link href="/create">
              <Button size="lg" fullWidth>
                Go to Create Flow
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </section>
  );
}
