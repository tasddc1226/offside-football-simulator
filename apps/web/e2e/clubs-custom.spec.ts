import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// T-10-009: 게임 설정에서 클럽 이름·엠블럼을 바꾸면 새 커리어에 그대로 쓰인다.
test('설정에서 고교 클럽 이름을 모두 바꾸면 새 커리어 소속에 반영된다', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-settings-open="clubs"]').click();
  await expect(page.getByRole('heading', { name: '환경설정' })).toBeVisible();
  await page.locator('#club-league').selectOption('hs');
  const rows = page.locator('.club-row');
  await expect(rows).toHaveCount(12);

  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);

  // 새 커리어의 첫 소속은 고교 12개 중 무작위 — 전부 같은 접두어로 바꿔 둔다.
  for (let i = 0; i < 12; i++) {
    const input = rows.nth(i).locator('input[type="text"]');
    await input.fill(`우리고${i}`);
    await input.press('Enter');
    await input.blur();
  }
  await rows.first().locator('[data-act="logo"]').click();
  await rows.first().locator('.club-logo-edit input[type="text"]').fill('우');
  await rows.first().locator('.club-logo-edit input[type="text"]').blur();
  await expect(rows.first().locator('.club-badge')).toHaveText('우');

  // 새로고침해도 유지된다(이 기기 localStorage).
  await page.reload();
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-settings-open="clubs"]').click();
  await page.locator('#club-league').selectOption('hs');
  await expect(page.locator('.club-row').first().locator('input[type="text"]')).toHaveValue(
    '우리고0',
  );

  await page.locator('[data-act="home"]').click();
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  await page.locator('[data-act="next-candidates"]').click();
  await page.locator('[data-cand="0"]').click();
  await page.locator('[data-act="start"]').click();
  await expect(page.locator('.player .meta')).toContainText('우리고');
});

test('T-11-696 K리그1 목록 끝에 김천 상무가 있고 이름 · 엠블럼을 바꿀 수 있다', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-settings-open="clubs"]').click();
  await page.locator('#club-league').selectOption('k1');
  const rows = page.locator('.club-row');
  await expect(rows).toHaveCount(12);
  const sangmu = rows.last();
  await expect(sangmu.locator('input[type="text"]')).toHaveAttribute('placeholder', /김천 상무/);
  const input = sangmu.locator('input[type="text"]');
  await input.fill('국군 FC');
  await input.press('Enter');
  await input.blur();
  await sangmu.locator('[data-act="logo"]').click();
  await sangmu.locator('.club-logo-edit input[type="text"]').fill('군');
  await sangmu.locator('.club-logo-edit input[type="text"]').blur();
  await expect(sangmu.locator('.club-badge')).toHaveText('군');
  await page.reload();
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-settings-open="clubs"]').click();
  await page.locator('#club-league').selectOption('k1');
  await expect(page.locator('.club-row').last().locator('input[type="text"]')).toHaveValue(
    '국군 FC',
  );
  await expect(page.locator('.club-row').last().locator('.club-badge')).toHaveText('군');
});
