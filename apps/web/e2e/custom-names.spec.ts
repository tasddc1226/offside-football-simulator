import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// T-11-647: 설정에서 대회·수상 이름을 이 기기에서만 바꾼다(서버로 보내지 않는다).
test('설정에서 대회 이름을 바꾸면 이 기기에 남고 원래대로 되돌릴 수 있다', async ({ page }) => {
  // 바꾼 이름은 어떤 요청에도 실리지 않는다.
  const leaked: string[] = [];
  page.on('request', (r) => {
    if (`${r.url()} ${r.postData() ?? ''}`.includes('오프사이드컵')) leaked.push(r.url());
  });
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-settings-open="names"]').click();
  const row = page.locator('.name-row[data-name="코리아컵"]');
  await expect(row).toBeVisible();

  const axe = await new AxeBuilder({ page }).include('#settings-names').analyze();
  expect(
    axe.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);

  const input = row.locator('input[type="text"]');
  await input.fill('오프사이드컵');
  await input.press('Enter');
  await input.blur();
  await expect(page.locator('[data-names-changed="1"]')).toBeVisible();
  // 칸 옆 이름은 원래 이름 그대로 보인다.
  await expect(row.locator('.name-base')).toHaveText('코리아컵');

  // 종류를 바꾸고 찾기로 거른다.
  await page.locator('[data-name-group="award"]').click();
  await page.locator('.name-search').fill('골든부트');
  await expect(page.locator('.name-row[data-name="프리미어리그 골든부트"]')).toBeVisible();

  // 새로고침해도 남는다.
  await page.reload();
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-settings-open="names"]').click();
  const again = page.locator('.name-row[data-name="코리아컵"]');
  await expect(again.locator('input[type="text"]')).toHaveValue('오프사이드컵');
  await again.locator('[data-act="name-reset"]').click();
  await expect(again.locator('input[type="text"]')).toHaveValue('');
  await expect(page.locator('[data-names-changed]')).toHaveCount(0);
  expect(leaked).toEqual([]);
});
