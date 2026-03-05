'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import { AntIcon, LadybugIcon } from '@/components/ui/BrandIcons';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { initGSAP } from '@/lib/gsap';
import type { Term } from '@/types/study-set';

import type { GameComponentProps } from '@/components/games/types';

type ChoiceQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

type Point = { x: number; y: number };
type Direction = 'up' | 'down' | 'left' | 'right';
type EventKind = 'correct' | 'wrong' | 'complete' | 'crash';

type AntToken = {
  id: string;
  optionIndex: number;
  iconIndex: number;
  pos: Point;
};

type BugMatchState = {
  player: Point;
  ants: AntToken[];
  order: number[];
  questionIndex: number;
  score: number;
  lives: number;
  moves: number;
  completed: boolean;
  gameOver: boolean;
  status: string;
  lastChoiceIndex: number | null;
  eventNonce: number;
  eventKind: EventKind | null;
};

const BOARD_COLS = 12;
const BOARD_ROWS = 9;
const START_LIVES = 3;
const ANT_VARIANTS = [0, 1, 2, 3];
const OPTION_BG = [
  'rgba(243,87,87,0.12)',
  'rgba(127,178,255,0.12)',
  'rgba(166,190,89,0.12)',
  'rgba(175,163,255,0.12)',
];
const ANT_MOVE_DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function pointKey(point: Point) {
  return `${point.x},${point.y}`;
}

function pointsEqual(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y;
}

function normalizeQuestions(data: unknown, fallbackTerms: Term[]): ChoiceQuestion[] {
  if (data && typeof data === 'object' && 'items' in data && Array.isArray((data as { items?: unknown[] }).items)) {
    const parsed = (data as { items: unknown[] }).items
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item, index) => ({
        id: typeof item.id === 'string' ? item.id : `${index + 1}`,
        prompt: typeof item.prompt === 'string' ? item.prompt : '',
        options: Array.isArray(item.options)
          ? item.options.filter((option): option is string => typeof option === 'string')
          : [],
        correctIndex: typeof item.correctIndex === 'number' ? item.correctIndex : -1,
        explanation: typeof item.explanation === 'string' ? item.explanation : undefined,
      }))
      .filter((item) => item.prompt && item.options.length >= 4 && item.correctIndex >= 0 && item.correctIndex < item.options.length)
      .slice(0, 16)
      .map((item) => {
        if (item.options.length <= 4) return { ...item, options: item.options.slice(0, 4) };
        const correctLabel = item.options[item.correctIndex];
        const nextOptions = item.options.slice(0, 4);
        if (!nextOptions.includes(correctLabel)) {
          nextOptions[3] = correctLabel;
          return { ...item, options: nextOptions, correctIndex: 3 };
        }
        return { ...item, options: nextOptions, correctIndex: nextOptions.indexOf(correctLabel) };
      });

    if (parsed.length) return parsed;
  }

  const selected = fallbackTerms.slice(0, 16);
  return selected.map((term, index) => {
    const distractors = shuffle(selected.filter((other) => other.id !== term.id).map((other) => other.term)).slice(0, 3);
    while (distractors.length < 3) distractors.push(`Option ${distractors.length + 1}`);
    const options = shuffle([term.term, ...distractors]).slice(0, 4);
    return {
      id: term.id || `${index + 1}`,
      prompt: `Which term matches this definition? ${term.definition}`,
      options,
      correctIndex: options.findIndex((option) => option === term.term),
      explanation: `${term.term}: ${term.definition}`,
    };
  });
}

function randomOpenPositions(count: number, occupied: Point[]) {
  const taken = new Set(occupied.map(pointKey));
  const points: Point[] = [];
  let guard = 0;

  while (points.length < count && guard < 2000) {
    guard += 1;
    const point = { x: Math.floor(Math.random() * BOARD_COLS), y: Math.floor(Math.random() * BOARD_ROWS) };
    const key = pointKey(point);
    if (taken.has(key)) continue;
    taken.add(key);
    points.push(point);
  }

  return points;
}

function centerPoint(): Point {
  return { x: Math.floor(BOARD_COLS / 2), y: Math.floor(BOARD_ROWS / 2) };
}

