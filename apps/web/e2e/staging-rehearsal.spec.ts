// 실제 Cloudflare staging Worker를 스텁 없이 검증하는 수동 LINE TEST 리허설.
// 기본 `pnpm e2e`·CI에는 포함되지 않는다.
import { expect, test, type APIRequestContext } from '@playwright/test';
import { createServerAnnualCareer, finishFirstAnnualYear } from './helpers/annual-career.js';

const defaultWebUrl = 'https://offside-web-staging.tasddc1569.workers.dev';
const webUrlValue = new URL(process.env.E2E_STAGING_URL ?? defaultWebUrl);
if (
  webUrlValue.origin !== defaultWebUrl ||
  webUrlValue.pathname !== '/' ||
  webUrlValue.search !== '' ||
  webUrlValue.hash !== '' ||
  webUrlValue.username !== '' ||
  webUrlValue.password !== ''
) {
  throw new Error('E2E staging web URL은 승인된 staging Worker여야 한다.');
}
const webUrl = webUrlValue.origin;

function deriveApiUrl(value: string): string {
  const url = new URL(value);
  const apiHostname = url.hostname.replace(/^offside-web(?=-|$)/, 'offside-api');
  if (apiHostname === url.hostname) {
    throw new Error('커스텀 web URL은 E2E_STAGING_API_URL도 명시해야 한다.');
  }
  url.hostname = apiHostname;
  return url.origin;
}

const apiUrlValue = new URL(process.env.E2E_STAGING_API_URL ?? deriveApiUrl(webUrl));
if (
  apiUrlValue.origin !== 'https://offside-api-staging.tasddc1569.workers.dev' ||
  apiUrlValue.pathname !== '/' ||
  apiUrlValue.search !== '' ||
  apiUrlValue.hash !== '' ||
  apiUrlValue.username !== '' ||
  apiUrlValue.password !== ''
) {
  throw new Error('E2E staging API URL은 승인된 staging Worker여야 한다.');
}
const apiUrl = apiUrlValue.origin;
const expectedSeasonName = process.env.E2E_STAGING_SEASON_NAME?.trim() || 'LINE TEST';
const expectedServiceSeasonId = 'svc_line_test';
// staging seed(apps/api/seeds/bootstrap-non-production.sql)와 tooling/scripts/production-release.mjs
// PRODUCTION_SEASON(운영 승격 목표 manifest)과 같은 값을 유지한다 — 바꿀 때 함께 갱신한다.
const expectedRulesetVersion = '3.5.0';
const expectedContentPackVersion = '0.14.0';
// 사용자 결정(2026-09-13, D-77): 클라이언트는 더 이상 시뮬레이션 모드를 고르지 않는다 — 모든 시즌은
// 항상 FAST로 시작한다.
const REHEARSAL_MODE = 'FAST';

async function expectServiceSeason(request: APIRequestContext): Promise<void> {
  const response = await request.get(`${apiUrl}/v1/service-seasons/current`, {
    headers: { Origin: webUrl },
  });
  expect(response.ok()).toBe(true);
  expect(response.headers()['access-control-allow-origin']).toBe(webUrl);
  const body = (await response.json()) as { data?: Record<string, unknown> };
  expect(body.data).toMatchObject({
    id: expectedServiceSeasonId,
    name: expectedSeasonName,
    status: 'PRESEASON',
    isTest: true,
    rulesetVersion: expectedRulesetVersion,
    contentPackVersion: expectedContentPackVersion,
  });
}

test(`staging 리허설: ${expectedSeasonName} 서비스 시즌 manifest와 CORS`, async ({ request }) => {
  await expectServiceSeason(request);
});

test(`staging 리허설: 서버 생성 → 중요한 결정 → 같은 해 완료 → 복구 (${REHEARSAL_MODE})`, async ({
  page,
}) => {
  test.setTimeout(180_000);
  const localWrites: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().includes('/v1/careers/'))
      localWrites.push(request.url());
  });
  await createServerAnnualCareer(page);
  await finishFirstAnnualYear(page);
  expect(localWrites).toEqual([]);
});
