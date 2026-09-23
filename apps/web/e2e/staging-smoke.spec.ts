import { expect, test, type APIRequestContext, type TestInfo } from '@playwright/test';
import { expectRoute } from './helpers/route.js';

// expectedSeason의 값은 playwright.smoke.config.ts 한 곳에서만 정한다(staging seed·tooling/scripts/
// production-release.mjs PRODUCTION_SEASON과 동기). 이 spec은 버전 리터럴을 두지 않는다.
type SmokeMetadata = {
  webUrl: string;
  apiUrl: string;
  expectedSeason: { id: string; rulesetVersion: string; contentPackVersion: string };
};

function smokeMetadata(testInfo: TestInfo): SmokeMetadata {
  const value = testInfo.config.metadata.smoke as Partial<SmokeMetadata> | undefined;
  if (
    typeof value?.webUrl !== 'string' ||
    typeof value.apiUrl !== 'string' ||
    typeof value.expectedSeason?.id !== 'string' ||
    typeof value.expectedSeason.rulesetVersion !== 'string' ||
    typeof value.expectedSeason.contentPackVersion !== 'string'
  ) {
    throw new Error('staging smoke metadata is missing');
  }
  return value as SmokeMetadata;
}

async function expectJsonResponse(
  request: APIRequestContext,
  url: string,
  webUrl: string,
): Promise<{ response: Awaited<ReturnType<APIRequestContext['get']>>; body: unknown }> {
  const response = await request.get(url, { headers: { Origin: webUrl } });
  expect(response.ok()).toBe(true);
  expect(response.headers()['access-control-allow-origin']).toBe(webUrl);
  return { response, body: await response.json() };
}

test('staging health와 current service-season manifest/CORS가 실제 Worker 계약과 일치한다', async ({
  request,
}, testInfo) => {
  const smoke = smokeMetadata(testInfo);
  const health = await expectJsonResponse(request, `${smoke.apiUrl}/v1/health`, smoke.webUrl);
  expect(health.body).toMatchObject({ data: { ok: true } });

  const current = await expectJsonResponse(
    request,
    `${smoke.apiUrl}/v1/service-seasons/current`,
    smoke.webUrl,
  );
  expect(current.body).toMatchObject({
    data: {
      id: smoke.expectedSeason.id,
      isTest: true,
      rulesetVersion: smoke.expectedSeason.rulesetVersion,
      contentPackVersion: smoke.expectedSeason.contentPackVersion,
    },
  });
});

test('staging 서버 선수 생성·첫 중요 결정이 저장되고 새로고침으로 복원된다', async ({
  page,
}, testInfo) => {
  // 원격 소유권 확인/정본 복원/첫 결정/reload 합계가 실측 60초를 넘는다.
  // 이 원격 smoke만 120초로 제한하며 각 단계의 제한과 실제 상태 단언은 유지한다.
  test.setTimeout(120_000);
  const smoke = smokeMetadata(testInfo);
  const pageErrors: string[] = [];
  const legacyWrites: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().includes('/v1/careers/'))
      legacyWrites.push(request.url());
  });

  const serviceResponsePromise = page.waitForResponse(
    (response) =>
      response.url() === `${smoke.apiUrl}/v1/service-seasons/current` && response.status() === 200,
  );
  await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });
  const serviceResponse = await serviceResponsePromise;
  expect(serviceResponse.headers()['access-control-allow-origin']).toBe(smoke.webUrl);
  await expectRoute(page, /\/onboarding\/?$/);
  await expect(page.getByRole('heading', { level: 1, name: '선수 생성' })).toBeVisible();
  const nameInput = page.getByLabel('이름', { exact: true });
  const nextButton = page.getByRole('button', { name: '다음 · 후보 카드 열기', exact: true });
  await nameInput.fill('QA연간스모크');
  await page.getByRole('radio', { name: '왼발', exact: true }).click();
  await expect(nextButton).toBeEnabled();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: '선수 생성' })).toBeVisible();
  await expect(nameInput).toHaveValue('QA연간스모크');
  await expect(page.getByRole('radio', { name: '왼발', exact: true })).toBeChecked();
  await nextButton.click();
  await expect(page.getByRole('heading', { name: '어떤 선수로 출발할까요?' })).toBeVisible();
  const createdResponse = page.waitForResponse((response) =>
    response.url() === `${smoke.apiUrl}/v1/careers/server` && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '선수 만들기', exact: true }).click();
  const created = await createdResponse;
  expect(created.status()).toBe(201);
  const career = (await created.json()).data;
  expect(career.authority).toBe('SERVER_ANNUAL');
  expect(career.snapshot.rulesetVersion).toBe(smoke.expectedSeason.rulesetVersion);
  expect(career.snapshot.contentPackVersion).toBe(smoke.expectedSeason.contentPackVersion);
  // POST 201은 로컬 복원 완료가 아니다. 실제 원격 소유권 검증/정본 다운로드를 관찰한다.
  const canonical = await page.waitForResponse((response) =>
    response.url() === `${smoke.apiUrl}/v1/careers/${career.snapshot.careerId}` &&
    response.request().method() === 'GET' && response.status() === 200,
  );
  expect((await canonical.json()).data.snapshot.careerId).toBe(career.snapshot.careerId);
  const startYear = page.getByRole('button', { name: '1년 진행', exact: true });
  await expect(startYear).toBeEnabled({ timeout: 45_000 });
  await expectRoute(page, /\/career\/[^/]+$/);
  await startYear.click();
  const decision = page.getByRole('region', { name: '중요한 결정', exact: true });
  await expect(decision).toBeVisible({ timeout: 30_000 });
  await expect(decision).toContainText('같은 1년차');
  const title = await decision.locator('h2').textContent();
  await page.reload();
  await expect(decision.locator('h2')).toHaveText(title!, { timeout: 20_000 });
  await expect(decision.getByRole('button').first()).toBeEnabled();
  expect(legacyWrites).toEqual([]);
  expect(pageErrors).toEqual([]);
});
