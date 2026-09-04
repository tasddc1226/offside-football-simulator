import { defineConfig, devices } from '@playwright/test';

// D-18: E2E_WITH_API=1이면 recovery-api.spec.ts가 실제 apps/api(wrangler dev, 포트 8787)를 쓴다.
// apps/api/wrangler.jsonc의 ALLOWED_ORIGINS는 5173만 허용한다(apps/api는 T-1-012 범위 밖이라
// 고치지 않는다) — 그래서 이 모드에서만 웹도 5173(vite 기본 포트)으로 띄운다. 기본(스텁 API) 모드는
// 그대로 5174를 써 개발자가 따로 띄워 둔 `pnpm dev`(5173)와 충돌하지 않는다.
//
// T-1-014: E2E_PREVIEW=1이면 perf.spec.ts가 실제 빌드(vite build && vite preview, 포트 5175)를
// 쓴다 — dev 서버(HMR·미압축 번들)로는 LCP·CLS가 실제 배포본과 다르게 나온다.
//
// T-2-007: 워크트리 병행 투입 시 여러 세션이 동시에 e2e를 돌리면 기본 포트가 충돌한다 —
// E2E_PORT/E2E_API_URL로 오버라이드할 수 있게 연다(기본값은 그대로, reuseExistingServer 동작도
// 그대로 — apps/web/e2e/README.md 참고).
const WITH_API = process.env.E2E_WITH_API === '1';
const WITH_PREVIEW = process.env.E2E_PREVIEW === '1';
const PORT = Number(process.env.E2E_PORT) || (WITH_PREVIEW ? 5175 : WITH_API ? 5173 : 5174);
const BASE_URL = `http://localhost:${PORT}`;
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8787';

const webServer: NonNullable<ReturnType<typeof defineConfig>['webServer']> = [
  {
    command: WITH_PREVIEW ? `pnpm build && vite preview --port ${PORT}` : `vite dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: WITH_PREVIEW ? 120_000 : 30_000,
  },
];

if (WITH_API) {
  webServer.push({
    command: 'pnpm --filter @offside/api dev',
    url: `${API_URL}/v1/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  });
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    viewport: { width: 360, height: 780 },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 780 } },
    },
  ],
  webServer,
});
