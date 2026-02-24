import { aiSettingsStore, studySetStore } from '@/lib/storage';
import { GameType } from '@/types/game';
import type { StudySet, Term } from '@/types/study-set';

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
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
  switch (gameType) {
    case GameType.StudyTable:
      return { rows: studySet.terms };
    case GameType.Flashcards:
      return { cards: studySet.terms };
    case GameType.Matching:
      return {
        instructions: 'Match each term to the correct definition.',
        pairs: shuffle(studySet.terms)
          .slice(0, 8)
          .map((term) => ({ id: term.id, term: term.term, definition: term.definition })),
      };
    case GameType.Quiz:
      return buildLocalQuiz(studySet.terms);
    case GameType.TypeIn:
      return buildLocalTypeIn(studySet.terms);
    case GameType.Unscramble:
      return buildLocalUnscramble(studySet.terms);
    case GameType.Snowman:
      return buildLocalSnowman(studySet.terms);
    case GameType.ChatBot:
      return { items: [] };
    default:
      return { items: [] };
  }
}

export async function generateAndCacheGameData(studySet: StudySet, gameType: GameType) {
  const cached = studySet.gameData?.[gameType];
  if (cached) {
    return { data: cached, source: 'cache' as const };
  }

  if (
    gameType === GameType.StudyTable ||
    gameType === GameType.Flashcards ||
    gameType === GameType.Matching ||
    gameType === GameType.TypeIn ||
    gameType === GameType.Unscramble ||
    gameType === GameType.Snowman ||
    gameType === GameType.ChatBot
  ) {
    const localData = buildLocalGameData(gameType, studySet);
    studySetStore.updateGameData(studySet.id, gameType, localData);
    return { data: localData, source: 'local' as const };
  }

  if (gameType === GameType.Quiz) {
    const settings = aiSettingsStore.get();
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'game-data',
        gameType,
        terms: studySet.terms.map((term) => ({ term: term.term, definition: term.definition })),
        settings,
      }),
    });

    const payload = (await response.json()) as { data?: unknown; warning?: string; error?: unknown; source?: string };

    if (!response.ok || !payload.data) {
      const localData = buildLocalGameData(gameType, studySet);
      studySetStore.updateGameData(studySet.id, gameType, localData);
      return {
        data: localData,
        source: 'local' as const,
        warning: typeof payload.error === 'string' ? payload.error : 'Quiz generation failed. Using local fallback.',
      };
    }

    studySetStore.updateGameData(studySet.id, gameType, payload.data);
    return {
      data: payload.data,
      source: (payload.source as 'llm' | 'fallback' | undefined) ?? 'llm',
      warning: payload.warning,
    };
  }

  const localData = buildLocalGameData(gameType, studySet);
  studySetStore.updateGameData(studySet.id, gameType, localData);
  return { data: localData, source: 'local' as const };
}
