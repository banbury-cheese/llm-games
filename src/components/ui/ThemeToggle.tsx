'use client';

import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';

import styles from './ThemeToggle.module.scss';

export function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme();

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={toggleTheme}
      className={cn(styles.toggle, theme === 'dark' && styles.dark)}
      title={mounted ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme` : 'Toggle theme'}
    >
      <span className={styles.icons} aria-hidden>
        <span>☀️</span>
        <span>🌙</span>
      </span>
      <span className={styles.thumb} aria-hidden>
        {theme === 'dark' ? '🌙' : '☀️'}
      </span>
    </button>
  );
}
