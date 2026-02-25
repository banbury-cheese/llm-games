import { BugMatchGame } from '@/components/games/BugMatchGame';
import { ChoppedGame } from '@/components/games/ChoppedGame';
import { ComingSoonGame } from '@/components/games/ComingSoonGame';
import { CrosswordGame } from '@/components/games/CrosswordGame';
import { ChatBotGame } from '@/components/games/ChatBotGame';
import { FlashcardsGame } from '@/components/games/FlashcardsGame';
import { HungryBugGame } from '@/components/games/HungryBugGame';
import { MatchingGame } from '@/components/games/MatchingGame';
import { QuizGame } from '@/components/games/QuizGame';
import { SnowmanGame } from '@/components/games/SnowmanGame';
import { StudyTableGame } from '@/components/games/StudyTableGame';
import { TestModeGame } from '@/components/games/TestModeGame';
import { TypeInGame } from '@/components/games/TypeInGame';
import { UnscrambleGame } from '@/components/games/UnscrambleGame';
import type { GameComponentProps } from '@/components/games/types';
import { GameType, IMPLEMENTED_GAMES } from '@/types/game';

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
    case GameType.TypeIn:
      return TypeInGame;
    case GameType.ChatBot:
      return ChatBotGame;
    case GameType.Unscramble:
      return UnscrambleGame;
    case GameType.Snowman:
      return SnowmanGame;
    case GameType.HungryBug:
      return HungryBugGame;
    case GameType.BugMatch:
      return BugMatchGame;
    case GameType.Chopped:
      return ChoppedGame;
    case GameType.Crossword:
      return CrosswordGame;
    case GameType.Test:
      return TestModeGame;
    default:
      return ComingSoonGame;
  }
}

export function isValidGameType(value: string): value is GameType {
  return Object.values(GameType).includes(value as GameType);
}

export function isGameAvailableInCurrentBuild(gameType: GameType) {
  return IMPLEMENTED_GAMES.has(gameType);
}

export type { GameComponentProps };
