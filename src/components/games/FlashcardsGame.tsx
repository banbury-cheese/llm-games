'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { initGSAP } from '@/lib/gsap';
import type { Term } from '@/types/study-set';

import type { GameComponentProps } from '@/components/games/types';
import styles from './FlashcardsGame.module.scss';

type Flashcard = {
  id: string;
  term: string;
  definition: string;
};

type PileKind = 'know' | 'dontKnow' | 'remaining';

function normalizeCards(data: unknown, fallback: Term[]): Flashcard[] {
  if (
    data &&
    typeof data === 'object' &&
    'cards' in data &&
    Array.isArray((data as { cards?: unknown[] }).cards)
  ) {
    const cards = (data as { cards: unknown[] }).cards
      .filter(
        (item): item is { term?: unknown; definition?: unknown; id?: unknown } =>
          !!item && typeof item === 'object',
      )
      .map((item, index) => ({
        id: typeof item.id === 'string' ? item.id : `${index + 1}`,
        term: typeof item.term === 'string' ? item.term : '',
        definition: typeof item.definition === 'string' ? item.definition : '',
      }))
      .filter((card) => card.term && card.definition);

    if (cards.length) return cards;
  }

  return fallback.map((term, index) => ({
    id: term.id || `${index + 1}`,
    term: term.term,
    definition: term.definition,
  }));
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function PileTile({
  pile,
  label,
  subtitle,
  count,
  onClick,
  disabled = false,
  accent,
  activeHint,
  previewLabel,
  previewText,
  pileRef,
}: {
  pile: PileKind;
  label: string;
  subtitle: string;
  count: number;
  onClick: () => void;
  disabled?: boolean;
  accent: 'coral' | 'sky' | 'olive';
  activeHint?: string;
  previewLabel: string;
  previewText: string;
  pileRef?: (node: HTMLButtonElement | null) => void;
}) {
  const accentBg =
    accent === 'coral'
      ? 'linear-gradient(135deg, rgba(243,87,87,0.2) 0%, rgba(242,153,94,0.14) 100%)'
      : accent === 'olive'
        ? 'linear-gradient(135deg, rgba(166,190,89,0.22) 0%, rgba(236,210,39,0.12) 100%)'
        : 'linear-gradient(135deg, rgba(127,178,255,0.22) 0%, rgba(175,163,255,0.14) 100%)';

  const accentBorder =
    accent === 'coral'
      ? 'rgba(243,87,87,0.35)'
      : accent === 'olive'
        ? 'rgba(166,190,89,0.35)'
        : 'rgba(127,178,255,0.35)';

  const tabFill =
    accent === 'coral'
      ? 'linear-gradient(135deg, rgba(243,87,87,0.35) 0%, rgba(242,153,94,0.2) 100%)'
      : accent === 'olive'
        ? 'linear-gradient(135deg, rgba(166,190,89,0.34) 0%, rgba(236,210,39,0.16) 100%)'
        : 'linear-gradient(135deg, rgba(127,178,255,0.32) 0%, rgba(175,163,255,0.18) 100%)';

  const bodyFill =
    accent === 'coral'
      ? 'linear-gradient(180deg, rgba(243,87,87,0.08) 0%, rgba(243,87,87,0.03) 100%)'
      : accent === 'olive'
        ? 'linear-gradient(180deg, rgba(166,190,89,0.08) 0%, rgba(166,190,89,0.03) 100%)'
        : 'linear-gradient(180deg, rgba(127,178,255,0.08) 0%, rgba(127,178,255,0.03) 100%)';

  return (
    <button
      ref={pileRef}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative w-full overflow-hidden rounded-[22px] border p-4 text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-60 sm:p-5"
      style={{
        borderColor: accentBorder,
        background: accentBg,
        boxShadow: '0 10px 24px rgba(0,0,0,0.08)',
      }}
      data-pile={pile}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{subtitle}</p>
        </div>
        <span className="rounded-full border px-2 py-1 text-xs font-semibold" style={{ borderColor: 'var(--border)' }}>
          {count}
        </span>
      </div>

      <div className={styles.folderWrap} aria-hidden>
        <div
          className={styles.folderSheet}
          data-folder-sheet
          style={{
            top: '12px',
            transform: 'translateY(0) scale(0.98)',
            opacity: 0.48,
            background: 'rgba(255,255,255,0.04)',
            borderColor: 'var(--border)',
          }}
        />
        <div
          className={styles.folderSheet}
          data-folder-sheet
          style={{
            top: '6px',
            transform: 'translateY(0) scale(0.99)',
            opacity: 0.7,
            background: 'rgba(255,255,255,0.05)',
            borderColor: 'var(--border)',
          }}
        />

        <div className={styles.folderTab} style={{ background: tabFill, borderColor: accentBorder }} />
        <div
          className={styles.folderBody}
          data-pile-body
          style={{
            background: bodyFill,
            borderColor: accentBorder,
          }}
        >
          <div
            className={styles.folderCardMini}
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
              transform: `rotate(${pile === 'dontKnow' ? '-1.1deg' : pile === 'know' ? '1deg' : '0deg'})`,
            }}
          >
            <div className="w-full">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {previewLabel}
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 sm:text-base">
                {previewText}
              </p>
            </div>
          </div>
        </div>
      </div>

      {activeHint ? (
        <div
          className={styles.folderHint}
          style={{}}
        >
          <div className="rounded-xl border px-3 py-2 text-xs font-medium" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.04)' }}>
          {activeHint}
          </div>
        </div>
      ) : null}
    </button>
  );
}

