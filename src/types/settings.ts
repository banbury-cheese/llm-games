export type AIProvider = 'openai' | 'anthropic' | 'google';

export const STUDY_LIMITS = {
  maxTermsPerDeck: {
    min: 4,
    max: 200,
    default: 40,
  },
  maxCardsPerGame: {
    min: 4,
    max: 100,
    default: 40,
  },
} as const;

export interface AISettings {
  provider: AIProvider;
  model: string;
  apiKey: string;
  maxTermsPerDeck: number;
  maxCardsPerGame: number;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  apiKey: '',
  maxTermsPerDeck: STUDY_LIMITS.maxTermsPerDeck.default,
  maxCardsPerGame: STUDY_LIMITS.maxCardsPerGame.default,
};
