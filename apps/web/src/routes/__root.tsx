// 루트 레이아웃. SCR ID 없음: PageShell·QueryClientProvider·not-found 안내를 담당한다.
import { buttonClassName, buttonStyle, EmptyState, PageShell } from '@offside/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { queryClient } from '../shared/query-client.js';
import { useApplyTheme } from '../shared/ui-store.js';

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundScreen,
});

function RootComponent() {
  useApplyTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <PageShell>
        <Outlet />
      </PageShell>
    </QueryClientProvider>
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
