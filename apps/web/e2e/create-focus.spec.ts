import { test, expect } from '@playwright/test';

// T-10-008: 선수 생성에서 유형 대신 주력 능력치 두 개를 고른다.
test('주력 능력치 두 개를 골라야 후보를 볼 수 있고, 고른 주력이 선수 화면에 표시된다', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  const focus = (k: string) => page.locator(`[data-set="focus"][data-val="${k}"]`);
  const next = page.locator('[data-act="next-candidates"]');

  // 공격수 기본 주력: 슈팅·드리블
  await expect(focus('sho')).toHaveAttribute('aria-pressed', 'true');
  await expect(focus('dri')).toHaveAttribute('aria-pressed', 'true');

  await focus('dri').click();
  await expect(next).toBeDisabled();

  await focus('pac').click();
  await expect(next).toBeEnabled();
  // 세 번째를 고르면 먼저 고른 쪽(슈팅)이 빠진다.
  await focus('phy').click();
  await expect(focus('sho')).toHaveAttribute('aria-pressed', 'false');
  await expect(focus('pac')).toHaveAttribute('aria-pressed', 'true');
  await expect(focus('phy')).toHaveAttribute('aria-pressed', 'true');

  await next.click();
  await page.locator('[data-cand="0"]').click();
  await page.locator('[data-act="start"]').click();
  await expect(page.locator('.player')).toContainText('주력 스피드·피지컬');
});
