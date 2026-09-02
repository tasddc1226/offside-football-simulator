import { useEffect, useState } from 'react';

export type ToastVariant = 'success' | 'error';

export interface ToastProps {
  variant: ToastVariant;
  message: string;
  onDismiss: () => void;
  /** 자동 닫힘까지의 시간(ms). 기본 4000. */
  durationMs?: number;
}

const VARIANT_BORDER_CLASS: Record<ToastVariant, string> = {
  success: 'border-os-success',
  error: 'border-os-danger',
};

export function Toast({ variant, message, onDismiss, durationMs = 4000 }: ToastProps) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const id = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(id);
  }, [onDismiss, durationMs]);

  const classes = [
    'flex items-center gap-os-2 rounded-os-m border bg-os-surface px-os-4 py-os-3 font-os text-os-text transition-opacity duration-200',
    VARIANT_BORDER_CLASS[variant],
    entered ? 'opacity-100' : 'opacity-0',
  ].join(' ');

  return (
    <div role="status" className={classes} style={{ fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' }}>
      {message}
    </div>
  );
}
