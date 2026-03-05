import type {
  DeckPersonalizationState,
  PersonalizationAttemptEvent,
  PersonalizationSnapshot,
  TermPerformance,
} from '@/types/personalization';
import type { StudySet, Term } from '@/types/study-set';

const DAY_MS = 24 * 60 * 60 * 1000;
const TARGET_RATE_DEFAULT = 0.4;
const TARGET_RATE_MIN = 0.2;
const TARGET_RATE_MAX = 0.7;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRate(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return TARGET_RATE_DEFAULT;
  return clamp(value, TARGET_RATE_MIN, TARGET_RATE_MAX);
}

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(input: string) {
  return normalizeText(input)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function buildGoalBoost(studySet: StudySet, term: Term) {
  const tutorInstruction = studySet.tutorInstruction?.trim();
  if (!tutorInstruction) return 0;

  const goalTokens = new Set(tokenize(tutorInstruction));
  if (!goalTokens.size) return 0;

  const termTokens = new Set(tokenize(`${term.term} ${term.definition}`));
  let overlap = 0;
  goalTokens.forEach((token) => {
    if (termTokens.has(token)) overlap += 1;
  });

  return clamp(overlap / goalTokens.size, 0, 1);
}

export function createDefaultDeckPersonalizationState(input?: {
  enabled?: boolean;
  targetRate?: number;
  now?: number;
}): DeckPersonalizationState {
  const now = input?.now ?? Date.now();
  return {
    enabled: input?.enabled ?? true,
    targetRate: normalizeRate(input?.targetRate),
    termStats: {},
    sessionCount: 0,
    updatedAt: now,
  };
}

function createDefaultTermPerformance(termId: string, now = Date.now()): TermPerformance {
  return {
    termId,
    attempts: 0,
    correct: 0,
    incorrect: 0,
    avgResponseMs: 0,
    currentStreak: 0,
    lastSeenAt: now,
    lastCorrectAt: undefined,
    confidence: undefined,
  };
}

export function ensureDeckPersonalizationState(
  studySet: StudySet,
  input?: { forLegacy?: boolean; now?: number },
): DeckPersonalizationState {
  const now = input?.now ?? Date.now();
  const defaultEnabled = input?.forLegacy ? false : true;
  const existing = studySet.personalization;
  if (!existing) {
    return createDefaultDeckPersonalizationState({ enabled: defaultEnabled, now });
  }

  return {
    enabled: typeof existing.enabled === 'boolean' ? existing.enabled : defaultEnabled,
    targetRate: normalizeRate(existing.targetRate),
    termStats: existing.termStats ?? {},
    sessionCount: Number.isFinite(existing.sessionCount) ? Math.max(0, Math.round(existing.sessionCount)) : 0,
    updatedAt: Number.isFinite(existing.updatedAt) ? existing.updatedAt : now,
  };
}

export function computeMasteryFromStat(
  stat: TermPerformance | undefined,
  now = Date.now(),
) {
  const attempts = stat?.attempts ?? 0;
  const correct = stat?.correct ?? 0;
  const incorrect = stat?.incorrect ?? 0;

  const accuracy = attempts > 0 ? clamp(correct / Math.max(correct + incorrect, 1), 0, 1) : 0.5;
  const avgResponseMs = stat?.avgResponseMs ?? 0;
  const speedScore = attempts > 0 ? clamp(1 - avgResponseMs / 12000, 0, 1) : 0.5;

  const lastSeenAt = stat?.lastSeenAt;
  const daysSinceSeen = lastSeenAt ? Math.max(0, (now - lastSeenAt) / DAY_MS) : 14;
  const recencyScore = lastSeenAt ? clamp(1 - daysSinceSeen / 14, 0, 1) : 0.35;

  const mastery = clamp(0.7 * accuracy + 0.2 * speedScore + 0.1 * recencyScore, 0, 1);
  return {
    mastery,
    weakness: 1 - mastery,
    attempts,
  };
}

export function computeTermPriority(studySet: StudySet, now = Date.now()): PersonalizationSnapshot[] {
  const personalization = ensureDeckPersonalizationState(studySet, { forLegacy: !studySet.personalization, now });

  return studySet.terms
    .map((term) => {
      const stat = personalization.termStats[term.id];
      const { mastery, weakness, attempts } = computeMasteryFromStat(stat, now);
      const goalBoost = buildGoalBoost(studySet, term);
      const priority = clamp(0.75 * weakness + 0.25 * goalBoost, 0, 1);
      const isMastered = attempts >= 3 && mastery >= 0.8;
      const isWeak = attempts >= 2 && mastery <= 0.45;

      return {
        termId: term.id,
        attempts,
        mastery,
        weakness,
        goalBoost,
        priority,
        isWeak,
        isMastered,
      } satisfies PersonalizationSnapshot;
    })
    .sort((a, b) => b.priority - a.priority);
}

export function selectPersonalizedTerms(input: {
  studySet: StudySet;
  terms: Term[];
  maxItems: number;
  targetRate?: number;
  fallbackToRandom?: boolean;
}) {
  const maxItems = Math.max(0, Math.floor(input.maxItems));
  if (maxItems === 0 || input.terms.length === 0) {
    return { selected: [] as Term[], targetedCount: 0, targetedIds: [] as string[] };
  }

  const personalization = ensureDeckPersonalizationState(input.studySet, {
    forLegacy: !input.studySet.personalization,
  });
  const targetRate = normalizeRate(input.targetRate ?? personalization.targetRate);

  if (!personalization.enabled || input.fallbackToRandom) {
    const selected = input.terms.length <= maxItems ? [...input.terms] : shuffle(input.terms).slice(0, maxItems);
    return { selected, targetedCount: 0, targetedIds: [] as string[] };
  }

  if (input.terms.length <= maxItems) {
    return { selected: [...input.terms], targetedCount: 0, targetedIds: [] as string[] };
  }

  const snapshotByTerm = new Map(computeTermPriority(input.studySet).map((snapshot) => [snapshot.termId, snapshot]));
  const candidates = shuffle(input.terms).map((term) => ({
    term,
    snapshot:
      snapshotByTerm.get(term.id) ??
      ({
        termId: term.id,
        attempts: 0,
        mastery: 0.5,
        weakness: 0.5,
        goalBoost: buildGoalBoost(input.studySet, term),
        priority: 0.5,
        isWeak: false,
        isMastered: false,
      } satisfies PersonalizationSnapshot),
  }));

  candidates.sort((a, b) => b.snapshot.priority - a.snapshot.priority);

  const desiredTargeted = clamp(Math.round(maxItems * targetRate), 1, maxItems);
  const targeted = candidates.slice(0, desiredTargeted).map((entry) => entry.term);
  const targetedIdSet = new Set(targeted.map((term) => term.id));
  const remainder = shuffle(candidates.map((entry) => entry.term).filter((term) => !targetedIdSet.has(term.id)));
  const varietyCount = Math.max(0, maxItems - targeted.length);
  const selected = shuffle([...targeted, ...remainder.slice(0, varietyCount)]);

  return {
    selected,
    targetedCount: targeted.length,
    targetedIds: targeted.map((term) => term.id),
  };
}

export function recordAttemptEvent(
  studySet: StudySet,
  event: PersonalizationAttemptEvent,
): DeckPersonalizationState {
  const now = event.at ?? Date.now();
  const personalization = ensureDeckPersonalizationState(studySet, { forLegacy: !studySet.personalization, now });
  const current = personalization.termStats[event.termId] ?? createDefaultTermPerformance(event.termId, now);

  const attempts = current.attempts + 1;
  const responseMs = typeof event.responseMs === 'number' && Number.isFinite(event.responseMs)
    ? Math.max(0, Math.round(event.responseMs))
    : current.avgResponseMs;
  const avgResponseMs = current.attempts > 0
    ? Math.round(((current.avgResponseMs * current.attempts) + responseMs) / attempts)
    : responseMs;

  let correct = current.correct;
  let incorrect = current.incorrect;
  let currentStreak = current.currentStreak;
  let lastCorrectAt = current.lastCorrectAt;

  if (event.result === 'correct') {
    correct += 1;
    currentStreak += 1;
    lastCorrectAt = now;
  } else if (event.result === 'partial') {
    correct += 0.5;
    incorrect += 0.5;
    currentStreak = Math.max(0, currentStreak);
  } else {
    incorrect += 1;
    currentStreak = 0;
  }

  const confidence = typeof event.confidence === 'number' && Number.isFinite(event.confidence)
    ? clamp(event.confidence, 0, 1)
    : current.confidence;

  return {
    ...personalization,
    termStats: {
      ...personalization.termStats,
      [event.termId]: {
        ...current,
        attempts,
        correct,
        incorrect,
        avgResponseMs,
        currentStreak,
        lastSeenAt: now,
        lastCorrectAt,
        confidence,
      },
    },
    updatedAt: now,
  };
}

export function incrementPersonalizationSession(studySet: StudySet, at = Date.now()): DeckPersonalizationState {
  const personalization = ensureDeckPersonalizationState(studySet, { forLegacy: !studySet.personalization, now: at });
  return {
    ...personalization,
    sessionCount: personalization.sessionCount + 1,
    updatedAt: at,
  };
}

export function resetDeckProgress(
  studySet: StudySet,
  input?: { keepConfig?: boolean; at?: number },
): DeckPersonalizationState {
  const now = input?.at ?? Date.now();
  const personalization = ensureDeckPersonalizationState(studySet, { forLegacy: !studySet.personalization, now });
  if (input?.keepConfig ?? true) {
    return {
      ...personalization,
      termStats: {},
      sessionCount: 0,
      updatedAt: now,
    };
  }
  return createDefaultDeckPersonalizationState({ enabled: personalization.enabled, targetRate: personalization.targetRate, now });
}

export function createDeckPersonalizationSummary(studySet: StudySet) {
  const snapshots = computeTermPriority(studySet);
  const weakCount = snapshots.filter((snapshot) => snapshot.isWeak).length;
  const masteredCount = snapshots.filter((snapshot) => snapshot.isMastered).length;
  const personalization = ensureDeckPersonalizationState(studySet, { forLegacy: !studySet.personalization });

  return {
    weakCount,
    masteredCount,
    targetRate: personalization.targetRate,
    enabled: personalization.enabled,
    sessionCount: personalization.sessionCount,
  };
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

