// 루트 레이아웃. SCR ID 없음: PageShell·QueryClientProvider·not-found 안내를 담당한다.
import { buttonClassName, buttonStyle, EmptyState, FootballMark, PageShell } from '@offside/ui';
import { QueryClientProvider, useIsMutating } from '@tanstack/react-query';
import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { queryClient } from '../shared/query-client.js';
import { useApplyTheme } from '../shared/ui-store.js';
import { AppMotionFrame } from '../shared/app-motion-frame.js';

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundScreen,
});

function RootComponent() {
  useApplyTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <PageShell header={<GameNavigation />}>
        <AppMotionFrame>
          <Outlet />
        </AppMotionFrame>
      </PageShell>
    </QueryClientProvider>
  );
}

function GameNavigation() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const mutating = useIsMutating() > 0;
  // Career screens already own their safe back/next actions. A global Link would bypass
  // those COMMITTING guards, including asynchronous post-confirm recovery work.
  const inCareer = pathname.startsWith('/career/');
  return (
    <>
      <a href="#game-content" className="os-skip-link">
        본문으로 건너뛰기
      </a>
      <nav className="os-app-nav" aria-label="게임 메뉴">
        {inCareer ? (
          <span className="os-brand">
            <FootballMark />
            <span>OFFSIDE</span>
          </span>
        ) : (
          <Link
            to="/"
            className="os-brand"
            aria-label="오프사이드 홈"
            aria-disabled={mutating || undefined}
            onClick={(event) => {
              if (mutating) event.preventDefault();
            }}
          >
            <FootballMark />
            <span>OFFSIDE</span>
          </Link>
        )}
        {inCareer ? (
          <span className="os-eyebrow os-muted">나의 축구 인생</span>
        ) : (
          <Link
            to="/settings"
            className="os-nav-settings"
            aria-label="게임 설정"
            aria-disabled={mutating || undefined}
            onClick={(event) => {
              if (mutating) event.preventDefault();
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
              <path d="M9 3v6M16 9v6M8 15v6" strokeWidth="3" />
            </svg>
          </Link>
        )}
      </nav>
    </>
  );
}

function NotFoundScreen() {
  return (
    <EmptyState
      reason="찾을 수 없는 화면입니다"
      action={
        <Link to="/" className={buttonClassName('primary')} style={buttonStyle}>
          허브로 돌아가기
        </Link>
      }
    />
  );
}
