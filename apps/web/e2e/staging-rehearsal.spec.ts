// 실제 Cloudflare staging Worker를 스텁 없이 검증하는 수동 LINE TEST 리허설.
// 기본 `pnpm e2e`·CI에는 포함되지 않는다.
import { expect, test, type APIRequestContext } from '@playwright/test';
import { createCareerAndIssueRecoveryCode } from './helpers/recovery.js';
import {
  advanceThroughSeasonToSettlement,
  advanceUntilOffers,
  planPreseason,
  resolveRoleProposal,
  signFirstOffer,
} from './helpers/player-creation.js';

const profile = 'line-test';
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
const expectedRulesetVersion = '2.0.0';
const expectedContentPackVersion = '0.7.0';
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

test(`staging 리허설: ${profile} 온보딩 → 첫 계약 → ${REHEARSAL_MODE} 시즌 완주 → 결산`, async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const startedAt = Date.now();
  const eventScreens: string[] = [];
  let deviceId: string | undefined;

  page.on('request', (request) => {
    if (request.method() !== 'POST' || !request.url().includes('/v1/analytics/events')) return;
    try {
      const body = JSON.parse(request.postData() ?? '{}') as { clientId?: unknown };
      if (!deviceId && typeof body.clientId === 'string') deviceId = body.clientId;
    } catch {
      // 분석 배치 본문 파싱 실패는 무시한다 — deviceId는 진단용이라 테스트를 막지 않는다.
    }
  });

  // 새 브라우저 context부터 실제 Worker만 사용한다. 이 파일은 page.route로 API를 대체하지 않는다.
  await page.goto('/');
  await page.waitForURL(/\/(onboarding)?$/);
  const landedPath = new URL(page.url()).pathname;
  console.log(`[rehearsal:${REHEARSAL_MODE}] fresh device landed on ${landedPath}`);

  if (landedPath === '/onboarding') {
    await expect(page.getByTestId('onboarding-service-season-notice')).toContainText(
      '테스트 보관함',
    );
  }

  // 헬퍼가 발급 형식까지 검증한다. 원문 복구 코드는 로그와 attachment에 남기지 않는다.
  await createCareerAndIssueRecoveryCode(page);
  const careerId = new URL(page.url()).pathname.match(/^\/career\/([^/]+)\//)?.[1] ?? 'unknown';
  console.log(`[rehearsal:${REHEARSAL_MODE}] careerId=${careerId} recoveryCode=(redacted)`);

  await advanceUntilOffers(page);
  await signFirstOffer(page);
  console.log(`[rehearsal:${REHEARSAL_MODE}] contract signed at ${Date.now() - startedAt}ms`);

  await planPreseason(page, '기술');
  await page.getByRole('button', { name: '시즌 시작' }).click();
  await resolveRoleProposal(page);
  await expect(page).toHaveURL(/\/career\/[^/]+$/);
  await expect(page.getByRole('progressbar', { name: '시즌 진행', exact: true })).toBeVisible();
  await expect(page.locator('.sim-hub')).toHaveAttribute(
    'data-ruleset-version',
    expectedRulesetVersion,
  );
  await expect(page.locator('.sim-hub')).toHaveAttribute(
    'data-content-pack-version',
    expectedContentPackVersion,
  );

  // INJURY와 관계 이벤트(LOCKER_ROOM)도 /event 공통 화면이라 같은 헬퍼가 처리한다. 무작위
  // 실플레이에서 실제로 등장한 화면 제목을 남겨, 실행 후 0.3.0 도달 범위를 과장 없이 확인한다.
  await advanceThroughSeasonToSettlement(page, {
    onEventScreen: (title) => eventScreens.push(title),
  });
  await page.getByRole('button', { name: '결산하기' }).click();
  await expect(page).toHaveURL(/\/career\/.+\/season-result$/);
  await expect(page.getByRole('heading', { level: 1, name: '프로 시즌 결과' })).toBeVisible();
  await expect(page.getByText('저장됨', { exact: true })).toBeVisible({ timeout: 15_000 });
  const resultHash = await page.getByTestId('season-result').getAttribute('data-result-hash');
  expect(resultHash).toBeTruthy();
  await page.reload();
  await expect(page.getByTestId('season-result')).toHaveAttribute('data-result-hash', resultHash!);
  console.log(
    `[rehearsal:${REHEARSAL_MODE}] season settled and restored at ${Date.now() - startedAt}ms`,
  );

  // 분석 큐(10초 타이머 또는 20건)가 최소 한 번 flush될 시간을 준다. 수집 실패는 gameplay
  // 리허설을 막지 않고 attachment의 null로 남긴다.
  await page.waitForTimeout(12_000);
  console.log(`[rehearsal:${REHEARSAL_MODE}] eventScreens=${JSON.stringify(eventScreens)}`);
  console.log(`[rehearsal:${REHEARSAL_MODE}] deviceId(clientId)=${deviceId ?? '(미확보)'}`);

  await testInfo.attach('rehearsal-ids', {
    body: JSON.stringify(
      {
        profile,
        mode: REHEARSAL_MODE,
        careerId,
        deviceId: deviceId ?? null,
        eventScreens,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });

  console.log(`[rehearsal:${REHEARSAL_MODE}] total elapsed ${Date.now() - startedAt}ms`);
});
