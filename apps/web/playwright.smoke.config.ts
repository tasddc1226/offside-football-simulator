import { defineConfig, devices } from '@playwright/test';

const DEFAULT_WEB_URL = 'https://offside-web-staging.tasddc1569.workers.dev';
const DEFAULT_API_URL = 'https://offside-api-staging.tasddc1569.workers.dev';
const ALLOWED_WORKER_HOSTS = new Set([
  'offside-web-staging.tasddc1569.workers.dev',
  'offside-api-staging.tasddc1569.workers.dev',
]);

type SmokeMetadata = Readonly<{
  webUrl: string;
  apiUrl: string;
  expectedSeason: Readonly<{ id: string; contentPackVersion: string }>;
}>;

function workerOrigin(value: string, kind: 'web' | 'api'): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`E2E staging ${kind} URL is invalid`);
  }
  const expectedPrefix = kind === 'web' ? 'offside-web-' : 'offside-api-';
  if (
    url.protocol !== 'https:' ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== '' ||
    !ALLOWED_WORKER_HOSTS.has(url.hostname) ||
    !url.hostname.startsWith(expectedPrefix)
  ) {
    throw new Error(`E2E staging ${kind} URL is not an approved Worker origin`);
  }
  return url.origin;
}

const BASE_URL = workerOrigin(process.env.E2E_STAGING_URL ?? DEFAULT_WEB_URL, 'web');
const API_URL = workerOrigin(process.env.E2E_STAGING_API_URL ?? DEFAULT_API_URL, 'api');
const expectedSeason = { id: 'svc_line_test', contentPackVersion: '0.1.0' };
const smokeMetadata: SmokeMetadata = {
  webUrl: BASE_URL,
  apiUrl: API_URL,
  expectedSeason,
};

export default defineConfig({
  metadata: { smoke: smokeMetadata },
  testDir: './e2e',
  testMatch: /staging-smoke\.spec\.ts/,
  fullyParallel: false,
  reporter: 'list',
  workers: 1,
  retries: 0,
  use: {
    baseURL: BASE_URL,
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
  // Deliberately no webServer: this config targets the already deployed Worker.
});
