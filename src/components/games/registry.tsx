import { ComingSoonGame } from '@/components/games/ComingSoonGame';
import { FlashcardsGame } from '@/components/games/FlashcardsGame';
import { MatchingGame } from '@/components/games/MatchingGame';
import { QuizGame } from '@/components/games/QuizGame';
import { StudyTableGame } from '@/components/games/StudyTableGame';
import type { GameComponentProps } from '@/components/games/types';
import { GameType, PHASE5_AVAILABLE_GAMES } from '@/types/game';

export function getGameComponent(gameType: GameType) {
  switch (gameType) {
    case GameType.StudyTable:
      return StudyTableGame;
    case GameType.Flashcards:
      return FlashcardsGame;
    case GameType.Quiz:
      return QuizGame;
    case GameType.Matching:
      return MatchingGame;
    default:
      return ComingSoonGame;
  }
}

export function isValidGameType(value: string): value is GameType {
  return Object.values(GameType).includes(value as GameType);
}

export function isGameAvailableInCurrentBuild(gameType: GameType) {
  return PHASE5_AVAILABLE_GAMES.has(gameType);
}

export type { GameComponentProps };
