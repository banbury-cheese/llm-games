import { aiSettingsStore, studySetStore } from '@/lib/storage';
import { getAnalyticsRequestHeaders } from '@/lib/analytics/session';
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
    items: terms.slice(0, 20).map((term) => ({
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
  const selected = terms.slice(0, 10);
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
      id: `${index + 1}`,
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
  const limitedTerms = sampleUpTo(studySet.terms, maxTermsPerDeck);

  const localData = (() => {
  switch (gameType) {
    case GameType.StudyTable:
      return { rows: limitedTerms };
    case GameType.Flashcards:
      return { cards: limitedTerms };
    case GameType.Matching:
      return {
        instructions: 'Match each term to the correct definition.',
        pairs: shuffle(limitedTerms)
          .slice(0, 8)
          .map((term) => ({ id: term.id, term: term.term, definition: term.definition })),
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
    return { data: capGameDataCollections(cached, limits.maxCardsPerGame), source: 'cache' as const };
  }

  if (
    gameType === GameType.StudyTable ||
    gameType === GameType.Flashcards ||
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
    return { data: capGameDataCollections(localData, limits.maxCardsPerGame), source: 'local' as const };
  }

  if (gameType === GameType.Quiz) {
    const settings = aiSettingsStore.get();
    const sampledTerms = sampleUpTo(studySet.terms, limits.maxTermsPerDeck);
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAnalyticsRequestHeaders(),
      },
      body: JSON.stringify({
        mode: 'game-data',
        gameType,
        terms: sampledTerms.map((term) => ({ term: term.term, definition: term.definition })),
        settings,
      }),
    });

    const payload = (await response.json()) as { data?: unknown; warning?: string; error?: unknown; source?: string };

    if (!response.ok || !payload.data) {
      const localData = buildLocalGameData(gameType, studySet);
      studySetStore.updateGameData(studySet.id, gameType, localData);
      return {
        data: capGameDataCollections(localData, limits.maxCardsPerGame),
        source: 'local' as const,
        warning: typeof payload.error === 'string' ? payload.error : 'Quiz generation failed. Using local fallback.',
      };
    }

    studySetStore.updateGameData(studySet.id, gameType, payload.data);
    return {
      data: capGameDataCollections(payload.data, limits.maxCardsPerGame),
      source: (payload.source as 'llm' | 'fallback' | undefined) ?? 'llm',
      warning: payload.warning,
    };
  }

  const localData = buildLocalGameData(gameType, studySet);
  studySetStore.updateGameData(studySet.id, gameType, localData);
  return { data: capGameDataCollections(localData, limits.maxCardsPerGame), source: 'local' as const };
}
