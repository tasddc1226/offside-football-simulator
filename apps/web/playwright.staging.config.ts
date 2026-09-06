import { defineConfig, devices } from '@playwright/test';

// T-2-016/T-4-027: staging 리허설 전용 config. staging Worker에 직접 붙는다. webServer 없음,
// `pnpm --filter @offside/web e2e:staging`으로만 실행한다. 기본 `pnpm e2e`·CI에는 포함되지
// 않는다(testMatch로 staging-rehearsal.spec.ts만 선택하고, 기본
// playwright.config.ts는 이 파일을 testIgnore로 제외한다). staging에 실제 데이터(커리어·복구 코드·
// 분석 이벤트)가 생기므로 실행 절차는 apps/web/e2e/README.md를 따른다.
const DEFAULT_BASE_URL = 'https://offside-web-staging.tasddc1569.workers.dev';
const baseUrl = new URL(process.env.E2E_STAGING_URL ?? DEFAULT_BASE_URL);
if (
  baseUrl.origin !== DEFAULT_BASE_URL ||
  baseUrl.pathname !== '/' ||
  baseUrl.search !== '' ||
  baseUrl.hash !== '' ||
  baseUrl.username !== '' ||
  baseUrl.password !== ''
) {
  throw new Error('E2E staging web URL은 승인된 staging Worker여야 한다.');
}
const BASE_URL = baseUrl.origin;

export default defineConfig({
  testDir: './e2e',
  testMatch: /staging-rehearsal\.spec\.ts/,
  fullyParallel: true,
  reporter: 'list',
  // 실제 서비스에 붙으므로 병렬·재시도로 중복 커리어·중복 이벤트를 만들지 않는다.
  workers: 1,
  retries: 0,
  use: {
    baseURL: BASE_URL,
    // 모바일 뷰포트·reducedMotion 기본값은 apps/web/playwright.config.ts와 같게 유지한다(기본
    // config도 reducedMotion을 강제하지 않는다 — 개별 spec이 필요하면 test.use로 지정한다).
    viewport: { width: 360, height: 780 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 780 } },
    },
  ],
});
