import type { InputHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

import styles from './Input.module.scss';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input className={cn(styles.input, className)} {...rest} />;
}
