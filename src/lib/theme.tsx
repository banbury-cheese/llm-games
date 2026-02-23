'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { STORAGE_KEYS } from '@/lib/storage';

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  mounted: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove('theme-light', 'theme-dark');
  root.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEYS.theme) as Theme | null;
    const systemPrefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const initial = stored === 'dark' || stored === 'light' ? stored : systemPrefersDark ? 'dark' : 'light';

    setThemeState(initial);
    applyThemeClass(initial);
    setMounted(true);
  }, []);

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);
    window.localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
    applyThemeClass(nextTheme);
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      mounted,
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    }),
    [theme, mounted],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
}
