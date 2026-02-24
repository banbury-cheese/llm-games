export enum GameType {
  Flashcards = 'flashcards',
  Matching = 'matching',
  Quiz = 'quiz',
  TypeIn = 'type-in',
  Crossword = 'crossword',
  Test = 'test',
  Snowman = 'snowman',
  Unscramble = 'unscramble',
  BugMatch = 'bug-match',
  StudyTable = 'study-table',
  Chopped = 'chopped',
  ChatBot = 'chat-bot',
}

export const GAME_LABELS: Record<GameType, string> = {
  [GameType.Flashcards]: 'Flashcards',
  [GameType.Matching]: 'Matching',
  [GameType.Quiz]: 'Quiz',
  [GameType.TypeIn]: 'Type In',
  [GameType.Crossword]: 'Crossword',
  [GameType.Test]: 'Test Mode',
  [GameType.Snowman]: 'Snowman',
  [GameType.Unscramble]: 'Unscramble',
  [GameType.BugMatch]: 'Bug Match',
  [GameType.StudyTable]: 'Study Table',
  [GameType.Chopped]: 'Chopped',
  [GameType.ChatBot]: 'Chat Bot',
};

export const GAME_ICONS: Record<GameType, string> = {
  [GameType.Flashcards]: '🃏',
  [GameType.Matching]: '🔗',
  [GameType.Quiz]: '❓',
  [GameType.TypeIn]: '⌨️',
  [GameType.Crossword]: '🧩',
  [GameType.Test]: '📝',
  [GameType.Snowman]: '☃️',
  [GameType.Unscramble]: '🔠',
  [GameType.BugMatch]: '🐞',
  [GameType.StudyTable]: '📚',
  [GameType.Chopped]: '⏱️',
  [GameType.ChatBot]: '💬',
};

export const GAME_ORDER: GameType[] = [
  GameType.StudyTable,
  GameType.Flashcards,
  GameType.Quiz,
  GameType.Matching,
  GameType.TypeIn,
  GameType.ChatBot,
  GameType.Unscramble,
  GameType.Snowman,
  GameType.BugMatch,
  GameType.Chopped,
  GameType.Crossword,
  GameType.Test,
];

export const IMPLEMENTED_GAMES = new Set<GameType>([
  GameType.StudyTable,
  GameType.Flashcards,
  GameType.Quiz,
  GameType.Matching,
  GameType.TypeIn,
  GameType.ChatBot,
  GameType.Unscramble,
  GameType.Snowman,
]);

// Backward-compatible alias used by existing files before Phase 6.
export const PHASE5_AVAILABLE_GAMES = IMPLEMENTED_GAMES;

export interface GameDescriptor {
  type: GameType;
  label: string;
  icon: string;
  available: boolean;
}

export const GAME_CATALOG: GameDescriptor[] = GAME_ORDER.map((type) => ({
  type,
  label: GAME_LABELS[type],
  icon: GAME_ICONS[type],
  available: IMPLEMENTED_GAMES.has(type),
}));
