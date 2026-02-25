'use client';

import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, style, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-xl border',
        className,
      )}
      style={{
        borderColor: 'rgba(255,255,255,0.05)',
        background:
          'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)',
        ...style,
      }}
      {...props}
    />
  );
}
