'use client';

import { useRef, useState } from 'react';

import { cn } from '@/lib/cn';

import styles from './UploadZone.module.scss';

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  loading?: boolean;
  fileName?: string;
  helperText?: string;
}

export function UploadZone({ onFileSelected, loading = false, fileName, helperText }: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) return;
    onFileSelected(file);
  };

  return (
    <div
      className={cn(styles.zone, dragActive && styles.active)}
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        handleFile(event.dataTransfer.files?.[0] ?? null);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className={styles.input}
        onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Upload a PDF</p>
          <p className="text-sm leading-6 text-[var(--text-muted)]">
            Drag and drop a PDF or choose a file. We extract text server-side for better compatibility.
          </p>
          {fileName ? <p className="text-xs font-semibold text-olive">Loaded: {fileName}</p> : null}
          {helperText ? <p className="text-xs text-[var(--text-muted)]">{helperText}</p> : null}
        </div>
        <label className={styles.button}>
          {loading ? 'Extracting…' : 'Choose PDF'}
          <input
            type="file"
            accept="application/pdf,.pdf"
            className={styles.input}
            onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
            disabled={loading}
          />
        </label>
      </div>
      <button
        type="button"
        className="absolute inset-0 h-full w-full opacity-0"
        aria-label="Open file picker"
        onClick={() => inputRef.current?.click()}
      />
    </div>
  );
}
