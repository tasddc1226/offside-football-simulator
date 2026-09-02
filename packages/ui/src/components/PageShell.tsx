import type { ReactNode } from 'react';

export interface PageShellProps {
  children: ReactNode;
  /** 하단 고정 CTA 슬롯. */
  footer?: ReactNode;
}

export function PageShell({ children, footer }: PageShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-os-bg text-os-text">
      <main
        className="mx-auto w-full max-w-[640px] flex-1 px-os-4 py-os-6 lg:max-w-[1120px]"
        style={{ paddingTop: 'calc(var(--os-safe-top) + var(--os-space-6))' }}
      >
        {children}
      </main>
      {footer ? (
        <footer
          className="sticky bottom-0 border-t border-os-border bg-os-bg px-os-4 py-os-3"
          style={{ paddingBottom: 'calc(var(--os-safe-bottom) + var(--os-space-3))' }}
        >
          <div className="mx-auto w-full max-w-[640px] lg:max-w-[1120px]">{footer}</div>
        </footer>
      ) : null}
    </div>
  );
}
