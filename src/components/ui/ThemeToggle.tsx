'use client';

import { ThemeMoonIcon, ThemeSunIcon } from '@/components/ui/BrandIcons';
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
        <ThemeSunIcon className={styles.trackIcon} />
        <ThemeMoonIcon className={styles.trackIcon} />
      </span>
      <span className={styles.thumb} aria-hidden>
        {theme === 'dark' ? (
          <ThemeMoonIcon className={styles.thumbIcon} />
        ) : (
          <ThemeSunIcon className={styles.thumbIcon} />
        )}
      </span>
    </button>
  );
}
