// 루트 레이아웃. SCR ID 없음: PageShell·QueryClientProvider·not-found 안내를 담당한다.
import { BrandMark, PageShell } from '@offside/ui';
import { QueryClientProvider, useIsMutating } from '@tanstack/react-query';
import { createRootRoute, Link, Outlet, useRouter, useRouterState } from '@tanstack/react-router';
import { queryClient } from '../shared/query-client.js';
import { useApplyTheme } from '../shared/ui-store.js';
import { AppMotionFrame } from '../shared/app-motion-frame.js';
import { NotFoundScreen } from '../shared/NotFoundScreen.js';
import { useEffect } from 'react';

export const Route = createRootRoute({
  component: RootComponent,
  // 이슈 155: 매칭되지 않는 경로·notFound()를 던진 커리어 라우트 모두 앱 셸 안의 이 화면으로.
  notFoundComponent: NotFoundScreen,
});

function RootComponent() {
  useApplyTheme();
  useResetScrollOnRouteChange();

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

/**
 * UX-006: 앱 셸 전환 이후 문서(window)는 더 이상 스크롤되지 않는다 — 오직 main#game-content만
 * 내부 스크롤한다. 그래서 TanStack Router의 기본(브라우저) 스크롤 복원이 적용될 대상이 없어졌다:
 * 라우트가 실제로 바뀔 때마다 이 컨테이너의 scrollTop을 직접 0으로 되돌린다. `onRendered`는 목적지
 * 라우트의 로더가 끝나 실제 DOM이 커밋된 시점에 온다(AppMotionFrame의 화면 전환 애니메이션과 같은
 * 이유로 이 이벤트를 쓴다 — location은 로더가 끝나기 전에 먼저 바뀌므로, 그때 리셋하면 아직 화면에
 * 남아 있는 이전 화면이 먼저 맨 위로 튀어 오른다). 뒤로 가기 시 이전 스크롤 위치 복원은 범위 밖이다.
 *
 * UX-013 후속(이슈 없음, 딥링크 경합): pathname이 그대로인 전환(같은 경로 안 해시 변경 포함)은
 * `pathChanged`가 이미 false라 손대지 않는다. pathname이 바뀌었더라도 목적지 해시가 실제 존재하는
 * 요소를 가리키면(`/settings#settings-play` 같은 딥링크) 리셋을 건너뛴다 — 그러지 않으면
 * useExpandDisclosuresOnHash가 막 열고 스크롤한 위치를 이 리셋이 같은 커밋 주기에 도로 0으로
 * 되돌린다. 해시가 없거나 해시 대상이 없는 보통 전환은 그대로 새 화면을 맨 위에서 시작한다.
 */
export function shouldResetScrollOnRouteChange(params: {
  pathChanged: boolean;
  hash: string;
  hashTargetExists: boolean;
}): boolean {
  if (!params.pathChanged) return false;
  if (params.hash !== '' && params.hashTargetExists) return false;
  return true;
}

function useResetScrollOnRouteChange(): void {
  const router = useRouter();
  useEffect(
    () =>
      router.subscribe('onRendered', ({ pathChanged, toLocation }) => {
        const hashTargetExists =
          toLocation.hash !== '' && document.getElementById(toLocation.hash) !== null;
        if (
          !shouldResetScrollOnRouteChange({ pathChanged, hash: toLocation.hash, hashTargetExists })
        ) {
          return;
        }
        const main = document.getElementById('game-content');
        if (main) main.scrollTop = 0;
      }),
    [router],
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
            <BrandMark />
            <span>OFFSIDE</span>
          </span>
        ) : inPublicInfo ? (
          <a href="/" className="os-brand" aria-label="오프사이드 홈">
            <BrandMark />
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
            <BrandMark />
            <span>OFFSIDE</span>
          </Link>
        )}
        {inCareer ? (
          <span className="os-nav-context">커리어</span>
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
