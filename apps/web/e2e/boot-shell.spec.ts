import { expect, test } from '@playwright/test';

// T-10-041: 첫 화면은 빌드 때 넣은 서버 렌더 셸이고, 앱은 그 노드를 hydrate로 이어받는다. 지우고 다시 그리면
// Chrome이 새로 그린 제목을 LCP로 다시 세서 PageSpeed LCP가 JS 실행 뒤로 밀렸다.
test('첫 화면 제목을 다시 그리지 않고 이어받는다', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __firstH1: Element | null; __removed: number };
    w.__firstH1 = null;
    w.__removed = 0;
    new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.addedNodes) if (!w.__firstH1 && n instanceof Element && n.matches('h1')) w.__firstH1 = n;
        for (const n of r.removedNodes) if (n instanceof Element && (n.matches('h1') || n.querySelector('h1'))) w.__removed++;
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto('/');
  await expect(page.locator('.hero-home h1')).toHaveText(/지금 시작됩니다/);
  expect(
    await page.evaluate(() => {
      const w = window as unknown as { __firstH1: Element | null; __removed: number };
      return { same: document.querySelector('.hero-home h1') === w.__firstH1, removed: w.__removed };
    }),
  ).toEqual({ same: true, removed: 0 });
  // 이어받은 노드에 이벤트도 붙었다.
  await page.locator('.hero-home [data-act="new"]').click();
  await expect(page.locator('.hero-home')).toHaveCount(0);
});
