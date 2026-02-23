import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';

import type { AIProvider, AISettings } from '@/types/settings';

export type RuntimeAISettings = Pick<AISettings, 'provider' | 'model' | 'apiKey'>;

function createProviderClient(provider: AIProvider, apiKey: string) {
  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey });
    case 'anthropic':
      return createAnthropic({ apiKey });
    case 'google':
      return createGoogleGenerativeAI({ apiKey });
    default:
      throw new Error(`Unsupported provider: ${provider satisfies never}`);
  }
}

export function getLanguageModel(settings: RuntimeAISettings) {
  const { provider, model, apiKey } = settings;

  if (!apiKey?.trim()) {
    throw new Error('Missing API key. Save a provider API key in Settings.');
  }

  const client = createProviderClient(provider, apiKey.trim());
  return client(model);
}

export function getDefaultModelForProvider(provider: AIProvider) {
  switch (provider) {
    case 'openai':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-sonnet-4-5-20250929';
    case 'google':
      return 'gemini-1.5-flash';
  }
}
