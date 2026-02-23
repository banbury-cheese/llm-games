import { cn } from '@/lib/cn';

import styles from './Spinner.module.scss';

type SpinnerSize = 'sm' | 'md' | 'lg';

export function Spinner({ size = 'md', className }: { size?: SpinnerSize; className?: string }) {
  return <span aria-hidden className={cn(styles.spinner, styles[size], className)} />;
}
