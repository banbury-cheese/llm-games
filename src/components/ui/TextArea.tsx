import type { TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

import styles from './TextArea.module.scss';

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return <textarea className={cn(styles.textarea, className)} {...rest} />;
}
