'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { initGSAP } from '@/lib/gsap';
import type { Term } from '@/types/study-set';

import type { GameComponentProps } from '@/components/games/types';
import styles from './FlashcardsGame.module.scss';

function normalizeCards(data: unknown, fallback: Term[]) {
  if (
    data &&
    typeof data === 'object' &&
    'cards' in data &&
    Array.isArray((data as { cards?: unknown[] }).cards)
  ) {
    const cards = (data as { cards: unknown[] }).cards
      .filter((item): item is { term?: unknown; definition?: unknown; id?: unknown } => !!item && typeof item === 'object')
      .map((item, index) => ({
        id: typeof item.id === 'string' ? item.id : `${index + 1}`,
        term: typeof item.term === 'string' ? item.term : '',
        definition: typeof item.definition === 'string' ? item.definition : '',
      }))
      .filter((card) => card.term && card.definition);

    if (cards.length) return cards;
  }

  return fallback;
}

export function FlashcardsGame({ studySet, data }: GameComponentProps) {
  const cards = useMemo(() => normalizeCards(data, studySet.terms), [data, studySet.terms]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const currentCard = cards[index];
  const progress = cards.length ? ((index + 1) / cards.length) * 100 : 0;

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const gsap = initGSAP();
    gsap.to(node, {
      rotationY: flipped ? 180 : 0,
      duration: 0.45,
      ease: 'power2.out',
    });
  }, [flipped]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setFlipped(false);
        setIndex((prev) => Math.min(prev + 1, cards.length - 1));
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setFlipped(false);
        setIndex((prev) => Math.max(prev - 1, 0));
      }
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        setFlipped((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cards.length]);

  if (!currentCard) {
    return (
      <Card className="rounded-[28px] p-6">
        <p className="text-sm text-[var(--text-muted)]">No cards available for this set.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">Flashcards</h2>
            <p className="text-sm text-[var(--text-muted)]">Tap/click to flip. Use arrow keys or swipe horizontally.</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="rounded-full border px-3 py-2 font-semibold" style={{ borderColor: 'var(--border)' }}>
              {index + 1} / {cards.length}
            </span>
            <span className="rounded-full bg-coral px-3 py-2 font-semibold text-white">{Math.round(progress)}%</span>
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full bg-coral transition-all" style={{ width: `${progress}%` }} />
        </div>
      </Card>

      <div className={styles.stage}>
        <div
          ref={cardRef}
          className={styles.card3d}
          onClick={() => setFlipped((prev) => !prev)}
          onTouchStart={(event) => setTouchStartX(event.changedTouches[0]?.clientX ?? null)}
          onTouchEnd={(event) => {
            const endX = event.changedTouches[0]?.clientX;
            if (touchStartX == null || endX == null) return;
            const delta = endX - touchStartX;
            if (Math.abs(delta) > 40) {
              setFlipped(false);
              setIndex((prev) => (delta < 0 ? Math.min(prev + 1, cards.length - 1) : Math.max(prev - 1, 0)));
              return;
            }
            setFlipped((prev) => !prev);
          }}
          role="button"
          tabIndex={0}
          aria-label="Flip flashcard"
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setFlipped((prev) => !prev);
            }
          }}
        >
          <div className={styles.face}>
            <Card className="grid h-full min-h-[280px] place-items-center rounded-[30px] border-0 bg-gradient-to-br from-coral to-orange p-6 text-center text-white shadow-card sm:min-h-[340px] sm:p-8">
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">Term</p>
                <p className="text-2xl font-semibold leading-tight sm:text-4xl">{currentCard.term}</p>
                <p className="text-sm text-white/80">Tap to reveal definition</p>
              </div>
            </Card>
          </div>
          <div className={`${styles.face} ${styles.back}`}>
            <Card className="grid h-full min-h-[280px] place-items-center rounded-[30px] border-0 bg-gradient-to-br from-lavender to-sky p-6 text-center text-black shadow-card sm:min-h-[340px] sm:p-8">
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">Definition</p>
                <p className="text-base leading-7 sm:text-xl sm:leading-8">{currentCard.definition}</p>
                <p className="text-sm opacity-70">Tap to flip back</p>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <Card className="rounded-[28px] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[var(--text-muted)]">
            Keyboard: <span className="font-semibold">←</span> <span className="font-semibold">→</span> <span className="font-semibold">Space</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setFlipped(false);
                setIndex((prev) => Math.max(prev - 1, 0));
              }}
              disabled={index === 0}
            >
              Previous
            </Button>
            <Button type="button" variant="ghost" onClick={() => setFlipped((prev) => !prev)}>
              {flipped ? 'Show Term' : 'Flip Card'}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setFlipped(false);
                setIndex((prev) => Math.min(prev + 1, cards.length - 1));
              }}
              disabled={index === cards.length - 1}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
