export interface PersonalizationConfig {
  enabled: boolean;
  targetRate: number;
}

export interface TermPerformance {
  termId: string;
  attempts: number;
  correct: number;
  incorrect: number;
  avgResponseMs: number;
  currentStreak: number;
  lastSeenAt: number;
  lastCorrectAt?: number;
  confidence?: number;
}

export interface DeckPersonalizationState extends PersonalizationConfig {
  termStats: Record<string, TermPerformance>;
  sessionCount: number;
  updatedAt: number;
}

export interface PersonalizationSnapshot {
  termId: string;
  attempts: number;
  mastery: number;
  weakness: number;
  goalBoost: number;
  priority: number;
  isWeak: boolean;
  isMastered: boolean;
}

export interface PersonalizationAttemptEvent {
  termId: string;
  result: 'correct' | 'partial' | 'wrong';
  responseMs?: number;
  confidence?: number;
  at?: number;
}

