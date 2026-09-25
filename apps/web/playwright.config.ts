import { defineConfig, devices } from '@playwright/test';

// T-9-001b: 계정 UI(e2e)는 실제 apps/api를 띄우지 않고 page.route로 스텁한다 — 게임 데이터는
// 전부 브라우저 localStorage에 남고, 서버가 아는 것은 로그인 상태뿐이라 API 목업만으로 충분하다.
// 그래서 옛 E2E_WITH_API(wrangler dev 동시 기동) 모드는 제거했다.
//
// 기본값은 실제 빌드(vite build && vite preview)로 띄운다 — /guide, /faq, /legal/* 정적 페이지는
// scripts/seo.mjs의 빌드 후 처리(closeBundle)로만 생성되고 `vite dev`에는 존재하지 않으므로,
// 공개 페이지/접근성 테스트가 통과하려면 빌드본이 필요하다. 게임 로직만 빠르게 반복할 때는
// E2E_DEV=1로 HMR dev 서버를 쓸 수 있다(T-10-021부터 seoPlugin이 dev에서도 공개 페이지를 낸다).
//
// CI(ci.yml, full-validation.yml)는 e2e 이전 단계에서 이미 `pnpm build`를 한 번 돌린다 —
// E2E_PREBUILT=1이면 webServer가 그 dist를 그대로 preview만 하고 다시 빌드하지 않는다.
// 로컬 `pnpm e2e`는 기본값(E2E_PREBUILT 미설정)이라 여전히 매번 빌드한다.
//
// 워크트리 병행 투입 시 여러 세션이 동시에 e2e를 돌리면 기본 포트가 충돌한다 — E2E_PORT로 오버라이드.
const WITH_DEV = process.env.E2E_DEV === '1';
const PREBUILT = process.env.E2E_PREBUILT === '1';
const PORT = Number(process.env.E2E_PORT) || (WITH_DEV ? 5174 : 5175);
const BASE_URL = `http://localhost:${PORT}`;

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
  webServer: {
    command: WITH_DEV
      ? `vite dev --port ${PORT}`
      : PREBUILT
        ? `vite preview --port ${PORT}`
        : `pnpm build && vite preview --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: WITH_DEV ? 30_000 : 120_000,
  },
});
