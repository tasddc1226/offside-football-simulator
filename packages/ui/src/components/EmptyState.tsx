import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** 화면의 유일한 h1로 렌더한다. 이유 문구. */
  reason: string;
  /** 안전한 다음 동작 CTA(주로 Button). */
  action?: ReactNode;
}

export function EmptyState({ reason, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-os-4 text-center">
      <h1
        className="font-os font-bold text-os-text"
        style={{ fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' }}
      >
        {reason}
      </h1>
      {action}
    </div>
  );
}
