import type { GameType } from '@/types/game';
import type { StudySet } from '@/types/study-set';

export interface GameComponentProps {
  studySet: StudySet;
  gameType: GameType;
  data: unknown;
}
