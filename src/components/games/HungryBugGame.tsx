'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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
type EventKind = 'correct' | 'wrong' | 'crash' | 'complete';

type FoodToken = {
  id: string;
  optionIndex: number;
  label: string;
  icon: string;
  pos: Point;
};

type HungryBugState = {
  snake: Point[];
  direction: Direction;
  nextDirection: Direction | null;
  foods: FoodToken[];
  questionIndex: number;
  order: number[];
  score: number;
  wrongEats: number;
  moves: number;
  completed: boolean;
  gameOver: boolean;
  status: string;
  eventNonce: number;
  eventKind: EventKind | null;
  hitFoodId: string | null;
};

const BOARD_COLS = 15;
const BOARD_ROWS = 15;
const INITIAL_LENGTH = 3;
const FOOD_ICONS = ['🍇', '🍩', '🍒', '🥝', '🍊', '🫐', '🍓', '🥨'];
const OPTION_COLOR_SWATCHES = [
  'rgba(243,87,87,0.16)',
  'rgba(127,178,255,0.16)',
  'rgba(166,190,89,0.16)',
  'rgba(175,163,255,0.16)',
];

const DIRECTION_STEPS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function pointsEqual(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y;
}

function pointKey(point: Point) {
  return `${point.x},${point.y}`;
}

function isOpposite(a: Direction, b: Direction) {
  return (
    (a === 'up' && b === 'down') ||
    (a === 'down' && b === 'up') ||
    (a === 'left' && b === 'right') ||
    (a === 'right' && b === 'left')
  );
}

function cleanQuestionData(data: unknown, fallbackTerms: Term[]): ChoiceQuestion[] {
  if (data && typeof data === 'object' && 'items' in data && Array.isArray((data as { items?: unknown[] }).items)) {
    const items = (data as { items: unknown[] }).items
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
      .filter((item) => item.prompt && item.options.length >= 3 && item.correctIndex >= 0 && item.correctIndex < item.options.length)
      .slice(0, 12)
      .map((item) => ({ ...item, options: item.options.slice(0, 3), correctIndex: Math.min(item.correctIndex, 2) }));

    if (items.length) return items;
  }

  const selected = fallbackTerms.slice(0, 12);
  return selected.map((term, index) => {
    const distractors = shuffle(
      selected.filter((other) => other.id !== term.id).map((other) => other.term),
    ).slice(0, 2);
    while (distractors.length < 2) distractors.push(`Option ${distractors.length + 1}`);
    const options = shuffle([term.term, ...distractors]).slice(0, 3);
    return {
      id: term.id || `${index + 1}`,
      prompt: `Which term matches this definition? ${term.definition}`,
      options,
      correctIndex: options.findIndex((option) => option === term.term),
      explanation: `${term.term}: ${term.definition}`,
    };
  });
}

function randomFreePoints(count: number, occupied: Point[]) {
  const taken = new Set(occupied.map(pointKey));
  const result: Point[] = [];
  let guard = 0;

  while (result.length < count && guard < 2000) {
    guard += 1;
    const candidate = {
      x: Math.floor(Math.random() * BOARD_COLS),
      y: Math.floor(Math.random() * BOARD_ROWS),
    };
    const key = pointKey(candidate);
    if (taken.has(key)) continue;
    taken.add(key);
    result.push(candidate);
  }

  return result;
}

function buildFoods(question: ChoiceQuestion | undefined, snake: Point[]) {
  if (!question) return [];
  const positions = randomFreePoints(question.options.length, snake);
  return question.options.map((label, optionIndex) => ({
    id: `${question.id}-${optionIndex}-${positions[optionIndex]?.x ?? 0}-${positions[optionIndex]?.y ?? 0}`,
    optionIndex,
    label,
    icon: FOOD_ICONS[(optionIndex + Math.abs(question.id.length)) % FOOD_ICONS.length],
    pos: positions[optionIndex] ?? { x: optionIndex, y: optionIndex },
  }));
}

