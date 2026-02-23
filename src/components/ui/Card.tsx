import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

import styles from './Card.module.scss';

type CardPadding = 'sm' | 'md' | 'lg';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  interactive?: boolean;
  padding?: CardPadding;
}

const paddingClassMap = {
  sm: styles.paddingSm,
  md: styles.paddingMd,
  lg: styles.paddingLg,
} satisfies Record<CardPadding, string>;

export function Card({
  children,
  className,
  interactive = false,
  padding = 'md',
  ...props
}: CardProps) {
  return (
    <div
      className={cn(styles.card, interactive && styles.interactive, paddingClassMap[padding], className)}
      {...props}
    >
      {children}
    </div>
  );
}
