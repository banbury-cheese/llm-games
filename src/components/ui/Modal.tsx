'use client';

import { useEffect, type ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import styles from '@/components/ui/Modal.module.scss';

interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function Modal({
  open,
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 id="modal-title" className={styles.title}>
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close modal" className="text-xl leading-none">
            ×
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          {onConfirm ? (
            <Button type="button" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
