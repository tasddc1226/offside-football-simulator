import { expect, type Page } from '@playwright/test';
import { expectRoute } from './route.js';

/** Real HTTP creation: no client seed, snapshot, local command, or API stub. */
export async function createServerAnnualCareer(page: Page): Promise<string> {
  await page.goto('/onboarding');
  await page.getByLabel('이름', { exact: true }).fill('연간검증');
  await page.getByRole('button', { name: /다음 · 후보 카드 열기/ }).click();
  await expect(page.getByRole('heading', { name: '어떤 선수로 출발할까요?' })).toBeVisible();
  const pending = page.waitForResponse(
    (response) =>
      response.url().endsWith('/v1/careers/server') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '선수 만들기', exact: true }).click();
  const response = await pending;
  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.data.authority).toBe('SERVER_ANNUAL');
  expect(body.data.snapshot.rulesetVersion).toBe('3.5.0');
  expect(body.data.snapshot.contentPackVersion).toBe('0.14.0');
  await expectRoute(page, /\/career\/[^/]+$/);
  await expect(page.getByRole('button', { name: '1년 진행', exact: true })).toBeVisible();
  return body.data.snapshot.careerId as string;
}

export async function finishFirstAnnualYear(page: Page): Promise<number> {
  await page.getByRole('button', { name: '1년 진행', exact: true }).click();
  let decisions = 0;
  const result = page.getByRole('region', { name: '1년차 결과', exact: true });
  const choice = page.getByRole('region', { name: '중요한 결정', exact: true });
  for (let attempt = 0; attempt < 80; attempt++) {
    await expect
      .poll(async () => (await result.isVisible()) || (await choice.isVisible()), {
        timeout: 30_000,
      })
      .toBe(true);
    if (await result.isVisible()) break;
    await expect(choice).toContainText('같은 1년차');
    if (decisions === 0) {
      const title = await choice.locator('h2').innerText();
      await page.reload();
      await expect(choice.locator('h2')).toHaveText(title);
    }
    decisions++;
    await choice.getByRole('button').first().click();
    await expect(choice).not.toBeVisible();
  }
  expect(decisions).toBeGreaterThan(0);
  await expect(result).toBeVisible();
  await expect(result).toContainText('실제 출전');
  const saved = await result.innerText();
  await page.reload();
  await expect(result).toHaveText(saved);
  return decisions;
}
