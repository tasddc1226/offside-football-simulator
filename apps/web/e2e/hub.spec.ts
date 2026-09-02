// TEST-E2E(08 문서): 허브 스모크.
import { expect, test } from '@playwright/test';

test('허브가 열리고 빈 상태 문구와 커리어 시작 버튼이 보인다', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: '아직 만든 커리어가 없습니다' })).toBeVisible();
  await expect(page.getByRole('link', { name: '커리어 시작' })).toBeVisible();
});
