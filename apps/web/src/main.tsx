import '@offside/ui/fonts.css';
import '@offside/ui/tailwind.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { ErrorState } from '@offside/ui';
import { routeTree } from './routeTree.gen.js';
import { getAppEngine } from './engine/engine.js';
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

  try {
    const engine = await getAppEngine();
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

  createRoot(rootContainer).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

void bootstrap(container);
