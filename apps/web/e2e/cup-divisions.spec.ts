import { expect, test } from '@playwright/test';
import { API, ok } from './helpers.js';

// T-11-410 구간 대회: 대회 화면 위 구간 탭으로 주니어 · 시니어 · 마스터를 오가고, 고른 구간 대회를 부른다.
const at = (d: number) => `2026-11-${String(d).padStart(2, '0')}T12:00:00.000Z`;
const base = {
  season: 2,
  edition: 3,
  opensAt: '2026-11-02T12:10:00.000Z',
  closesAt: '2026-11-05T15:00:00.000Z',
  drawAt: '2026-11-06T03:00:00.000Z',
  rounds: [
    { round: 'g1', at: at(6), lockAt: at(6) },
    { round: 'g2', at: at(7), lockAt: at(7) },
    { round: 'g3', at: at(8), lockAt: at(8) },
    { round: 'qf', at: at(9), lockAt: at(9) },
    { round: 'sf', at: at(10), lockAt: at(10) },
    { round: 'f', at: at(11), lockAt: at(11) },
  ],
  capacity: 128,
  minFilled: 8,
};
const divisions = [
  { id: 's2-3-junior', division: 'junior', ovrMax: 78, entries: 12 },
  { id: 's2-3-senior', division: 'senior', ovrMax: 86, entries: 9 },
  { id: 's2-3-master', division: 'master', ovrMax: null, entries: 20 },
] as const;
const view = (d: (typeof divisions)[number]) => ({
  cup: { ...base, id: d.id, division: d.division, ovrMax: d.ovrMax },
  phase: 'open',
  entries: d.entries,
  teams: [],
  groups: [],
  matches: [],
  championTeamId: null,
  divisions,
});

test('구간 탭: 마스터로 열고 주니어를 고르면 그 대회를 부른다, 돌아오면 다시 부르지 않는다', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-03T03:00:00.000Z'));
  const hits: Record<string, number> = {};
  await page.route(`${API}/**`, async (r) => {
    const path = new URL(r.request().url()).pathname;
    hits[path] = (hits[path] ?? 0) + 1;
    if (path === '/v1/cups/home')
      return r.fulfill(
        ok({
          cup: { ...base, id: 's2-3-master', division: 'master', ovrMax: null },
          phase: 'open',
          entries: 41,
          teamCount: 41,
          round: null,
          championName: null,
          champion: null,
          divisions,
        }),
      );
    if (path === '/v1/cups/current') return r.fulfill(ok(view(divisions[2])));
    const d = divisions.find((x) => path === `/v1/cups/${x.id}`);
    if (d) return r.fulfill(ok(view(d)));
    return r.fulfill({ status: 503, body: '' });
  });
  await page.goto('/');
  await page.locator('[data-act="cup-open"]').click();
  const tabs = page.locator('[data-cup-divisions]');
  await expect(tabs.locator('button')).toHaveCount(3);
  await expect(page.locator('h1')).toContainText('제3회 오프사이드 컵 마스터');
  await expect(tabs.locator('[data-cup-division="master"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(tabs.locator('[data-cup-division="junior"]')).toContainText('OVR 78 이하');
  await expect(page.locator('[data-cup-rule-divisions]')).toBeVisible();

  await tabs.locator('[data-cup-division="junior"]').click();
  await expect(page.locator('h1')).toContainText('제3회 오프사이드 컵 주니어');
  await expect(tabs.locator('[data-cup-division="junior"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(hits['/v1/cups/s2-3-junior']).toBe(1);

  await tabs.locator('[data-cup-division="junior"]').click();
  await tabs.locator('[data-cup-division="master"]').click();
  await expect(page.locator('h1')).toContainText('마스터');
  await tabs.locator('[data-cup-division="junior"]').click();
  await expect(page.locator('h1')).toContainText('주니어');
  // 같은 구간은 메모(30초)로 다시 부르지 않는다.
  expect(hits['/v1/cups/s2-3-junior']).toBe(1);
});
