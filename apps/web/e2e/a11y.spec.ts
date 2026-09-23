import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { startCareer } from './helpers.js';

async function expectNoSeriousViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

test('홈 화면에 심각한 접근성 위반이 없다', async ({ page }) => {
  await page.goto('/');
  await expectNoSeriousViolations(page);
});

test('선수 탭에 심각한 접근성 위반이 없다', async ({ page }) => {
  await startCareer(page);
  await page.locator('[data-tab="player"]').click();
  await expectNoSeriousViolations(page);
});

// 정적 페이지(/guide, /faq, /legal/*)는 크롤러/noscript용 콘텐츠이며 앱 번들 스크립트를
// 포함하지 않으므로, 실제 브라우저에서 JS가 켜져 있어도 그대로 남는다.
for (const path of ['/guide/', '/faq/', '/legal/terms/', '/legal/privacy/']) {
  test(`${path}에 심각한 접근성 위반이 없다`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}
