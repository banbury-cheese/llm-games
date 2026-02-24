import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

import styles from './TextArea.module.scss';

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea(props, ref) {
    const { className, ...rest } = props;
    return <textarea ref={ref} className={cn(styles.textarea, className)} {...rest} />;
  },
);
