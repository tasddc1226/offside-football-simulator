import { expect, type Page } from '@playwright/test';

/** 홈 화면에서 새 커리어를 킥오프하고 선수 화면이 뜰 때까지 기다린다.
 * T-10-002: 생성 화면이 프로필 입력(1/2) → 후보 카드 선택(2/2) 2단계 플로우가 되어, 후보 카드를
 * 하나 열어 고른 뒤에야 [data-act="start"]가 활성화된다. */
export async function startCareer(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  await page.locator('[data-act="next-candidates"]').click();
  await page.locator('[data-cand="0"]').click();
  await page.locator('[data-act="start"]').click();
  await expect(page.locator('.player h1')).toBeVisible();
}
