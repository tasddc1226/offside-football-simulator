import { expect, test } from '@playwright/test';
import { API, ok } from './helpers.js';

// T-11-406 대진에서 경기를 골라 팀 프로필로 갔다가 뒤로 오면, 고른 경기와 스크롤 자리가 그대로다(맨 위로 가지 않는다).
const at = (d: number) => `2026-10-${String(d).padStart(2, '0')}T12:00:00.000Z`;
const cup = {
  id: 's2-2',
  season: 2,
  edition: 2,
  opensAt: '2026-10-10T15:00:00.000Z',
  closesAt: '2026-10-10T19:00:00.000Z',
  drawAt: '2026-10-11T01:00:00.000Z',
  rounds: [
    { round: 'g1', at: at(12), lockAt: at(12) },
    { round: 'g2', at: at(13), lockAt: at(13) },
    { round: 'g3', at: at(14), lockAt: at(14) },
    { round: 'qf', at: at(15), lockAt: at(15) },
    { round: 'sf', at: at(16), lockAt: at(16) },
    { round: 'f', at: at(17), lockAt: at(17) },
  ],
  capacity: 8,
  minFilled: 8,
};
const teams = Array.from({ length: 8 }, (_, i) => ({
  teamId: `tem_${i}`,
  name: `팀${i}`,
  owner: `감독${i}`,
  logo: null,
  ovr: 80 + i,
}));
const match = (round: string, slot: number, home: number, away: number, d: number) => ({
  id: `m_${round}_${slot}`,
  round,
  group: null,
  slot,
  homeTeamId: `tem_${home}`,
  awayTeamId: `tem_${away}`,
  at: at(d),
  played: true,
  homeGoals: 2,
  awayGoals: 1,
  pens: null,
  winnerTeamId: `tem_${home}`,
  forfeit: false,
});
const matches = [
  match('qf', 0, 0, 1, 15),
  match('qf', 1, 2, 3, 15),
  match('qf', 2, 4, 5, 15),
  match('qf', 3, 6, 7, 15),
  match('sf', 0, 0, 2, 16),
  match('sf', 1, 4, 6, 16),
];

test('대진 경기 → 팀 프로필 → 뒤로: 고른 경기와 스크롤 자리가 남는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.clock.setFixedTime(new Date('2026-10-16T13:00:00.000Z'));
  await page.route(`${API}/**`, async (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path === '/v1/cups/home')
      return r.fulfill(
        ok({
          cup,
          phase: 'knockout',
          entries: 8,
          teamCount: 8,
          round: null,
          championName: null,
          champion: null,
        }),
      );
    if (path === '/v1/cups/current') {
      // 돌아올 때 대회 조회가 늦어도(캐시가 지난 뒤) 자리를 되찾는다.
      await new Promise((res) => setTimeout(res, 800));
      return r.fulfill(
        ok({
          cup,
          phase: 'knockout',
          entries: 8,
          teams,
          groups: [],
          matches,
          championTeamId: null,
        }),
      );
    }
    return r.fulfill({ status: 503, body: '' });
  });
  await page.goto('/');
  await page.locator('[data-act="cup-open"]').click();
  await page.locator('[data-bracket-match="m_qf_3"]').click();
  const row = page.locator('[data-bracket-selected]');
  await expect(row).toBeVisible();
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(200);
  // 캐시(30초)가 지나 돌아올 때 다시 불러오게 한다.
  await page.clock.setFixedTime(new Date('2026-10-16T13:05:00.000Z'));
  await row.locator('[data-act="cup-team"]').first().click();
  await expect(page.locator('[data-cup-hero]')).toHaveCount(0);
  await page.goBack();
  await expect(page.locator('[data-bracket-selected]')).toContainText('팀6');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 40);
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(before + 40);
});
