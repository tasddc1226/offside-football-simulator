// TEST-E2E(08 문서): 법적 문서 라우트가 200이고 제목이 있다.
import { expect, test } from '@playwright/test';

const LEGAL_ROUTES = [
  { path: '/legal/privacy', title: '개인정보 처리방침' },
  { path: '/legal/terms', title: '이용약관' },
];

for (const { path, title } of LEGAL_ROUTES) {
  test(`${path}가 200이고 "${title}" 제목이 보인다`, async ({ page }) => {
    const response = await page.goto(path);

    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  });
}

// 완료 조건 표 #14, ADR-008: 개인정보 처리방침에 국외 이전 절과 표(이전받는 자·국가·항목·목적·
// 보유기간)가 보인다.
test('/legal/privacy에 개인정보 국외 이전 절과 표가 보인다', async ({ page }) => {
  await page.goto('/legal/privacy');

  await expect(page.getByRole('heading', { level: 2, name: '개인정보의 국외 이전' })).toBeVisible();
  const table = page.getByRole('table', { name: '개인정보 국외 이전 현황' });
  await expect(table).toBeVisible();
  await expect(table.getByRole('columnheader', { name: '이전받는 자' })).toBeVisible();
  await expect(table.getByRole('cell', { name: 'Cloudflare, Inc.' })).toBeVisible();
  await expect(table.getByRole('cell', { name: 'Google LLC' })).toBeVisible();
});
