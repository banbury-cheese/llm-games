import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { Spinner } from '@/components/ui/Spinner';

import styles from './Button.module.scss';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        styles.button,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : null}
      <span>{children}</span>
    </button>
  );
}
