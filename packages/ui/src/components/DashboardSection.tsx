import type { ReactNode } from 'react';

export interface DashboardSectionProps {
  title: string;
  description: string;
  children: ReactNode;
  /** 잠금 상태. 잠기면 흐리게 표시하고 aria-disabled를 단다(06-ui-ux-specification.md 잠긴 구역). */
  locked?: boolean;
  /** 잠금 사유 문장. locked일 때만 표시한다. */
  lockReason?: string;
}

export function DashboardSection({ title, description, children, locked, lockReason }: DashboardSectionProps) {
  const classes = [
    'flex flex-col gap-os-3 rounded-os-m border border-os-border bg-os-surface p-os-4',
    locked ? 'opacity-50' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={classes} aria-disabled={locked ? true : undefined}>
      <div className="flex flex-col gap-os-1">
        <h2 className="font-os font-semibold text-os-text" style={{ fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' }}>
          {title}
        </h2>
        <p className="font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}>
          {description}
        </p>
        {locked && lockReason ? (
          <p className="font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}>
            {lockReason}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-os-3">{children}</div>
    </section>
  );
}
