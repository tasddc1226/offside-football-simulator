import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, ok } from './helpers.js';

// T-11-435 시즌 진행 게이지 카드를 누르면 게이지가 무엇으로 차는지 · 마감 · 진행 중 커리어 · 보상 위치를 알려 주는 창이 열린다.
const GAUGE = {
  season: 1,
  startsAt: '2026-10-05T15:00:00.000Z',
  progress: 0.42,
  contributed: 4_200,
  participants: 830,
  target: 9_960,
  endsAt: null,
  minEndsAt: '2026-10-19T15:00:00.000Z',
  maxEndsAt: '2026-10-30T15:00:00.000Z',
  updatedAt: '2026-10-12T00:00:00.000Z',
};

test('시즌 게이지: 카드를 누르면 설명 창이 열리고 닫힌다', async ({ page }) => {
  let asked = 0;
  await page.route(`${API}/v1/season/gauge`, (r) => {
    asked++;
    return r.fulfill(ok({ gauge: GAUGE, seasons: [] }));
  });
  await page.goto('/');
  const card = page.locator('[data-season-gauge]');
  await expect(card.locator('[data-season-gauge-pct]')).toHaveText('42%');

  const open = card.locator('[data-act="season-gauge-info"]');
  await expect(open).toHaveAccessibleName(/진행률 42%\. 시즌 진행률 설명 보기/);
  await open.click();
  const sheet = page.locator('[data-season-gauge-sheet]');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('35세 이상까지 뛰고 은퇴한 커리어가 게이지를 채워요');
  await expect(sheet).toContainText('진행 중인 커리어는 그대로 이어서 할 수 있어요');
  await expect(sheet).toContainText('명예관');
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );

  await sheet.locator('[data-act="season-gauge-info-close"]').click();
  await expect(sheet).toHaveCount(0);
  // 키보드로도 연다(Enter) · 닫는다(Esc). 창을 여닫아도 게이지를 다시 묻지 않는다.
  await open.focus();
  await page.keyboard.press('Enter');
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  expect(asked).toBe(1);
});
