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
