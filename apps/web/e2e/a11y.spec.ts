import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
  await page.goto('/');
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  await page.locator('[data-act="start"]').click();
  await page.locator('[data-tab="player"]').click();
  await expectNoSeriousViolations(page);
});

// 정적 페이지(/guide, /faq, /legal/*)는 크롤러/noscript용 콘텐츠다 — main.ts가 실행되면 SPA
// 렌더링이 즉시 그 콘텐츠를 홈 화면으로 덮어쓴다(원본과 동일한 의도된 동작, public-pages.spec.ts
// 주석 참고). axe-core는 자신을 주입하려면 JS 엔진이 필요하므로 컨텍스트 전체의 JS를 끌 수는
// 없다 — 대신 앱 번들 요청만 막아 정적 HTML이 그대로 남게 한 채로 검사한다.
test.describe('정적 페이지(앱 번들 로드 차단, 실제로 제공되는 HTML 그대로)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/assets/index-*.js', (route) => route.abort());
  });

  for (const path of ['/guide/', '/faq/', '/legal/terms/', '/legal/privacy/']) {
    test(`${path}에 심각한 접근성 위반이 없다`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      await expectNoSeriousViolations(page);
    });
  }
});
