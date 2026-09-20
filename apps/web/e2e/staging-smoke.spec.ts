import { expect, test, type APIRequestContext, type TestInfo } from '@playwright/test';

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

test('staging 선수 생성이 입력을 복원하고 pageerror 없이 후보 카드를 공개한다', async ({
  page,
}, testInfo) => {
  // 실제 Worker의 초기 로드와 reload를 모두 포함한다. 개별 UI 단언의 5초 제한은 유지한다.
  test.setTimeout(60_000);
  const smoke = smokeMetadata(testInfo);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const serviceResponsePromise = page.waitForResponse(
    (response) =>
      response.url() === `${smoke.apiUrl}/v1/service-seasons/current` && response.status() === 200,
  );
  await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });
  const serviceResponse = await serviceResponsePromise;
  expect(serviceResponse.headers()['access-control-allow-origin']).toBe(smoke.webUrl);
  await expect(page).toHaveURL(/\/onboarding\/?$/);
  await expect(page.getByRole('heading', { level: 1, name: '선수 생성' })).toBeVisible();
  const nameInput = page.getByLabel('이름', { exact: true });
  const nextButton = page.getByRole('button', { name: '다음 · 후보 카드 열기', exact: true });
  await nameInput.fill('김서준');
  await page.getByRole('radio', { name: '왼발', exact: true }).click();
  await expect(nextButton).toBeEnabled();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: '선수 생성' })).toBeVisible();
  await expect(nameInput).toHaveValue('김서준');
  await expect(page.getByRole('radio', { name: '왼발', exact: true })).toBeChecked();
  await nextButton.click();
  await expect(page).toHaveURL(/\/career\/[^/]+\/style$/);
  await expect(page.getByRole('heading', { level: 1, name: '세 가지 가능성' })).toBeVisible();
  await page.getByRole('button', { name: '3장 모두 열기', exact: true }).click();
  await expect(page.getByRole('button', { name: /후보 선택$/ })).toHaveCount(3);
  await expect(page.getByRole('button', { name: /이 후보로 진행/ })).toBeEnabled();
  expect(pageErrors).toEqual([]);
});