function createInitialState(questionCount: number, questions: ChoiceQuestion[]): HungryBugState {
  const centerX = Math.floor(BOARD_COLS / 2);
  const centerY = Math.floor(BOARD_ROWS / 2);
  const snake: Point[] = Array.from({ length: INITIAL_LENGTH }, (_, index) => ({ x: centerX - index, y: centerY }));
  const order = shuffle(Array.from({ length: questionCount }, (_, index) => index));
  const firstQuestion = questions[order[0]];

  return {
    snake,
    direction: 'right',
    nextDirection: null,
    foods: buildFoods(firstQuestion, snake),
    questionIndex: 0,
    order,
    score: 0,
    wrongEats: 0,
    moves: 0,
    completed: false,
    gameOver: false,
    status: 'Use arrow keys to steer the bug to the correct snack.',
    eventNonce: 0,
    eventKind: null,
    hitFoodId: null,
  };
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function labelForKey(key: string) {
  if (key === 'ArrowUp') return 'up';
  if (key === 'ArrowDown') return 'down';
  if (key === 'ArrowLeft') return 'left';
  if (key === 'ArrowRight') return 'right';
  return null;
}

export function HungryBugGame({ studySet, data }: GameComponentProps) {
  const questions = useMemo(() => cleanQuestionData(data, studySet.terms), [data, studySet.terms]);
  const [state, setState] = useState<HungryBugState>(() => createInitialState(questions.length, questions));
  const [running, setRunning] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [elapsedBaseMs, setElapsedBaseMs] = useState(0);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const foodRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setState(createInitialState(questions.length, questions));
    setRunning(false);
    setElapsedBaseMs(0);
    setRunStartedAt(null);
    setClockNow(Date.now());
  }, [questions]);

  const currentQuestion = questions[state.order[state.questionIndex]];

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
    if (!running || state.gameOver || state.completed || !questions.length) return;

    const stepMs = Math.max(90, 180 - Math.min(state.score * 5, 75));

    const interval = window.setInterval(() => {
      setState((prev) => {
        if (prev.gameOver || prev.completed || !questions.length) return prev;

        const activeQuestion = questions[prev.order[prev.questionIndex]];
        if (!activeQuestion) {
          return {
            ...prev,
            completed: true,
            status: 'Pass complete!',
            eventNonce: prev.eventNonce + 1,
            eventKind: 'complete',
            hitFoodId: null,
          };
        }

        const requested = prev.nextDirection && !isOpposite(prev.direction, prev.nextDirection) ? prev.nextDirection : prev.direction;
        const step = DIRECTION_STEPS[requested];
        const head = prev.snake[0];
        const nextHead = { x: head.x + step.x, y: head.y + step.y };

        const hitsWall = nextHead.x < 0 || nextHead.x >= BOARD_COLS || nextHead.y < 0 || nextHead.y >= BOARD_ROWS;
        const hitsSelf = prev.snake.some((segment) => pointsEqual(segment, nextHead));

        if (hitsWall || hitsSelf) {
          return {
            ...prev,
            direction: requested,
            nextDirection: null,
            gameOver: true,
            status: hitsWall ? 'Game over: the bug ran off the table.' : 'Game over: the bug ran into itself.',
            moves: prev.moves + 1,
            eventNonce: prev.eventNonce + 1,
            eventKind: 'crash',
            hitFoodId: null,
          };
        }

        const collidedFood = prev.foods.find((food) => pointsEqual(food.pos, nextHead));

        if (!collidedFood) {
          return {
            ...prev,
            snake: [nextHead, ...prev.snake.slice(0, -1)],
            direction: requested,
            nextDirection: null,
            moves: prev.moves + 1,
          };
        }

        const correct = collidedFood.optionIndex === activeQuestion.correctIndex;

        if (correct) {
          const grownSnake = [nextHead, ...prev.snake];
          const nextQuestionIndex = prev.questionIndex + 1;
          const completed = nextQuestionIndex >= prev.order.length;
          const nextQuestion = completed ? undefined : questions[prev.order[nextQuestionIndex]];
          return {
            ...prev,
            snake: grownSnake,
            direction: requested,
            nextDirection: null,
            score: prev.score + 1,
            questionIndex: nextQuestionIndex,
            foods: completed ? [] : buildFoods(nextQuestion, grownSnake),
            completed,
            moves: prev.moves + 1,
            status: completed ? 'Pass complete! Every prompt solved.' : 'Correct snack. Next prompt loaded.',
            eventNonce: prev.eventNonce + 1,
            eventKind: completed ? 'complete' : 'correct',
            hitFoodId: collidedFood.id,
          };
        }

        const movedSnake = [nextHead, ...prev.snake.slice(0, -1)];
        return {
          ...prev,
          snake: movedSnake,
          direction: requested,
          nextDirection: null,
          wrongEats: prev.wrongEats + 1,
          score: Math.max(0, prev.score - 1),
          foods: buildFoods(activeQuestion, movedSnake),
          moves: prev.moves + 1,
          status: 'Wrong snack. Same question, new food positions.',
          eventNonce: prev.eventNonce + 1,
          eventKind: 'wrong',
          hitFoodId: collidedFood.id,
        };
      });
    }, stepMs);

    return () => window.clearInterval(interval);
  }, [questions, running, state.score, state.gameOver, state.completed]);

  useEffect(() => {
    if (!state.eventKind) return;
    const gsap = initGSAP();

    if (state.eventKind === 'correct') {
      if (headRef.current) {
        gsap.fromTo(headRef.current, { scale: 1 }, { scale: 1.18, yoyo: true, repeat: 1, duration: 0.12, ease: 'power1.out' });
      }
      if (boardRef.current) {
        gsap.fromTo(boardRef.current, { boxShadow: '0 0 0 rgba(166,190,89,0)' }, { boxShadow: '0 0 0.9rem rgba(166,190,89,0.32)', yoyo: true, repeat: 1, duration: 0.18 });
      }
    }

    if (state.eventKind === 'wrong' || state.eventKind === 'crash') {
      if (boardRef.current) {
        gsap.fromTo(boardRef.current, { x: 0 }, { x: 6, duration: 0.045, repeat: 5, yoyo: true, ease: 'power1.inOut' });
      }
    }

    if (state.eventKind === 'complete' && panelRef.current) {
      gsap.fromTo(panelRef.current, { scale: 0.99 }, { scale: 1.01, duration: 0.2, yoyo: true, repeat: 1, ease: 'power1.out' });
    }
  }, [state.eventKind, state.eventNonce]);

  useEffect(() => {
    if (!state.foods.length) return;
    const gsap = initGSAP();
    const nodes = state.foods.map((food) => foodRefs.current[food.id]).filter(Boolean);
    if (!nodes.length) return;
    gsap.fromTo(nodes, { autoAlpha: 0, scale: 0.55, y: -10 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.22, stagger: 0.03, ease: 'back.out(1.4)' });
  }, [state.foods]);

  const resumeGame = () => {
    if (state.gameOver || state.completed || !questions.length) return;
    if (running) return;
    setRunStartedAt(Date.now());
    setRunning(true);
  };

  const pauseGame = () => {
    if (!running) return;
    const now = Date.now();
    setElapsedBaseMs((prev) => prev + (runStartedAt ? now - runStartedAt : 0));
    setRunStartedAt(null);
    setClockNow(now);
    setRunning(false);
  };

  const restartGame = () => {
    setState(createInitialState(questions.length, questions));
    setRunning(false);
    setElapsedBaseMs(0);
    setRunStartedAt(null);
    setClockNow(Date.now());
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mapped = labelForKey(event.key);
      if (!mapped) return;
      event.preventDefault();

      if (!running && !state.gameOver && !state.completed) {
        setRunStartedAt(Date.now());
        setRunning(true);
      }

      setState((prev) => {
        if (prev.gameOver || prev.completed) return prev;
        const nextDirection = isOpposite(prev.direction, mapped) ? prev.nextDirection ?? prev.direction : mapped;
        return { ...prev, nextDirection };
      });
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [running, state.gameOver, state.completed]);

  if (!questions.length) {
    return (
      <Card className="rounded-[28px] p-6">
        <p className="text-sm text-[var(--text-muted)]">No Hungry Bug prompts available for this deck.</p>
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
            <h2 className="text-xl font-semibold sm:text-2xl">Hungry Bug</h2>
            <p className="text-sm text-[var(--text-muted)]">Steer with arrow keys and eat the food that matches the correct answer choice.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border px-3 py-2 font-semibold" style={{ borderColor: 'var(--border)' }}>
              Score {state.score}
            </span>
            <span className="rounded-full border px-3 py-2 font-semibold" style={{ borderColor: 'rgba(243,87,87,0.3)', color: 'var(--text-muted)' }}>
              Wrong snacks {state.wrongEats}
            </span>
            <span className="rounded-full bg-lavender px-3 py-2 font-semibold text-black">{formatElapsed(elapsedMs)}</span>
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full bg-lavender transition-all" style={{ width: `${progress}%` }} />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] xl:items-start">
        <Card className="rounded-[28px] p-4 sm:p-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="font-semibold">Board</p>
              <p className="text-[var(--text-muted)]">Arrow keys to move · wall/self collision ends run</p>
            </div>

            <div
              ref={boardRef}
              className="relative mx-auto aspect-square w-full max-w-[42rem] overflow-hidden rounded-[24px] border"
              style={{
                borderColor: 'rgba(127,178,255,0.26)',
                backgroundColor: 'var(--surface-elevated)',
                backgroundImage:
                  'linear-gradient(rgba(127,178,255,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(127,178,255,0.10) 1px, transparent 1px), radial-gradient(circle at 20% 10%, rgba(243,87,87,0.08), transparent 40%), radial-gradient(circle at 80% 85%, rgba(166,190,89,0.08), transparent 45%)',
                backgroundSize: `${100 / BOARD_COLS}% ${100 / BOARD_ROWS}%, ${100 / BOARD_COLS}% ${100 / BOARD_ROWS}%, 100% 100%, 100% 100%`,
              }}
            >
              {!running && !state.gameOver && !state.completed ? (
                <div className="absolute inset-0 z-20 grid place-items-center bg-[rgba(0,0,0,0.18)] p-4 text-center backdrop-blur-[2px]">
                  <div className="max-w-md rounded-2xl border p-4 sm:p-5" style={{ borderColor: 'var(--border)', background: 'rgba(20,20,20,0.35)' }}>
                    <p className="text-sm leading-6 text-[var(--text-muted)]">
                      A question and three answers appear on the right. Use your keyboard arrows to move the bug and eat the matching food.
                    </p>
                    <Button type="button" className="mt-4" onClick={resumeGame}>
                      Start using keyboard
                    </Button>
                  </div>
                </div>
              ) : null}

              {state.completed ? (
                <div className="absolute inset-0 z-20 grid place-items-center bg-[rgba(0,0,0,0.16)] p-4">
                  <div className="w-full max-w-md rounded-2xl border p-5 text-center" style={{ borderColor: 'rgba(166,190,89,0.35)', background: 'rgba(166,190,89,0.10)' }}>
                    <p className="inline-flex rounded-full bg-olive px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-black">Pass Complete!</p>
                    <h3 className="mt-3 text-xl font-semibold">Hungry bug survived the table.</h3>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">Score {state.score} · Time {formatElapsed(elapsedMs)} · Wrong snacks {state.wrongEats}</p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <Button type="button" variant="secondary" onClick={restartGame}>Restart</Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {state.gameOver ? (
                <div className="absolute inset-0 z-20 grid place-items-center bg-[rgba(0,0,0,0.22)] p-4">
                  <div className="w-full max-w-md rounded-2xl border p-5 text-center" style={{ borderColor: 'rgba(243,87,87,0.35)', background: 'rgba(243,87,87,0.08)' }}>
                    <p className="inline-flex rounded-full bg-coral px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">Game Over</p>
                    <p className="mt-3 text-sm text-[var(--text-muted)]">{state.status}</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">Score {state.score} · Time {formatElapsed(elapsedMs)}</p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <Button type="button" onClick={restartGame}>Restart Run</Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {state.foods.map((food) => (
                <div
                  key={food.id}
                  ref={(node) => {
                    foodRefs.current[food.id] = node;
                  }}
                  className="absolute z-10 grid place-items-center rounded-xl border text-base shadow-sm"
                  style={{
                    left: `${food.pos.x * cellWidth}%`,
                    top: `${food.pos.y * cellHeight}%`,
                    width: `${cellWidth}%`,
                    height: `${cellHeight}%`,
                    borderColor: 'rgba(255,255,255,0.14)',
                    background: OPTION_COLOR_SWATCHES[food.optionIndex % OPTION_COLOR_SWATCHES.length],
                  }}
                  title={`Choice ${food.optionIndex + 1}`}
                >
                  <span aria-hidden>{food.icon}</span>
                </div>
              ))}

              {state.snake.map((segment, segmentIndex) => {
                const isHead = segmentIndex === 0;
                const segmentBg = isHead
                  ? 'linear-gradient(135deg, rgba(166,190,89,1) 0%, rgba(236,210,39,1) 100%)'
                  : 'linear-gradient(135deg, rgba(127,178,255,0.95) 0%, rgba(175,163,255,0.95) 100%)';
                return (
                  <div
                    key={`${segment.x}-${segment.y}-${segmentIndex}`}
                    ref={isHead ? headRef : undefined}
                    className="absolute rounded-[10px] border transition-[left,top,transform] duration-100 ease-linear"
                    style={{
                      left: `${segment.x * cellWidth}%`,
                      top: `${segment.y * cellHeight}%`,
                      width: `${cellWidth}%`,
                      height: `${cellHeight}%`,
                      borderColor: isHead ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.16)',
                      background: segmentBg,
                      boxShadow: isHead ? '0 4px 12px rgba(0,0,0,0.16)' : 'none',
                    }}
                  >
                    {isHead ? <span className="grid h-full place-items-center text-[0.9rem]">🐛</span> : null}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {running ? (
                <Button type="button" variant="secondary" onClick={pauseGame}>Pause</Button>
              ) : (
                <Button type="button" onClick={resumeGame} disabled={state.gameOver || state.completed}>Resume</Button>
              )}
              <Button type="button" variant="ghost" onClick={restartGame}>Restart</Button>
              <span className="text-xs text-[var(--text-muted)]">Moves {state.moves} · Snake length {state.snake.length}</span>
            </div>
          </div>
        </Card>

        <Card className="rounded-[28px] p-4 sm:p-5">
          <div ref={panelRef} className="space-y-4">
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Prompt {Math.min(state.questionIndex + 1, questions.length)} / {questions.length}</p>
                <span className="rounded-full border px-2 py-1 text-xs" style={{ borderColor: 'var(--border)' }}>{running ? 'Live' : state.completed ? 'Done' : state.gameOver ? 'Stopped' : 'Ready'}</span>
              </div>
              <p className="mt-3 text-base font-semibold leading-6 sm:text-lg">{currentQuestion?.prompt ?? 'All prompts solved.'}</p>
            </div>

            <div className="space-y-2">
              {(currentQuestion?.options ?? []).map((option, optionIndex) => {
                const isCorrect = currentQuestion && optionIndex === currentQuestion.correctIndex;
                return (
                  <div
                    key={`${currentQuestion?.id ?? 'done'}-${optionIndex}`}
                    className="rounded-2xl border px-3 py-3"
                    style={{
                      borderColor: 'var(--border)',
                      background: OPTION_COLOR_SWATCHES[optionIndex % OPTION_COLOR_SWATCHES.length],
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm" style={{ borderColor: 'rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)' }}>
                        {FOOD_ICONS[(optionIndex + 1) % FOOD_ICONS.length]}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Choice {optionIndex + 1}</p>
                        <p className="mt-1 text-sm font-medium leading-5">{option}</p>
                        {!running && (state.gameOver || state.completed) && isCorrect ? (
                          <p className="mt-1 text-xs font-semibold text-olive">Correct answer</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: 'var(--border)', background: 'linear-gradient(135deg, rgba(127,178,255,0.08) 0%, rgba(175,163,255,0.06) 100%)' }}>
              <p className="font-semibold">Status</p>
              <p className="mt-1 leading-6 text-[var(--text-muted)]">{state.status}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
