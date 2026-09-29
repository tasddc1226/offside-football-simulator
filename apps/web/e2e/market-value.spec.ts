import { test, expect } from '@playwright/test';
import { resumeWithSave } from './helpers.js';

// T-10-100 선수 몸값: 시즌 기록마다 몸값(이적료와 같은 식), 은퇴하면 은퇴 가치. 구단 id가 없는 옛 기록도 리그 이름으로 매긴다.
const row = (p: Record<string, unknown>) => ({
  apps: 34,
  goals: 12,
  assists: 6,
  cs: 0,
  rating: 7.1,
  rank: 2,
  honors: [],
  ...p,
});
const career = [
  row({ year: 2026, age: 18, club: '태백고', league: '고교 리그', ovr: 60 }),
  row({ year: 2034, age: 26, club: '마드리드 로스 블랑코스', league: '라리가', ovr: 90 }), // 옛 기록: clubId 없음
  row({
    year: 2036,
    age: 28,
    club: '리버풀 토피스',
    clubId: 'pl-0',
    league: '프리미어리그',
    ovr: 88,
  }),
  row({ year: 2037, age: 29, club: '육군', league: '병역', ovr: 85, mil: true, apps: 0 }),
];

test('커리어 표에 시즌 몸값과 최고 몸값 시즌이 보인다', async ({ page }) => {
  await resumeWithSave(page, { career });
  await page.locator('[data-tab="career"]').click();
  // 몸값은 소속 칸 아래 줄(리그 옆)에 — 고교·복무 시즌은 없다. 표를 옆으로 밀지 않아도 보인다.
  await expect(page.locator('[data-season-value]')).toHaveText(['몸값 263억 1천만', '몸값 241억']);
  const fits = await page
    .locator('[data-season-value]')
    .first()
    .evaluate((el) => {
      const wrap = el.closest('.table-wrap')!.getBoundingClientRect();
      return el.getBoundingClientRect().right <= wrap.right;
    });
  expect(fits).toBe(true);

  await expect(page.locator('[data-peak-value]')).toContainText('최고 몸값 263억 1천만');
  await expect(page.locator('[data-peak-value]')).toContainText('리버풀 토피스');

  // 시즌별 몸값 막대: 시즌마다 하나, 최고 시즌은 강조, 누르면 그 시즌 값이 위에 나온다.
  const bars = page.locator('[data-value-chart] .value-bar');
  await expect(bars).toHaveCount(4);
  await expect(bars.nth(2)).toHaveClass(/peak/);
  await bars.nth(1).click();
  await expect(page.locator('[data-value-pick]')).toHaveText(
    '2034-35 (26) · 마드리드 로스 블랑코스 · 241억',
  );
  const [h1, h2] = await Promise.all(
    [1, 2].map((i) => bars.nth(i).evaluate((el) => el.clientHeight)),
  );
  expect(h1).toBeLessThan(h2!);
  expect(h1).toBeGreaterThan(h2! * 0.85);
});

test('선수 카드에 연봉과 함께 몸값이 보인다(아마추어는 없다)', async ({ page }) => {
  await resumeWithSave(page, { leagueId: 'k3', contract: { years: 2, salary: 1230 } });
  await expect(page.locator('section.player .meta')).toContainText(
    /K3리그 · 연봉 1,230만 · 몸값 \S+/,
  );
});

test('은퇴 크레딧에 은퇴 가치와 최고 몸값 시즌이 나온다', async ({ page }) => {
  await resumeWithSave(page, { career, age: 34, pending: { type: 'market', res: null, m: null } });
  const sheet = page.locator('#sheet');
  await sheet.getByRole('button', { name: '은퇴하기' }).click();
  await sheet.getByRole('button', { name: '은퇴한다' }).click();
  const worth = page.locator('[data-legend-value]');
  await expect(worth).toBeVisible();
  await expect(worth).toContainText(/은퇴 가치\s*[\d,]+억/);
  await expect(worth).toContainText('최고 몸값 263억 1천만');
});
