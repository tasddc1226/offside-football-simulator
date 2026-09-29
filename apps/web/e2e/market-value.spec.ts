import { test, expect } from '@playwright/test';
import { resumeWithSave } from './helpers.js';

// T-10-100 선수 몸값: 시즌 기록마다 몸값(이적료와 같은 식), 은퇴하면 은퇴 가치. 구단 id가 없는 옛 기록도 리그 이름으로 매긴다.
const row = (p: Record<string, unknown>) => ({ apps: 34, goals: 12, assists: 6, cs: 0, rating: 7.1, rank: 2, honors: [], ...p });
const career = [
  row({ year: 2026, age: 18, club: '태백고', league: '고교 리그', ovr: 60 }),
  row({ year: 2034, age: 26, club: '마드리드 로스 블랑코스', league: '라리가', ovr: 90 }), // 옛 기록: clubId 없음
  row({ year: 2036, age: 28, club: '리버풀 토피스', clubId: 'pl-0', league: '프리미어리그', ovr: 88 }),
  row({ year: 2037, age: 29, club: '육군', league: '병역', ovr: 85, mil: true, apps: 0 }),
];

test('커리어 표에 시즌 몸값과 최고 몸값 시즌이 보인다', async ({ page }) => {
  await resumeWithSave(page, { career });
  await page.locator('[data-tab="career"]').click();
  await expect(page.locator('[data-season-value]')).toHaveText(['-', '263억 1천만', '241억', '-']);
  await expect(page.locator('[data-peak-value]')).toContainText('최고 몸값 263억 1천만');
  await expect(page.locator('[data-peak-value]')).toContainText('리버풀 토피스');
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
