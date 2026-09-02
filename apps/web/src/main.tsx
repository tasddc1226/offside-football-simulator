import '@offside/ui/fonts.css';
import '@offside/ui/tailwind.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen.js';

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

  createRoot(rootContainer).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

void bootstrap(container);