export function FlashcardsGame({ studySet, data }: GameComponentProps) {
  const cards = useMemo(() => normalizeCards(data, studySet.terms), [data, studySet.terms]);
  const allIds = useMemo(() => cards.map((card) => card.id), [cards]);
  const cardMap = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);

  const [remainingIds, setRemainingIds] = useState<string[]>(allIds);
  const [knowIds, setKnowIds] = useState<string[]>([]);
  const [dontKnowIds, setDontKnowIds] = useState<string[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [retries, setRetries] = useState(0);
  const [runStartedAt, setRunStartedAt] = useState<number>(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [status, setStatus] = useState('Click the card to flip. Send it to Know or Don’t know using the piles below.');

  const card3dRef = useRef<HTMLDivElement>(null);
  const cardShellRef = useRef<HTMLDivElement>(null);
  const knowPileRef = useRef<HTMLButtonElement | null>(null);
  const dontKnowPileRef = useRef<HTMLButtonElement | null>(null);
  const remainingPileRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveIdRef = useRef<string | null>(null);
  const entryFromPileRef = useRef<PileKind | null>(null);
  const exitDelayTimeoutRef = useRef<number | null>(null);

  const currentCardId = remainingIds[0] ?? null;
  const currentCard = currentCardId ? cardMap.get(currentCardId) ?? null : null;
  const knowTopCard = knowIds.length ? cardMap.get(knowIds[knowIds.length - 1]) ?? null : null;
  const dontKnowTopCard = dontKnowIds.length
    ? cardMap.get(dontKnowIds[dontKnowIds.length - 1]) ?? null
    : null;
  const isPassComplete = !currentCard && cards.length > 0;
  const knowPercent = cards.length ? Math.round((knowIds.length / cards.length) * 100) : 0;

  useEffect(() => {
    setRemainingIds(allIds);
    setKnowIds([]);
    setDontKnowIds([]);
    setFlipped(false);
    setRetries(0);
    setRunStartedAt(Date.now());
    setElapsedMs(0);
    setStatus('Click the card to flip. Send it to Know or Don’t know using the piles below.');
    previousActiveIdRef.current = null;
    entryFromPileRef.current = null;
  }, [allIds]);

  useEffect(() => {
    return () => {
      if (exitDelayTimeoutRef.current) {
        window.clearTimeout(exitDelayTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isPassComplete) return;

    setElapsedMs(Date.now() - runStartedAt);
    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - runStartedAt);
    }, 250);

    return () => window.clearInterval(interval);
  }, [runStartedAt, isPassComplete]);

  useEffect(() => {
    const node = card3dRef.current;
    if (!node) return;

    const gsap = initGSAP();
    gsap.to(node, {
      rotationY: flipped ? 180 : 0,
      duration: 0.42,
      ease: 'power2.out',
    });
  }, [flipped]);

  useEffect(() => {
    const node = cardShellRef.current;
    if (!node || !currentCardId) return;

    const gsap = initGSAP();
    const card3dNode = card3dRef.current;
    const isInitial = previousActiveIdRef.current === null;
    const entryFromPile = entryFromPileRef.current;
    entryFromPileRef.current = null;
    previousActiveIdRef.current = currentCardId;

    gsap.killTweensOf(node);
    gsap.set(node, {
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
      autoAlpha: 0,
      zIndex: 1,
      transformOrigin: '50% 50%',
    });
    if (card3dNode) {
      gsap.killTweensOf(card3dNode);
      gsap.set(card3dNode, { rotationY: 0 });
    }

    const getPileNode = (pile: PileKind) =>
      pile === 'know' ? knowPileRef.current : pile === 'dontKnow' ? dontKnowPileRef.current : remainingPileRef.current;

    const sourcePileNode = entryFromPile ? getPileNode(entryFromPile) : null;

    if (!isInitial && sourcePileNode) {
      const cardRect = node.getBoundingClientRect();
      const pileRect = sourcePileNode.getBoundingClientRect();

      const cardCenterX = cardRect.left + cardRect.width / 2;
      const cardCenterY = cardRect.top + cardRect.height / 2;
      const pileCenterX = pileRect.left + pileRect.width / 2;
      const pileCenterY = pileRect.top + Math.min(pileRect.height * 0.7, pileRect.height / 2 + 28);
      const startScale = Math.max(
        0.32,
        Math.min(0.72, Math.min(pileRect.width / cardRect.width, pileRect.height / cardRect.height) * 0.88),
      );

      gsap.fromTo(
        node,
        {
          x: pileCenterX - cardCenterX,
          y: pileCenterY - cardCenterY,
          rotation: entryFromPile === 'dontKnow' ? -6 : entryFromPile === 'know' ? 6 : 0,
          scale: startScale,
          autoAlpha: 0.22,
        },
        {
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1,
          autoAlpha: 1,
          duration: 0.34,
          ease: 'power2.out',
          onStart: () => {
            setAnimating(true);
          },
          onComplete: () => {
            setAnimating(false);
          },
        },
      );
      return;
    }

    gsap.fromTo(
      node,
      {
        autoAlpha: 0,
        y: isInitial ? 18 : 10,
        scale: isInitial ? 0.98 : 0.985,
        x: 0,
        rotation: 0,
      },
      {
        autoAlpha: 1,
        y: 0,
        x: 0,
        rotation: 0,
        scale: 1,
        duration: isInitial ? 0.38 : 0.28,
        ease: 'power2.out',
        onComplete: () => {
          setAnimating(false);
        },
      },
    );
  }, [currentCardId]);

  const pulsePile = (pile: PileKind) => {
    const gsap = initGSAP();
    const node =
      pile === 'know'
        ? knowPileRef.current
        : pile === 'dontKnow'
          ? dontKnowPileRef.current
          : remainingPileRef.current;

    if (!node) return;

    gsap.fromTo(node, { scale: 1 }, { scale: 1.03, yoyo: true, repeat: 1, duration: 0.12, ease: 'power1.out' });
    gsap.fromTo(
      node.querySelectorAll('[data-folder-sheet], [data-pile-body]'),
      { y: 0 },
      { y: -2, yoyo: true, repeat: 1, duration: 0.1, stagger: 0.02, ease: 'power1.out' },
    );
  };

  const animateCardOut = (
    action: 'know' | 'dontKnow' | 'cycle' | 'shuffle',
    onCompleteStateChange: () => void,
    options?: { waitForEntry?: boolean },
  ) => {
    const node = cardShellRef.current;
    if (!node) {
      onCompleteStateChange();
      return;
    }

    const gsap = initGSAP();
    const card3dNode = card3dRef.current;
    const targetPile: PileKind =
      action === 'know' ? 'know' : action === 'dontKnow' ? 'dontKnow' : 'remaining';
    const pileNode =
      targetPile === 'know'
        ? knowPileRef.current
        : targetPile === 'dontKnow'
          ? dontKnowPileRef.current
          : remainingPileRef.current;

    const cardRect = node.getBoundingClientRect();
    const pileRect = pileNode?.getBoundingClientRect();
    const cardCenterX = cardRect.left + cardRect.width / 2;
    const cardCenterY = cardRect.top + cardRect.height / 2;

    const fallbackMotion =
      action === 'know'
        ? { x: 180, y: 120, rotation: 8, scale: 0.55 }
        : action === 'dontKnow'
          ? { x: -180, y: 120, rotation: -8, scale: 0.55 }
          : { x: 0, y: 120, rotation: action === 'shuffle' ? 4 : 0, scale: 0.52 };

    const motion = pileRect
      ? {
          x: pileRect.left + pileRect.width / 2 - cardCenterX,
          y: pileRect.top + Math.min(pileRect.height * 0.72, pileRect.height / 2 + 28) - cardCenterY,
          rotation:
            action === 'know' ? 7 : action === 'dontKnow' ? -7 : action === 'shuffle' ? 3 : 0,
          scale: Math.max(
            0.34,
            Math.min(0.7, Math.min(pileRect.width / cardRect.width, pileRect.height / cardRect.height) * 0.9),
          ),
        }
      : fallbackMotion;

    setAnimating(true);
    gsap.killTweensOf(node);
    if (card3dNode) {
      gsap.killTweensOf(card3dNode);
      gsap.set(card3dNode, { rotationY: 0 });
    }
    setFlipped(false);
    const timeline = gsap.timeline();
    timeline
      .to(node, {
        y: '-=8',
        scale: 1.01,
        duration: 0.08,
        ease: 'power1.out',
      })
      .to(
        node,
        {
          ...motion,
          autoAlpha: 0.08,
          duration: 0.3,
          ease: 'power3.in',
          onComplete: () => {
            gsap.set(node, { autoAlpha: 0, zIndex: 1 });
            if (exitDelayTimeoutRef.current) {
              window.clearTimeout(exitDelayTimeoutRef.current);
            }
            exitDelayTimeoutRef.current = window.setTimeout(() => {
              onCompleteStateChange();
              if (!options?.waitForEntry) {
                setAnimating(false);
              }
            }, 90);
          },
        },
        '-=0.01',
      );
  };

  const bounceCurrentCard = () => {
    const node = cardShellRef.current;
    if (!node) return;
    const gsap = initGSAP();
    gsap.fromTo(node, { y: 0 }, { y: 8, duration: 0.08, yoyo: true, repeat: 1, ease: 'power1.out' });
  };

  const cycleRemaining = (shuffleAfter = false) => {
    if (animating || !currentCardId) return;

    if (remainingIds.length <= 1) {
      bounceCurrentCard();
      setStatus('Only one card left in the remaining pile. Mark it Know or Don’t know to continue.');
      return;
    }

    animateCardOut(shuffleAfter ? 'shuffle' : 'cycle', () => {
      const [first, ...rest] = remainingIds;
      if (!first) return;
      const nextRest = shuffleAfter ? shuffle(rest) : rest;
      entryFromPileRef.current = 'remaining';
      setRemainingIds([...nextRest, first]);
      setStatus(
        shuffleAfter
          ? 'Current card sent back to the remaining pile and the pile was shuffled.'
          : 'Current card sent back to the remaining pile. New card up next.',
      );
      pulsePile('remaining');
    }, { waitForEntry: true });
  };

  const classifyCurrentCard = (target: 'know' | 'dontKnow') => {
    if (animating || !currentCardId) return;

    const willHaveNextCard = remainingIds.length > 1;
    animateCardOut(target, () => {
      const [first, ...rest] = remainingIds;
      if (!first) return;

      if (rest.length > 0) {
        entryFromPileRef.current = 'remaining';
      }
      setRemainingIds(rest);
      if (target === 'know') {
        setKnowIds((prev) => [...prev, first]);
        setStatus('Card moved to the Know pile.');
      } else {
        setDontKnowIds((prev) => [...prev, first]);
        setStatus('Card moved to the Don’t know pile.');
      }
      pulsePile(target);
      if (rest.length === 0) {
        setElapsedMs(Date.now() - runStartedAt);
      }
    }, { waitForEntry: willHaveNextCard });
  };

  const retryDontKnow = () => {
    if (animating || dontKnowIds.length === 0) return;

    const retriedIds = shuffle(dontKnowIds);
    if (retriedIds.length > 0) {
      setAnimating(true);
    }
    entryFromPileRef.current = 'remaining';
    setRemainingIds(retriedIds);
    setDontKnowIds([]);
    setRetries((prev) => prev + 1);
    setFlipped(false);
    setStatus('Retry started: cards from the Don’t know pile moved back to Remaining.');
    pulsePile('remaining');
  };

  const restartAllCards = () => {
    if (!cards.length) return;

    const restarted = shuffle([...remainingIds, ...knowIds, ...dontKnowIds]);
    if (restarted.length > 0) {
      setAnimating(true);
    }
    entryFromPileRef.current = 'remaining';
    setRemainingIds(restarted);
    setKnowIds([]);
    setDontKnowIds([]);
    setRetries(0);
    setFlipped(false);
    const now = Date.now();
    setRunStartedAt(now);
    setElapsedMs(0);
    setStatus('All cards restarted and returned to the remaining pile.');
    previousActiveIdRef.current = null;
    pulsePile('remaining');
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (animating) return;

      if (event.key === ' ' || event.key === 'Enter') {
        if (!currentCard) return;
        event.preventDefault();
        setFlipped((prev) => !prev);
      }

      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        classifyCurrentCard('know');
      }

      if (event.key.toLowerCase() === 'd') {
        event.preventDefault();
        classifyCurrentCard('dontKnow');
      }

      if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        cycleRemaining(false);
      }

      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        cycleRemaining(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (!cards.length) {
    return (
      <Card className="rounded-[28px] p-6">
        <p className="text-sm text-[var(--text-muted)]">No cards available for this set.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-coral px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                Flashcards
              </span>
              <span className="rounded-full bg-lavender px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-black">
                Pile Mode
              </span>
            </div>
            <h2 className="text-xl font-semibold sm:text-2xl">Sort cards into Know / Don’t know piles</h2>
            <p className="text-sm leading-6 text-[var(--text-muted)]">{status}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border px-3 py-2 font-semibold" style={{ borderColor: 'var(--border)' }}>
              Time {formatElapsed(elapsedMs)}
            </span>
            <span className="rounded-full bg-sky px-3 py-2 font-semibold text-black">Remaining {remainingIds.length}</span>
            <span className="rounded-full bg-olive px-3 py-2 font-semibold text-black">Know {knowIds.length}</span>
            <span className="rounded-full bg-peach px-3 py-2 font-semibold text-black">Don’t know {dontKnowIds.length}</span>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className={styles.stage}>
            {currentCard ? (
              <div ref={cardShellRef} className={styles.cardShell}>
                <div
                  ref={card3dRef}
                  className={styles.card3d}
                  onClick={() => !animating && setFlipped((prev) => !prev)}
                  onTouchStart={(event) => setTouchStartX(event.changedTouches[0]?.clientX ?? null)}
                  onTouchEnd={(event) => {
                    if (animating) return;
                    const endX = event.changedTouches[0]?.clientX;
                    if (touchStartX == null || endX == null) {
                      setFlipped((prev) => !prev);
                      return;
                    }
                    const delta = endX - touchStartX;
                    if (Math.abs(delta) > 70) {
                      if (delta > 0) {
                        classifyCurrentCard('dontKnow');
                      } else {
                        classifyCurrentCard('know');
                      }
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
                      if (!animating) setFlipped((prev) => !prev);
                    }
                  }}
                >
                  <div className={styles.face}>
                    <Card className="grid h-full min-h-[300px] place-items-center rounded-[30px] border-0 bg-gradient-to-br from-coral via-orange to-peach p-6 text-center text-white shadow-card sm:min-h-[360px] sm:p-8">
                      <div className="space-y-4">
                        <div className="flex items-center justify-center gap-2">
                          <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/90">
                            Term
                          </span>
                          <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
                            {currentCard.term.length} chars
                          </span>
                        </div>
                        <p className="text-2xl font-semibold leading-tight sm:text-4xl">{currentCard.term}</p>
                        <p className="text-sm text-white/85">Click to flip · Swipe right = Don’t know · Swipe left = Know</p>
                      </div>
                    </Card>
                  </div>

                  <div className={`${styles.face} ${styles.back}`}>
                    <Card className="grid h-full min-h-[300px] place-items-center rounded-[30px] border-0 bg-gradient-to-br from-lavender via-sky to-[#a6be59] p-6 text-center text-black shadow-card sm:min-h-[360px] sm:p-8">
                      <div className="space-y-4">
                        <div className="flex items-center justify-center gap-2">
                          <span className="rounded-full border border-black/10 bg-white/35 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
                            Definition
                          </span>
                          <span className="rounded-full border border-black/10 bg-white/35 px-3 py-1 text-xs font-semibold">
                            {currentCard.definition.length} chars
                          </span>
                        </div>
                        <p className="text-base leading-7 sm:text-xl sm:leading-8">{currentCard.definition}</p>
                        <p className="text-sm opacity-75">Click again to flip back, then choose a pile</p>
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            ) : null}

            {isPassComplete ? (
              <Card className="rounded-[30px] border-0 bg-gradient-to-br from-olive/20 via-yellow/10 to-transparent p-6 sm:p-8" style={{ background: 'linear-gradient(135deg, rgba(166,190,89,0.18) 0%, rgba(236,210,39,0.10) 55%, var(--surface) 100%)' }}>
                <div className="space-y-4">
                  <div>
                    <p className="inline-flex rounded-full bg-olive px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-black">
                      Pass complete!
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold sm:text-3xl">Review results and keep drilling weak cards</h3>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Know box contains</p>
                      <p className="mt-2 text-2xl font-semibold">{knowPercent}%</p>
                    </div>
                    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Time elapsed</p>
                      <p className="mt-2 text-2xl font-semibold">{formatElapsed(elapsedMs)}</p>
                    </div>
                    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Retries</p>
                      <p className="mt-2 text-2xl font-semibold">{retries}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" onClick={retryDontKnow} disabled={dontKnowIds.length === 0}>
                      Retry Don’t know Cards ({dontKnowIds.length})
                    </Button>
                    <Button type="button" variant="secondary" onClick={restartAllCards}>
                      Restart All Cards
                    </Button>
                  </div>
                </div>
              </Card>
            ) : null}
          </div>

          <Card className="rounded-[28px] p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-[var(--text-muted)]">
                Keyboard: <span className="font-semibold">Space</span> flip, <span className="font-semibold">K</span> know,{' '}
                <span className="font-semibold">D</span> don’t know, <span className="font-semibold">R</span> next from pile,{' '}
                <span className="font-semibold">S</span> shuffle
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => cycleRemaining(false)} disabled={!currentCard || animating}>
                  Next from Remaining
                </Button>
                <Button type="button" variant="ghost" onClick={() => setFlipped((prev) => !prev)} disabled={!currentCard || animating}>
                  {flipped ? 'Show Term' : 'Flip Card'}
                </Button>
                <Button type="button" onClick={() => cycleRemaining(true)} disabled={!currentCard || animating || remainingIds.length < 2}>
                  Shuffle Queue
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="rounded-[28px] p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <PileTile
                pile="dontKnow"
                label="Don’t know"
                subtitle="Send current card here"
                count={dontKnowIds.length}
                onClick={() => classifyCurrentCard('dontKnow')}
                disabled={!currentCard || animating}
                accent="coral"
                activeHint={currentCard ? 'Click to move active card into Don’t know' : undefined}
                previewLabel="Top card"
                previewText={dontKnowTopCard?.term ?? 'No cards yet'}
                pileRef={(node) => {
                  dontKnowPileRef.current = node;
                }}
              />

              <PileTile
                pile="remaining"
                label="Remaining cards"
                subtitle="Click to send current card to the back and reveal the next one"
                count={remainingIds.length}
                onClick={() => cycleRemaining(false)}
                disabled={!currentCard || animating}
                accent="sky"
                activeHint={remainingIds.length > 1 ? 'Click pile to cycle current card' : 'Last remaining card'}
                previewLabel="Next up"
                previewText={currentCard?.term ?? 'Pass complete'}
                pileRef={(node) => {
                  remainingPileRef.current = node;
                }}
              />

              <PileTile
                pile="know"
                label="Know"
                subtitle="Send current card here"
                count={knowIds.length}
                onClick={() => classifyCurrentCard('know')}
                disabled={!currentCard || animating}
                accent="olive"
                activeHint={currentCard ? 'Click to move active card into Know' : undefined}
                previewLabel="Top card"
                previewText={knowTopCard?.term ?? 'No cards yet'}
                pileRef={(node) => {
                  knowPileRef.current = node;
                }}
              />
            </div>
          </Card>

          <Card className="rounded-[28px] p-4 sm:p-5">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold">Pile actions</h3>
                <span className="text-xs text-[var(--text-muted)]">Inspired by classic study app pile workflows</span>
              </div>
              <div className="grid gap-2">
                <Button type="button" variant="secondary" onClick={retryDontKnow} disabled={dontKnowIds.length === 0 || animating}>
                  Retry cards in Don’t know pile
                </Button>
                <Button type="button" variant="ghost" onClick={() => cycleRemaining(true)} disabled={!currentCard || animating || remainingIds.length < 2}>
                  Shuffle (send current card back + randomize remaining)
                </Button>
                <Button type="button" variant="ghost" onClick={restartAllCards} disabled={animating}>
                  Restart all cards (move Know/Don’t know back to Remaining)
                </Button>
              </div>
            </div>
          </Card>

          <Card className="rounded-[28px] p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
              <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-coral animate-pulse" />
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Live timer</p>
                </div>
                <p className="mt-2 text-2xl font-semibold">{formatElapsed(elapsedMs)}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {isPassComplete ? 'Stopped at pass completion' : 'Running during current pass'}
                </p>
              </div>
              <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Progress</p>
                <p className="mt-2 text-2xl font-semibold">{Math.round(((knowIds.length + dontKnowIds.length) / cards.length) * 100)}%</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Cards classified this pass</p>
              </div>
              <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Know rate</p>
                <p className="mt-2 text-2xl font-semibold">{knowPercent}%</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Based on all cards</p>
              </div>
              <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Retries</p>
                <p className="mt-2 text-2xl font-semibold">{retries}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Retry passes started</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
