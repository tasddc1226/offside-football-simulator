import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** 단독 화면이면 h1, 화면 제목 아래 상태 영역이면 headingLevel=2. */
  reason: string;
  headingLevel?: 1 | 2;
  /** 안전한 다음 동작 CTA(주로 Button). */
  action?: ReactNode;
}

export function EmptyState({ reason, action, headingLevel = 1 }: EmptyStateProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <div className="flex flex-col items-center gap-os-4 text-center">
      <Heading
        className="font-os font-bold text-os-text"
        style={{ fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' }}
      >
        {reason}
      </Heading>
      {action}
    </div>
  );
}
