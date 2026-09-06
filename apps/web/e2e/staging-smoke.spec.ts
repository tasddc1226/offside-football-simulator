import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

type SmokeMetadata = {
  webUrl: string;
  apiUrl: string;
  expectedSeason: { id: string; contentPackVersion: string };
};

function smokeMetadata(testInfo: TestInfo): SmokeMetadata {
  const value = testInfo.config.metadata.smoke as Partial<SmokeMetadata> | undefined;
  if (
    typeof value?.webUrl !== 'string' ||
    typeof value.apiUrl !== 'string' ||
    typeof value.expectedSeason?.id !== 'string' ||
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
      rulesetVersion: '1.0.0',
      contentPackVersion: smoke.expectedSeason.contentPackVersion,
    },
  });
});

async function onboardingTitle(page: Page): Promise<string> {
  const nextButton = page.getByRole('button', { name: '다음', exact: true });
  await expect(nextButton).toBeVisible();
  await expect(nextButton).toBeEnabled();
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toBeVisible();
  const title = (await heading.textContent())?.trim() ?? '';
  expect(title).not.toBe('');
  return title;
}

test('staging onboarding이 pageerror 없이 render되고 reload 뒤에도 다음 선택이 가능하다', async ({
  page,
}, testInfo) => {
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
  const firstTitle = await onboardingTitle(page);
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  const reloadTitle = await onboardingTitle(page);
  expect(reloadTitle).toBe(firstTitle);
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  const nextHeading = page.getByRole('heading', { level: 1 });
  await expect(nextHeading).toBeVisible();
  await expect(nextHeading).not.toHaveText(firstTitle);
  const nextTitle = (await nextHeading.textContent())?.trim() ?? '';
  expect(nextTitle).not.toBe('');
  expect(pageErrors).toEqual([]);
});
