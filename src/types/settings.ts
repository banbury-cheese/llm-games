export type AIProvider = 'openai' | 'anthropic' | 'google';

export interface AISettings {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  apiKey: '',
};
