import '@offside/ui/fonts.css';
import '@offside/ui/tailwind.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { ErrorState } from '@offside/ui';
import { routeTree } from './routeTree.gen.js';
import { ensureProfile } from './api/profile.js';
import { getAppEngine, type AppEngine } from './engine/engine.js';
import { retryPendingDeletes, startPendingDeleteRetryOnOnline } from './engine/pending-delete.js';
import { getSyncClient } from './engine/sync.js';
import { queryClient } from './shared/query-client.js';
import { hydrateUiStore } from './shared/ui-store.js';

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('root element not found');
}

/**
 * T-1-010: `/__dev/hash-probe`는 dev 서버에서만 존재한다. `import.meta.env.DEV`가 아니면 이
 * 분기가 죽은 코드로 제거되어 probe·fixtures가 프로덕션 번들에 들어가지 않는다.
 */
async function bootstrap(rootContainer: HTMLElement): Promise<void> {
  if (import.meta.env.DEV && window.location.pathname === '/__dev/hash-probe') {
    const { mountHashProbe } = await import('./dev/hash-probe.js');
    mountHashProbe(rootContainer);
    return;
  }

  let engine: AppEngine;
  try {
    engine = await getAppEngine();
    await hydrateUiStore(engine.store);
  } catch (error) {
    console.error('bootstrap: 엔진 초기화 실패', error);
    createRoot(rootContainer).render(
      <StrictMode>
        <ErrorState
          message="앱을 시작하지 못했습니다. 새로고침 후 다시 시도해 주세요."
          onRetry={() => window.location.reload()}
        />
      </StrictMode>,
    );
    return;
  }

  // 세션 확보·동기화 클라이언트 준비·미전송 삭제 재시도는 화면을 막지 않는다(로컬 우선).
  void ensureProfile(engine.store, queryClient);
  void getSyncClient();
  startPendingDeleteRetryOnOnline(engine.store);
  void retryPendingDeletes(engine.store);

  createRoot(rootContainer).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

void bootstrap(container);
