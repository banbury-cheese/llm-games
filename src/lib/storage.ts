import type { StudySet } from '@/types/study-set';
import { DEFAULT_AI_SETTINGS, STUDY_LIMITS, type AISettings } from '@/types/settings';

const isBrowser = typeof window !== 'undefined';

export const STORAGE_KEYS = {
  studySets: 'llm-games:study-sets',
  aiSettings: 'llm-games:ai-settings',
  theme: 'llm-games:theme',
} as const;

function readJSON<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  if (!isBrowser) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function sanitizeAISettings(input: Partial<AISettings>): AISettings {
  const merged = { ...DEFAULT_AI_SETTINGS, ...input };
  return {
    provider: merged.provider,
    model: typeof merged.model === 'string' ? merged.model : DEFAULT_AI_SETTINGS.model,
    apiKey: typeof merged.apiKey === 'string' ? merged.apiKey : DEFAULT_AI_SETTINGS.apiKey,
    maxTermsPerDeck: clampInt(
      merged.maxTermsPerDeck,
      DEFAULT_AI_SETTINGS.maxTermsPerDeck,
      STUDY_LIMITS.maxTermsPerDeck.min,
      STUDY_LIMITS.maxTermsPerDeck.max,
    ),
    maxCardsPerGame: clampInt(
      merged.maxCardsPerGame,
      DEFAULT_AI_SETTINGS.maxCardsPerGame,
      STUDY_LIMITS.maxCardsPerGame.min,
      STUDY_LIMITS.maxCardsPerGame.max,
    ),
  };
}

export const storage = {
  readJSON,
  writeJSON,
  remove(key: string) {
    if (!isBrowser) return;
    window.localStorage.removeItem(key);
  },
};

export const studySetStore = {
  list(): StudySet[] {
    const sets = readJSON<StudySet[]>(STORAGE_KEYS.studySets, []);
    return [...sets].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
  },
  get(id: string): StudySet | null {
    return this.list().find((set) => set.id === id) ?? null;
  },
  saveAll(sets: StudySet[]) {
    writeJSON(STORAGE_KEYS.studySets, sets);
  },
  upsert(nextSet: StudySet) {
    const current = this.list();
    const idx = current.findIndex((set) => set.id === nextSet.id);

    if (idx >= 0) {
      current[idx] = { ...current[idx], ...nextSet, updatedAt: Date.now() };
    } else {
      current.unshift(nextSet);
    }

    this.saveAll(current);
    return nextSet;
  },
  delete(id: string) {
    const next = this.list().filter((set) => set.id !== id);
    this.saveAll(next);
  },
  updateGameData(id: string, gameKey: string, data: unknown) {
    const set = this.get(id);
    if (!set) return null;

    const updated: StudySet = {
      ...set,
      gameData: {
        ...set.gameData,
        [gameKey]: data,
      },
      updatedAt: Date.now(),
    };

    this.upsert(updated);
    return updated;
  },
  removeGameData(id: string, gameKey: string) {
    const set = this.get(id);
    if (!set) return null;

    const nextGameData = { ...set.gameData };
    delete nextGameData[gameKey];

    const updated: StudySet = {
      ...set,
      gameData: nextGameData,
      updatedAt: Date.now(),
    };

    this.upsert(updated);
    return updated;
  },
  clearGameData(id: string) {
    const set = this.get(id);
    if (!set) return null;

    const updated: StudySet = {
      ...set,
      gameData: {},
      updatedAt: Date.now(),
    };

    this.upsert(updated);
    return updated;
  },
};

export const aiSettingsStore = {
  get(): AISettings {
    return sanitizeAISettings(readJSON<Partial<AISettings>>(STORAGE_KEYS.aiSettings, {}));
  },
  set(settings: AISettings) {
    writeJSON(STORAGE_KEYS.aiSettings, sanitizeAISettings(settings));
  },
};
