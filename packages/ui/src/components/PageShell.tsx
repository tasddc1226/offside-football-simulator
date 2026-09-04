import type { ReactNode } from 'react';

export interface PageShellProps {
  children: ReactNode;
  /** 하단 고정 CTA 슬롯. */
  footer?: ReactNode;
  header?: ReactNode;
}

export function PageShell({ children, footer, header }: PageShellProps) {
  return (
    <div className="os-shell-canvas">
      <div className="os-shell">
        {header}
        <main id="game-content" className="os-shell-main" tabIndex={-1}>
          {children}
        </main>
        {footer ? (
          <footer
            className="sticky bottom-0 border-t border-os-border bg-os-bg px-os-4 py-os-3"
            style={{ paddingBottom: 'calc(var(--os-safe-bottom) + var(--os-space-3))' }}
          >
            <div className="mx-auto w-full">{footer}</div>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
