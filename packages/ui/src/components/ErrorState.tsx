import type { ReactNode } from 'react';
import { Button } from './Button.js';

export interface ErrorStateProps {
  /** 원인. */
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** 복구(예: 이전 화면으로 돌아가기) 동작. */
  recoveryAction?: ReactNode;
}

export function ErrorState({ message, onRetry, retryLabel = '다시 시도', recoveryAction }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-os-4 text-center">
      <p
        className="font-os text-os-text"
        style={{ fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' }}
      >
        {message}
      </p>
      <div className="flex gap-os-3">
        {onRetry ? (
          <Button variant="primary" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
        {recoveryAction}
      </div>
    </div>
  );
}
