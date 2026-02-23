import type { StudySet } from '@/types/study-set';
import { DEFAULT_AI_SETTINGS, type AISettings } from '@/types/settings';

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
    return [...sets].sort((a, b) => b.createdAt - a.createdAt);
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
};

export const aiSettingsStore = {
  get(): AISettings {
    return { ...DEFAULT_AI_SETTINGS, ...readJSON<Partial<AISettings>>(STORAGE_KEYS.aiSettings, {}) };
  },
  set(settings: AISettings) {
    writeJSON(STORAGE_KEYS.aiSettings, settings);
  },
};
