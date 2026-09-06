// 루트 레이아웃. SCR ID 없음: PageShell·QueryClientProvider·not-found 안내를 담당한다.
import { buttonClassName, buttonStyle, EmptyState, FootballMark, PageShell } from '@offside/ui';
import { QueryClientProvider, useIsMutating } from '@tanstack/react-query';
import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { queryClient } from '../shared/query-client.js';
import { useApplyTheme } from '../shared/ui-store.js';
import { AppMotionFrame } from '../shared/app-motion-frame.js';
import { useEffect } from 'react';

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
  const inPublicInfo = /^\/(guide|faq)\/?$/.test(pathname);
  useEffect(() => {
    if (inPublicInfo) return;
    const isHome = pathname === '/';
    document.title = isHome ? '오프사이드 — 이번 생은 프리미어리거!' : 'OFFSIDE';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        isHome
          ? '선택으로 한 명의 축구 선수 커리어를 만들어 가는 스토리 시뮬레이션 게임, 오프사이드.'
          : 'OFFSIDE 게임 화면',
      );
    document
      .querySelector('meta[name="robots"]')
      ?.setAttribute(
        'content',
        isHome
          ? (document.documentElement.dataset.publicRobots ?? 'noindex, nofollow')
          : 'noindex, nofollow',
      );
    if (!isHome)
      document
        .querySelectorAll('link[rel="canonical"], meta[property="og:url"]')
        .forEach((node) => node.remove());
  }, [inPublicInfo, pathname]);
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
        ) : inPublicInfo ? (
          <a href="/" className="os-brand" aria-label="오프사이드 홈">
            <FootballMark />
            <span>OFFSIDE</span>
          </a>
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
        ) : inPublicInfo ? (
          <a href="/settings" className="os-nav-settings" aria-label="게임 설정">
            <span aria-hidden="true">설정</span>
          </a>
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
