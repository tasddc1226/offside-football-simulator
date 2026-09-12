import type { ReactNode } from 'react';

export interface PageShellProps {
  children: ReactNode;
  /** 하단 고정 CTA 슬롯. */
  footer?: ReactNode;
  header?: ReactNode;
}

/**
 * UX-006: 앱 셸(고정 프레임 + 내부 스크롤) 모델. `.os-shell-canvas`가 뷰포트에 고정되고(100dvh),
 * `.os-shell`은 그 안에서 header·main·footer를 세로 flex로 쌓는다 — header는 이제 일반 flex
 * 자식이라(더는 position:fixed가 아니다) 셸 자체의 고정 높이가 상단 고정을 보장하고, 별도의 높이
 * 실측(ResizeObserver)이나 본문 패딩 보정이 필요 없다. 실제 스크롤은 main만 한다(overflow-y:auto).
 *
 * 이슈 180: main이 유일한 스크롤 컨테이너가 되면서, 포커스 가능한 자식이 하나도 없는 정적 화면
 * (/legal/*, /settings 일부 상태)에서는 키보드 사용자가 스크롤 영역에 도달할 방법이 없었다(axe
 * scrollable-region-focusable serious). tabIndex=0으로 Tab 순서에 넣고 aria-label로 랜드마크
 * 이름을 준다 — 스킵 링크(`#game-content`)·프로그램적 focus()는 tabIndex=-1 때와 똑같이 동작하고,
 * 가시 포커스 링은 game.css `.os-shell-main:focus-visible`이 키보드 도달 때만 그린다.
 */
export function PageShell({ children, footer, header }: PageShellProps) {
  return (
    <div className="os-shell-canvas">
      <div className="os-shell">
        {header ? <div className="os-shell-header">{header}</div> : null}
        <main id="game-content" className="os-shell-main" tabIndex={0} aria-label="본문">
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
