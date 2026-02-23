import { GroupAPreviewGame } from '@/components/games/GroupAPreviewGame';
import { ComingSoonGame } from '@/components/games/ComingSoonGame';
import type { GameComponentProps } from '@/components/games/types';
import { GameType, PHASE5_AVAILABLE_GAMES } from '@/types/game';

export function getGameComponent(gameType: GameType) {
  if (PHASE5_AVAILABLE_GAMES.has(gameType)) {
    return GroupAPreviewGame;
  }

  return ComingSoonGame;
}

export function isValidGameType(value: string): value is GameType {
  return Object.values(GameType).includes(value as GameType);
}

export function isGameAvailableInCurrentBuild(gameType: GameType) {
  return PHASE5_AVAILABLE_GAMES.has(gameType);
}

export type { GameComponentProps };