function buildAnts(question: ChoiceQuestion | undefined, player: Point): AntToken[] {
  if (!question) return [];
  const points = randomOpenPositions(question.options.length, [player]);
  return question.options.map((_, optionIndex) => ({
    id: `${question.id}-${optionIndex}-${points[optionIndex]?.x ?? 0}-${points[optionIndex]?.y ?? 0}`,
    optionIndex,
    iconIndex: ANT_VARIANTS[optionIndex % ANT_VARIANTS.length],
    pos: points[optionIndex] ?? { x: optionIndex, y: optionIndex },
  }));
}

function createInitialState(questionCount: number, questions: ChoiceQuestion[]): BugMatchState {
  const player = centerPoint();
  const order = shuffle(Array.from({ length: questionCount }, (_, index) => index));
  const firstQuestion = questions[order[0]];
  return {
    player,
    ants: buildAnts(firstQuestion, player),
    order,
    questionIndex: 0,
    score: 0,
    lives: START_LIVES,
    moves: 0,
    completed: false,
    gameOver: false,
    status: 'Use arrow keys to catch the ant matching the correct answer.',
    lastChoiceIndex: null,
    eventNonce: 0,
    eventKind: null,
  };
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function keyToDirection(key: string): Direction | null {
  if (key === 'ArrowUp') return 'up';
  if (key === 'ArrowDown') return 'down';
  if (key === 'ArrowLeft') return 'left';
  if (key === 'ArrowRight') return 'right';
  return null;
}

function movePoint(point: Point, direction: Direction) {
  if (direction === 'up') return { x: point.x, y: Math.max(0, point.y - 1) };
  if (direction === 'down') return { x: point.x, y: Math.min(BOARD_ROWS - 1, point.y + 1) };
  if (direction === 'left') return { x: Math.max(0, point.x - 1), y: point.y };
  return { x: Math.min(BOARD_COLS - 1, point.x + 1), y: point.y };
}

function moveAntsAroundBoard(ants: AntToken[], player: Point) {
  if (!ants.length) return ants;

  const reserved = new Set<string>([pointKey(player)]);

  return ants.map((ant) => {
    const candidatePoints = [ant.pos, ...shuffle(ANT_MOVE_DIRECTIONS).map((dir) => movePoint(ant.pos, dir))];
    const seen = new Set<string>();
    const uniqueCandidates = candidatePoints.filter((candidate) => {
      const key = pointKey(candidate);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const chooseMovingFirst = Math.random() < 0.72;
    const orderedCandidates = chooseMovingFirst
      ? [...uniqueCandidates.filter((p) => !pointsEqual(p, ant.pos)), ant.pos]
      : uniqueCandidates;

    const nextPos = orderedCandidates.find((candidate) => !reserved.has(pointKey(candidate))) ?? ant.pos;
    reserved.add(pointKey(nextPos));
    return { ...ant, pos: nextPos };
  });
}

export function BugMatchGame({ studySet, data }: GameComponentProps) {
  const { trackEvent } = useAnalytics();
  const questions = useMemo(() => normalizeQuestions(data, studySet.terms), [data, studySet.terms]);
  const [state, setState] = useState<BugMatchState>(() => createInitialState(questions.length, questions));
  const [running, setRunning] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [elapsedBaseMs, setElapsedBaseMs] = useState(0);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const panelInnerRef = useRef<HTMLDivElement>(null);
  const antRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const completionTrackedRef = useRef(false);
  const previousLivesRef = useRef(START_LIVES);

  useEffect(() => {
    setState(createInitialState(questions.length, questions));
    setRunning(false);
    setElapsedBaseMs(0);
    setRunStartedAt(null);
    setClockNow(Date.now());
    completionTrackedRef.current = false;
    previousLivesRef.current = START_LIVES;
  }, [questions]);

  const currentQuestion = questions[state.order[state.questionIndex]];
  const antIdsKey = state.ants.map((ant) => ant.id).join('|');
  const antIdList = useMemo(() => (antIdsKey ? antIdsKey.split('|') : []), [antIdsKey]);
  const elapsedMs = runStartedAt && running ? elapsedBaseMs + (clockNow - runStartedAt) : elapsedBaseMs;
  const progress = questions.length ? Math.round((Math.min(state.questionIndex, questions.length) / questions.length) * 100) : 0;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!running || (!state.gameOver && !state.completed)) return;
    const now = Date.now();
    setElapsedBaseMs((prev) => prev + (runStartedAt ? now - runStartedAt : 0));
    setRunStartedAt(null);
    setClockNow(now);
    setRunning(false);
  }, [running, runStartedAt, state.completed, state.gameOver]);

  useEffect(() => {
    if (state.gameOver || state.completed || !currentQuestion) return;

    const interval = window.setInterval(() => {
      setState((prev) => {
        if (!prev.ants.length || prev.gameOver || prev.completed) return prev;
        const movedAnts = moveAntsAroundBoard(prev.ants, prev.player);
        const changed = movedAnts.some((ant, index) => !pointsEqual(ant.pos, prev.ants[index]?.pos ?? ant.pos));
        if (!changed) return prev;
        return { ...prev, ants: movedAnts };
      });
    }, running ? 360 : 520);

    return () => window.clearInterval(interval);
  }, [currentQuestion, running, state.completed, state.gameOver]);

  useEffect(() => {
    if (!antIdList.length) return;
    const gsap = initGSAP();
    const nodes = antIdList.map((antId) => antRefs.current[antId]).filter(Boolean);
    if (!nodes.length) return;

    nodes.forEach((node, index) => {
      gsap.killTweensOf(node);
      gsap.set(node, { x: 0, y: 0, rotate: 0 });
      gsap.to(node, {
        y: index % 2 === 0 ? -4 : 4,
        x: index % 3 === 0 ? 2 : -2,
        rotate: index % 2 === 0 ? 4 : -4,
        duration: 0.8 + index * 0.12,
        delay: 0.2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    });
    return () => {
      nodes.forEach((node) => gsap.killTweensOf(node));
    };
  }, [antIdList]);

  useEffect(() => {
    if (!antIdList.length) return;
    const gsap = initGSAP();
    const nodes = antIdList.map((antId) => antRefs.current[antId]).filter(Boolean);
    if (!nodes.length) return;

    gsap.fromTo(nodes, { autoAlpha: 0, scale: 0.75 }, { autoAlpha: 1, scale: 1, duration: 0.2, stagger: 0.03, ease: 'back.out(1.2)' });
  }, [antIdList]);

  useEffect(() => {
    if (!state.eventKind) return;
    const gsap = initGSAP();
    if (state.eventKind === 'correct' || state.eventKind === 'wrong') {
      trackEvent('bugmatch_ant_hit', {
        set_id: studySet.id,
        result: state.eventKind,
        score: state.score,
        lives: state.lives,
      });
    }
    if (state.eventKind === 'complete' || state.eventKind === 'crash') {
      trackEvent('bugmatch_run_end', {
        set_id: studySet.id,
        result: state.eventKind === 'complete' ? 'complete' : 'crash',
        score: state.score,
        lives: state.lives,
      });
      if (state.eventKind === 'complete' && !completionTrackedRef.current) {
        completionTrackedRef.current = true;
        trackEvent('game_session_complete', {
          set_id: studySet.id,
          game_type: 'bug-match',
          result: 'complete',
          score: state.score,
        });
      }
    }
    if (playerRef.current) {
      gsap.fromTo(playerRef.current, { scale: 1 }, { scale: state.eventKind === 'correct' ? 1.18 : 0.92, yoyo: true, repeat: 1, duration: 0.12, ease: 'power1.out' });
    }
    if (boardRef.current) {
      if (state.eventKind === 'wrong' || state.eventKind === 'crash') {
        gsap.fromTo(boardRef.current, { x: 0 }, { x: 7, repeat: 5, yoyo: true, duration: 0.045, ease: 'power1.inOut' });
      } else {
        gsap.fromTo(boardRef.current, { boxShadow: '0 0 0 rgba(127,178,255,0)' }, { boxShadow: '0 0 1rem rgba(127,178,255,0.26)', yoyo: true, repeat: 1, duration: 0.18 });
      }
    }
    if (panelInnerRef.current) {
      gsap.fromTo(panelInnerRef.current, { y: 4, autoAlpha: 0.92 }, { y: 0, autoAlpha: 1, duration: 0.18, ease: 'power2.out' });
    }
  }, [state.eventKind, state.eventNonce, state.lives, state.score, studySet.id, trackEvent]);

  useEffect(() => {
    if (state.lives === previousLivesRef.current) return;
    trackEvent('bugmatch_life_change', {
      set_id: studySet.id,
      lives: state.lives,
      result: state.lives < previousLivesRef.current ? 'lost' : 'gain',
    });
    previousLivesRef.current = state.lives;
  }, [state.lives, studySet.id, trackEvent]);

  const startRun = () => {
    if (state.gameOver || state.completed || !questions.length) return;
    if (running) return;
    setRunStartedAt(Date.now());
    setRunning(true);
    trackEvent('bugmatch_run_start_pause_restart', {
      set_id: studySet.id,
      action: elapsedBaseMs > 0 ? 'resume' : 'start',
    });
  };

  const pauseRun = () => {
    if (!running) return;
    const now = Date.now();
    setElapsedBaseMs((prev) => prev + (runStartedAt ? now - runStartedAt : 0));
    setRunStartedAt(null);
    setClockNow(now);
    setRunning(false);
    trackEvent('bugmatch_run_start_pause_restart', {
      set_id: studySet.id,
      action: 'pause',
    });
  };

  const restartRun = () => {
    setState(createInitialState(questions.length, questions));
    setRunning(false);
    setElapsedBaseMs(0);
    setRunStartedAt(null);
    setClockNow(Date.now());
    completionTrackedRef.current = false;
    previousLivesRef.current = START_LIVES;
    trackEvent('bugmatch_run_start_pause_restart', {
      set_id: studySet.id,
      action: 'restart',
    });
  };

  const stepPlayer = useCallback((direction: Direction) => {
    trackEvent('bugmatch_move', {
      set_id: studySet.id,
      direction,
    });
    setState((prev) => {
      if (prev.gameOver || prev.completed) return prev;
      const activeQuestion = questions[prev.order[prev.questionIndex]];
      if (!activeQuestion) {
        return {
          ...prev,
          completed: true,
          status: 'Pass complete!',
          eventNonce: prev.eventNonce + 1,
          eventKind: 'complete',
        };
      }

      const nextPlayer = movePoint(prev.player, direction);
      const hitAnt = prev.ants.find((ant) => pointsEqual(ant.pos, nextPlayer));
      if (!hitAnt) {
        return {
          ...prev,
          player: nextPlayer,
          moves: prev.moves + 1,
          status: 'Move to the ant that matches the correct answer.',
        };
      }

      const correct = hitAnt.optionIndex === activeQuestion.correctIndex;
      const nextQuestionIndex = prev.questionIndex + 1;
      const nextLives = correct ? prev.lives : prev.lives - 1;
      const outOfLives = nextLives <= 0;
      const completed = nextQuestionIndex >= prev.order.length;
      const nextPlayerReset = centerPoint();
      const nextQuestion = !completed && !outOfLives ? questions[prev.order[nextQuestionIndex]] : undefined;
      const correctLabel = activeQuestion.options[activeQuestion.correctIndex] ?? 'the correct option';

      return {
        ...prev,
        player: nextPlayerReset,
        ants: completed || outOfLives ? [] : buildAnts(nextQuestion, nextPlayerReset),
        questionIndex: completed || outOfLives ? prev.questionIndex + (completed ? 1 : 0) : nextQuestionIndex,
        score: correct ? prev.score + 100 : Math.max(0, prev.score - 20),
        lives: Math.max(0, nextLives),
        moves: prev.moves + 1,
        completed,
        gameOver: outOfLives,
        lastChoiceIndex: hitAnt.optionIndex,
        status: outOfLives
          ? `Out of lives. The correct answer was “${correctLabel}”.`
          : completed
            ? 'Pass complete! You cleared every bug match prompt.'
            : correct
              ? 'Correct ant caught. Next prompt.'
              : `Wrong ant. Correct answer was “${correctLabel}”.`,
        eventNonce: prev.eventNonce + 1,
        eventKind: outOfLives ? 'crash' : completed ? 'complete' : correct ? 'correct' : 'wrong',
      };
    });
  }, [questions, studySet.id, trackEvent]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = keyToDirection(event.key);
      if (!direction) return;
      event.preventDefault();

      if (!running && !state.gameOver && !state.completed) {
        setRunStartedAt(Date.now());
        setRunning(true);
        trackEvent('bugmatch_run_start_pause_restart', {
          set_id: studySet.id,
          action: elapsedBaseMs > 0 ? 'resume' : 'start',
        });
      }

      stepPlayer(direction);
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [running, state.gameOver, state.completed, questions, stepPlayer, elapsedBaseMs, studySet.id, trackEvent]);

  if (!questions.length) {
    return (
      <Card className="rounded-[28px] p-6">
        <p className="text-sm text-[var(--text-muted)]">No Bug Match prompts available for this deck.</p>
      </Card>
    );
  }

  const cellWidth = 100 / BOARD_COLS;
  const cellHeight = 100 / BOARD_ROWS;

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">Bug Match</h2>
            <p className="text-sm text-[var(--text-muted)]">Use arrow keys to move your bug and catch the ant linked to the correct answer choice.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full border px-3 py-2 font-semibold" style={{ borderColor: 'var(--border)' }}>Score {state.score}</span>
            <span className="rounded-full bg-sky px-3 py-2 font-semibold text-black">{formatElapsed(elapsedMs)}</span>
            <span className="rounded-full border px-3 py-2 font-semibold" style={{ borderColor: 'rgba(243,87,87,0.35)' }}>
              Lives {' '}
              <span aria-label={`${state.lives} lives`}>
                <span className="inline-flex items-center gap-1 align-middle">
                  {Array.from({ length: START_LIVES }, (_, i) => (
                    <LadybugIcon key={`life-${i}`} active={i < state.lives} className="h-4 w-4" />
                  ))}
                </span>
              </span>
            </span>
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full bg-sky transition-all" style={{ width: `${progress}%` }} />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)] xl:items-start">
        <Card className="rounded-[28px] p-4 sm:p-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {running ? (
                  <Button type="button" variant="secondary" onClick={pauseRun}>Pause</Button>
                ) : (
                  <Button type="button" onClick={startRun} disabled={state.gameOver || state.completed}>Play</Button>
                )}
                <Button type="button" variant="ghost" onClick={restartRun}>Restart</Button>
              </div>
              <p className="text-xs text-[var(--text-muted)]">Keyboard arrows or the D-pad below</p>
            </div>

            <div
              ref={boardRef}
              className="relative mx-auto aspect-[4/3] w-full max-w-[44rem] overflow-hidden rounded-[24px] border"
              style={{
                borderColor: 'rgba(166,190,89,0.22)',
                backgroundColor: 'var(--surface-elevated)',
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px), radial-gradient(circle at 12% 15%, rgba(236,104,62,0.08), transparent 35%), radial-gradient(circle at 82% 78%, rgba(127,178,255,0.08), transparent 45%)',
                backgroundSize: `${100 / BOARD_COLS}% ${100 / BOARD_ROWS}%, ${100 / BOARD_COLS}% ${100 / BOARD_ROWS}%, 100% 100%, 100% 100%`,
              }}
            >
              {!running && !state.gameOver && !state.completed ? (
                <div className="absolute inset-0 z-20 grid place-items-center bg-[rgba(0,0,0,0.12)] p-4 text-center">
                  <div className="max-w-md rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'rgba(20,20,20,0.28)' }}>
                    <p className="text-sm leading-6 text-[var(--text-muted)]">
                      Move your bug with arrow keys to catch the ant for the correct answer. Wrong ants cost a life.
                    </p>
                    <Button type="button" className="mt-4" onClick={startRun}>Play</Button>
                  </div>
                </div>
              ) : null}

              {(state.gameOver || state.completed) ? (
                <div className="absolute inset-0 z-20 grid place-items-center bg-[rgba(0,0,0,0.14)] p-4 text-center">
                  <div
                    className="w-full max-w-md rounded-2xl border p-5"
                    style={{
                      borderColor: state.completed ? 'rgba(166,190,89,0.35)' : 'rgba(243,87,87,0.35)',
                      background: state.completed ? 'rgba(166,190,89,0.09)' : 'rgba(243,87,87,0.08)',
                    }}
                  >
                    <p className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${state.completed ? 'bg-olive text-black' : 'bg-coral text-white'}`}>
                      {state.completed ? 'Pass Complete!' : 'Run Ended'}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{state.status}</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">Score {state.score} · Time {formatElapsed(elapsedMs)}</p>
                    <div className="mt-4 flex justify-center">
                      <Button type="button" onClick={restartRun}>Restart</Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {state.ants.map((ant) => (
                <div
                  key={ant.id}
                  ref={(node) => {
                    antRefs.current[ant.id] = node;
                  }}
                  className="absolute z-10 grid place-items-center rounded-full border text-base shadow-sm transition-[left,top] duration-300 ease-out will-change-[left,top,transform]"
                  style={{
                    left: `${ant.pos.x * cellWidth}%`,
                    top: `${ant.pos.y * cellHeight}%`,
                    width: `${cellWidth}%`,
                    height: `${cellHeight}%`,
                    borderColor: 'rgba(255,255,255,0.18)',
                    background: OPTION_BG[ant.optionIndex % OPTION_BG.length],
                  }}
                >
                  <AntIcon variant={ant.iconIndex} className="h-5 w-5" />
                </div>
              ))}

              <div
                ref={playerRef}
                className="absolute z-10 grid place-items-center rounded-full border text-lg transition-[left,top] duration-100 ease-out"
                style={{
                  left: `${state.player.x * cellWidth}%`,
                  top: `${state.player.y * cellHeight}%`,
                  width: `${cellWidth}%`,
                  height: `${cellHeight}%`,
                  borderColor: 'rgba(0,0,0,0.18)',
                  background: 'linear-gradient(135deg, rgba(243,87,87,1) 0%, rgba(236,104,62,1) 100%)',
                  boxShadow: '0 6px 14px rgba(0,0,0,0.14)',
                }}
                aria-label="Your bug"
              >
                <LadybugIcon className="h-6 w-6" />
              </div>
            </div>

            <div className="mx-auto grid w-full max-w-[18rem] grid-cols-3 gap-2 sm:hidden">
              <div />
              <Button type="button" variant="secondary" onClick={() => stepPlayer('up')} disabled={state.gameOver || state.completed}>↑</Button>
              <div />
              <Button type="button" variant="secondary" onClick={() => stepPlayer('left')} disabled={state.gameOver || state.completed}>←</Button>
              <Button type="button" variant="ghost" onClick={() => (running ? pauseRun() : startRun())} disabled={state.gameOver || state.completed}>
                {running ? 'Pause' : 'Play'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => stepPlayer('right')} disabled={state.gameOver || state.completed}>→</Button>
              <div />
              <Button type="button" variant="secondary" onClick={() => stepPlayer('down')} disabled={state.gameOver || state.completed}>↓</Button>
              <div />
            </div>
          </div>
        </Card>

        <Card className="rounded-[28px] p-4 sm:p-5">
          <div ref={panelInnerRef} className="space-y-4">
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Prompt {Math.min(state.questionIndex + 1, questions.length)} / {questions.length}
              </p>
              <p className="mt-3 text-base font-semibold leading-6 sm:text-lg">{currentQuestion?.prompt ?? 'All prompts cleared.'}</p>
            </div>

            <div className="space-y-2">
              {(currentQuestion?.options ?? []).map((option, optionIndex) => {
                const selected = state.lastChoiceIndex === optionIndex;
                const correct = currentQuestion && optionIndex === currentQuestion.correctIndex;
                const showCorrect = (state.gameOver || state.completed || state.status.startsWith('Wrong ant')) && correct;
                return (
                  <div
                    key={`${currentQuestion?.id ?? 'done'}-${optionIndex}`}
                    className="rounded-2xl border px-3 py-3"
                    style={{
                      borderColor: selected ? 'rgba(127,178,255,0.55)' : showCorrect ? 'rgba(166,190,89,0.45)' : 'var(--border)',
                      background: selected ? 'rgba(127,178,255,0.10)' : OPTION_BG[optionIndex % OPTION_BG.length],
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm" style={{ borderColor: 'rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)' }}>
                        <AntIcon variant={ANT_VARIANTS[optionIndex % ANT_VARIANTS.length]} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Ant {optionIndex + 1}</p>
                        <p className="mt-1 text-sm font-medium leading-5">{option}</p>
                        {showCorrect ? <p className="mt-1 text-xs font-semibold text-olive">Correct</p> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: 'var(--border)', background: 'linear-gradient(135deg, rgba(175,163,255,0.07) 0%, rgba(127,178,255,0.06) 100%)' }}>
              <p className="font-semibold">Status</p>
              <p className="mt-1 leading-6 text-[var(--text-muted)]">{state.status}</p>
              <p className="mt-3 text-xs text-[var(--text-muted)]">Moves {state.moves} · {running ? 'Game running' : state.completed ? 'Pass complete' : state.gameOver ? 'Run ended' : 'Ready'}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
