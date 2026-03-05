import { aiSettingsStore, studySetStore } from '@/lib/storage';
import { computeTermPriority, selectPersonalizedTerms } from '@/lib/personalization';
import { GameType } from '@/types/game';
import type { StudySet, Term } from '@/types/study-set';

const GAME_DATA_ARRAY_KEYS = ['rows', 'cards', 'pairs', 'questions', 'items', 'rounds', 'puzzles', 'entries'] as const;

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function sampleUpTo<T>(items: T[], maxItems: number) {
  if (items.length <= maxItems) return [...items];
  return shuffle(items).slice(0, maxItems);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getGameRoundLimit(gameType: GameType, maxItems: number) {
  switch (gameType) {
    case GameType.Quiz:
      return Math.min(maxItems, 10);
    case GameType.Matching:
      return Math.min(maxItems, 8);
    case GameType.TypeIn:
      return Math.min(maxItems, 20);
    default:
      return maxItems;
  }
}

function buildTermLookup(studySet: StudySet) {
  const byId = new Map(studySet.terms.map((term) => [term.id, term]));
  const byTerm = new Map(studySet.terms.map((term) => [normalizeText(term.term), term]));
  const byDefinition = new Map(studySet.terms.map((term) => [normalizeText(term.definition), term]));
  return { byId, byTerm, byDefinition };
}

function resolveTermIdFromFields(
  lookup: ReturnType<typeof buildTermLookup>,
  explicitId: string | undefined,
  ...fields: Array<string | undefined>
) {
  if (explicitId) {
    const exact = lookup.byId.get(explicitId);
    if (exact) return exact.id;
  }

  for (const value of fields) {
    if (!value) continue;
    const normalized = normalizeText(value);
    if (!normalized) continue;
    const byTerm = lookup.byTerm.get(normalized);
    if (byTerm) return byTerm.id;
    const byDefinition = lookup.byDefinition.get(normalized);
    if (byDefinition) return byDefinition.id;
  }

  return null;
}

function getGenerationLimits() {
  const settings = aiSettingsStore.get();
  return {
    maxTermsPerDeck: settings.maxTermsPerDeck,
    maxCardsPerGame: settings.maxCardsPerGame,
  };
}

function capGameDataCollections(data: unknown, maxItems: number) {
  if (!data || typeof data !== 'object') return data;

  const record = data as Record<string, unknown>;
  let changed = false;
  const next: Record<string, unknown> = { ...record };

  for (const key of GAME_DATA_ARRAY_KEYS) {
    const value = record[key];
    if (!Array.isArray(value)) continue;
    if (value.length <= maxItems) continue;
    next[key] = sampleUpTo(value, maxItems);
    changed = true;
  }

  return changed ? next : data;
}

function selectRecordsByPersonalization<T>(
  records: T[],
  maxItems: number,
  studySet: StudySet,
  resolveTermId: (record: T) => string | null,
) {
  if (records.length <= maxItems) return [...records];

  const candidateTermIds = new Set<string>();
  records.forEach((record) => {
    const termId = resolveTermId(record);
    if (termId) candidateTermIds.add(termId);
  });

  const candidateTerms = studySet.terms.filter((term) => candidateTermIds.has(term.id));
  if (!candidateTerms.length) {
    return sampleUpTo(records, maxItems);
  }

  const selection = selectPersonalizedTerms({
    studySet,
    terms: candidateTerms,
    maxItems: Math.min(maxItems, candidateTerms.length),
  });

  const targetSet = new Set(selection.targetedIds);
  const targetedRecords = records.filter((record) => {
    const termId = resolveTermId(record);
    return termId ? targetSet.has(termId) : false;
  });
  const targetedRecordSet = new Set(targetedRecords);
  const remainingRecords = records.filter((record) => !targetedRecordSet.has(record));

  return [...shuffle(targetedRecords), ...shuffle(remainingRecords)].slice(0, maxItems);
}

function capCoreGameData(gameType: GameType, data: unknown, studySet: StudySet, maxItems: number) {
  const roundLimit = getGameRoundLimit(gameType, maxItems);
  if (!data || typeof data !== 'object') return data;

  const next = { ...(data as Record<string, unknown>) };
  const lookup = buildTermLookup(studySet);

  if (gameType === GameType.Flashcards && Array.isArray(next.cards)) {
    next.cards = selectRecordsByPersonalization(
      next.cards,
      roundLimit,
      studySet,
      (record) => {
        if (!record || typeof record !== 'object') return null;
        const item = record as { id?: unknown; term?: unknown; definition?: unknown };
        return resolveTermIdFromFields(
          lookup,
          typeof item.id === 'string' ? item.id : undefined,
          typeof item.term === 'string' ? item.term : undefined,
          typeof item.definition === 'string' ? item.definition : undefined,
        );
      },
    );
    return next;
  }

  if (gameType === GameType.Matching && Array.isArray(next.pairs)) {
    next.pairs = selectRecordsByPersonalization(
      next.pairs,
      roundLimit,
      studySet,
      (record) => {
        if (!record || typeof record !== 'object') return null;
        const item = record as { id?: unknown; term?: unknown; definition?: unknown };
        return resolveTermIdFromFields(
          lookup,
          typeof item.id === 'string' ? item.id : undefined,
          typeof item.term === 'string' ? item.term : undefined,
          typeof item.definition === 'string' ? item.definition : undefined,
        );
      },
    );
    return next;
  }

  if (gameType === GameType.TypeIn && Array.isArray(next.items)) {
    next.items = selectRecordsByPersonalization(
      next.items,
      roundLimit,
      studySet,
      (record) => {
        if (!record || typeof record !== 'object') return null;
        const item = record as { id?: unknown; answer?: unknown; term?: unknown; clue?: unknown; definition?: unknown };
        return resolveTermIdFromFields(
          lookup,
          typeof item.id === 'string' ? item.id : undefined,
          typeof item.answer === 'string' ? item.answer : undefined,
          typeof item.term === 'string' ? item.term : undefined,
          typeof item.clue === 'string' ? item.clue : undefined,
          typeof item.definition === 'string' ? item.definition : undefined,
        );
      },
    );
    return next;
  }

  if (gameType === GameType.Quiz && Array.isArray(next.questions)) {
    if (!studySet.personalization?.enabled) {
      next.questions = sampleUpTo(shuffle(next.questions), roundLimit);
      return next;
    }

    const snapshots = new Map(computeTermPriority(studySet).map((snapshot) => [snapshot.termId, snapshot]));
    const scored = shuffle(next.questions).map((question) => {
      if (!question || typeof question !== 'object') return { question, score: 0.5 };
      const item = question as { termId?: unknown; options?: unknown[]; prompt?: unknown; explanation?: unknown };
      const termIds = new Set<string>();

      if (typeof item.termId === 'string') {
        const explicitId = resolveTermIdFromFields(lookup, item.termId);
        if (explicitId) termIds.add(explicitId);
      }
      if (Array.isArray(item.options)) {
        item.options.forEach((option) => {
          if (typeof option !== 'string') return;
          const id = resolveTermIdFromFields(lookup, undefined, option);
          if (id) termIds.add(id);
        });
      }
      if (typeof item.prompt === 'string') {
        const id = resolveTermIdFromFields(lookup, undefined, item.prompt);
        if (id) termIds.add(id);
      }
      if (typeof item.explanation === 'string') {
        const id = resolveTermIdFromFields(lookup, undefined, item.explanation);
        if (id) termIds.add(id);
      }

      const score = termIds.size
        ? Math.max(...Array.from(termIds).map((id) => snapshots.get(id)?.priority ?? 0.5))
        : 0.5;
      return { question, score };
    });

    const targetRate = studySet.personalization?.targetRate ?? 0.4;
    const targetCount = Math.max(1, Math.min(roundLimit, Math.round(roundLimit * targetRate)));
    const sorted = [...scored].sort((a, b) => b.score - a.score);
    const targeted = sorted.slice(0, targetCount).map((entry) => entry.question);
    const targetedSet = new Set(targeted);
    const rest = shuffle(sorted.map((entry) => entry.question).filter((question) => !targetedSet.has(question)));
    next.questions = [...targeted, ...rest].slice(0, roundLimit);
    return next;
  }

  return capGameDataCollections(next, maxItems);
}

function normalizeForWordGames(term: Term) {
  const cleaned = term.term
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-zA-Z\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

function scrambleWord(word: string) {
  const chars = word.split('');
  let next = shuffle(chars);

  // Avoid returning the same order when possible.
  if (next.join('') === word && word.length > 1) {
    next = [...chars.slice(1), chars[0]];
  }

  return next.join('');
}

function buildLocalTypeIn(terms: Term[]) {
  return {
    items: terms.map((term) => ({
      id: term.id,
      answer: term.term,
      clue: term.definition,
    })),
  };
}

function buildLocalChoiceQuestions(terms: Term[], optionCount: number, questionCount: number) {
  const selected = terms.slice(0, questionCount);

  return selected.map((term, index) => {
    const distractors = shuffle(
      selected
        .filter((_, currentIndex) => currentIndex !== index)
        .map((item) => item.term),
    ).slice(0, Math.max(1, optionCount - 1));

    while (distractors.length < optionCount - 1) {
      distractors.push(`Option ${distractors.length + 1}`);
    }

    const options = shuffle([...distractors, term.term]).slice(0, optionCount);

    return {
      id: term.id,
      prompt: `Which term matches this definition? ${term.definition}`,
      options,
      correctIndex: options.findIndex((option) => option === term.term),
      explanation: `${term.term}: ${term.definition}`,
    };
  });
}

function splitIntoChunks(answer: string, seed: number) {
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < answer.length) {
    const remaining = answer.length - cursor;
    if (remaining <= 3) {
      chunks.push(answer.slice(cursor));
      break;
    }

    const width = ((seed + cursor) % 2) + 2;
    const size = Math.min(width, remaining - 2);
    chunks.push(answer.slice(cursor, cursor + size));
    cursor += size;
  }

  return chunks.filter(Boolean);
}

function buildLocalHungryBug(terms: Term[]) {
  return {
    items: buildLocalChoiceQuestions(terms, 3, 10),
    note: 'Local hungry-bug question set.',
  };
}

function buildLocalBugMatch(terms: Term[]) {
  return {
    items: buildLocalChoiceQuestions(terms, 4, 12),
    note: 'Local bug-match question set.',
  };
}

function buildLocalChopped(terms: Term[]) {
  const puzzles = terms
    .map((term, index) => {
      const displayAnswer = normalizeForWordGames(term).trim() || term.term;
      const answer = displayAnswer.replace(/[^a-zA-Z]/g, '').toUpperCase();
      return {
        id: term.id,
        answer,
        displayAnswer,
        clue: term.definition,
        chunks: splitIntoChunks(answer, index),
      };
    })
    .filter((puzzle) => puzzle.answer.length >= 4 && puzzle.answer.length <= 14 && puzzle.chunks.length >= 2)
    .slice(0, 8);

  return {
    puzzles,
    note: 'Local chopped chunk puzzles.',
  };
}

function buildLocalCrossword(terms: Term[]) {
  const entries = terms
    .map((term, index) => ({
      id: term.id,
      answer: term.term,
      displayAnswer: term.term,
      clue: term.definition,
      row: index * 2,
      col: (index * 2) % 5,
    }))
    .slice(0, 8);

  return {
    entries,
    note: 'Local crossword entries.',
  };
}

function buildLocalTest(terms: Term[]) {
  const selected = terms.slice(0, 9);

  const items = selected.map((term, index) => {
    const mode = index % 3;
    if (mode === 0) {
      const [question] = buildLocalChoiceQuestions(selected.filter(Boolean), 4, selected.length).slice(index, index + 1);
      return {
        ...(question ?? {
          id: `mcq-${term.id}`,
          prompt: `Which term matches this definition? ${term.definition}`,
          options: [term.term, 'Option 1', 'Option 2', 'Option 3'],
          correctIndex: 0,
          explanation: `${term.term}: ${term.definition}`,
        }),
        id: `mcq-${term.id}`,
        kind: 'mcq',
      };
    }

    if (mode === 1) {
      return {
        id: `type-${term.id}`,
        kind: 'type-in',
        prompt: `Type the term for this definition: ${term.definition}`,
        answer: term.term,
        explanation: `${term.term}: ${term.definition}`,
      };
    }

    const alternate = selected[(index + 1) % selected.length] ?? term;
    const isTrue = index % 2 === 0;
    return {
      id: `tf-${term.id}`,
      kind: 'true-false',
      prompt: `True or False: "${term.term}" is defined as "${isTrue ? term.definition : alternate.definition}".`,
      options: ['True', 'False'],
      correctIndex: isTrue ? 0 : 1,
      explanation: `${term.term}: ${term.definition}`,
    };
  });

  return {
    items,
    note: 'Local mixed test items.',
  };
}

function buildLocalUnscramble(terms: Term[]) {
  const candidates = terms
    .map((term) => {
      const normalized = normalizeForWordGames(term);
      const answer = normalized.replace(/\s+/g, '');
      return {
        id: term.id,
        answer,
        displayAnswer: normalized,
        clue: term.definition,
      };
    })
    .filter((item) => item.answer.length >= 4 && item.answer.length <= 12)
    .slice(0, 10);

  return {
    items: candidates.map((item) => ({
      id: item.id,
      answer: item.answer,
      displayAnswer: item.displayAnswer,
      clue: item.clue,
      scrambled: scrambleWord(item.answer.toUpperCase()),
    })),
  };
}

function buildLocalSnowman(terms: Term[]) {
  const rounds = terms
    .map((term) => {
      const normalized = normalizeForWordGames(term);
      const answer = normalized.replace(/\s+/g, '').toUpperCase();
      return {
        id: term.id,
        answer,
        displayAnswer: normalized,
        clue: term.definition,
      };
    })
    .filter((item) => item.answer.length >= 4 && item.answer.length <= 12)
    .slice(0, 8);

  return {
    rounds: rounds.map((round) => ({
      ...round,
      hint: `Starts with “${round.answer[0]}” and has ${round.answer.length} letters.`,
    })),
  };
}

function buildLocalQuiz(terms: Term[]) {
  const selected = terms;
  const questions = selected.map((term, index) => {
    const distractors = shuffle(
      selected
        .filter((_, currentIndex) => currentIndex !== index)
        .map((item) => item.term),
    ).slice(0, 3);

    while (distractors.length < 3) {
      distractors.push(`Option ${distractors.length + 1}`);
    }

    const options = shuffle([...distractors, term.term]);

    return {
      id: term.id,
      termId: term.id,
      prompt: `Which term matches this definition? ${term.definition}`,
      options,
      correctIndex: options.findIndex((option) => option === term.term),
      explanation: `${term.term}: ${term.definition}`,
    };
  });

  return { title: 'Quick Quiz', questions };
}

export function buildLocalGameData(gameType: GameType, studySet: StudySet) {
  const { maxTermsPerDeck } = getGenerationLimits();
  const limitedTerms =
    studySet.terms.length > maxTermsPerDeck
      ? sampleUpTo(studySet.terms, maxTermsPerDeck)
      : [...studySet.terms];

  const localData = (() => {
  switch (gameType) {
    case GameType.StudyTable:
      return { rows: limitedTerms };
    case GameType.Flashcards:
      return { cards: limitedTerms };
    case GameType.Matching:
      return {
        instructions: 'Match each term to the correct definition.',
        pairs: limitedTerms.map((term) => ({ id: term.id, term: term.term, definition: term.definition })),
      };
    case GameType.Quiz:
      return buildLocalQuiz(limitedTerms);
    case GameType.TypeIn:
      return buildLocalTypeIn(limitedTerms);
    case GameType.HungryBug:
      return buildLocalHungryBug(limitedTerms);
    case GameType.Unscramble:
      return buildLocalUnscramble(limitedTerms);
    case GameType.Snowman:
      return buildLocalSnowman(limitedTerms);
    case GameType.BugMatch:
      return buildLocalBugMatch(limitedTerms);
    case GameType.Chopped:
      return buildLocalChopped(limitedTerms);
    case GameType.Crossword:
      return buildLocalCrossword(limitedTerms);
    case GameType.Test:
      return buildLocalTest(limitedTerms);
    case GameType.ChatBot:
      return { items: [] };
    default:
      return { items: [] };
  }
  })();

  // Keep the cached local payload uncapped so per-start sampling can happen at read-time.
  // The caller is responsible for applying the per-game cap before returning data to the UI.
  return localData;
}

export async function generateAndCacheGameData(
  studySet: StudySet,
  gameType: GameType,
  options?: { force?: boolean },
) {
  const limits = getGenerationLimits();
  const cached = studySet.gameData?.[gameType];
  if (cached && !options?.force) {
    return { data: capCoreGameData(gameType, cached, studySet, limits.maxCardsPerGame), source: 'cache' as const };
  }

  if (
    gameType === GameType.StudyTable ||
    gameType === GameType.Flashcards ||
    gameType === GameType.Quiz ||
    gameType === GameType.Matching ||
    gameType === GameType.TypeIn ||
    gameType === GameType.HungryBug ||
    gameType === GameType.Unscramble ||
    gameType === GameType.Snowman ||
    gameType === GameType.BugMatch ||
    gameType === GameType.Chopped ||
    gameType === GameType.Crossword ||
    gameType === GameType.Test ||
    gameType === GameType.ChatBot
  ) {
    const localData = buildLocalGameData(gameType, studySet);
    studySetStore.updateGameData(studySet.id, gameType, localData);
    return { data: capCoreGameData(gameType, localData, studySet, limits.maxCardsPerGame), source: 'local' as const };
  }

  const localData = buildLocalGameData(gameType, studySet);
  studySetStore.updateGameData(studySet.id, gameType, localData);
  return { data: capCoreGameData(gameType, localData, studySet, limits.maxCardsPerGame), source: 'local' as const };
}
