import { test, expect, type Page } from '@playwright/test';
import type { SeasonRecapResponse, TeamPlayer } from '@offside/contracts';
import { API, ok, fail } from './helpers.js';
import { archiveFixture, recapFixture } from './fixtures/owner-archive.js';

// T-11-372 시즌 특별 카드: 카드 띠 · 테두리, 결산 화면의 그 시즌 특별 카드 목록. 서버는 page.route로 흉내 낸다.

const SHOTS = process.env.SPECIALS_SHOTS;

const card = (n: number, o: Partial<TeamPlayer> = {}): TeamPlayer => ({
  careerId: `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`,
  pos: 'FW',
  dpos: 'ST',
  peak: 88,
  roles: null,
  attrs: { pac: 86, sho: 90, pas: 72, dri: 84, def: 35, phy: 78 },
  number: n,
  publicName: `선수 ${n}`,
  legendScore: 1500 - n * 20,
  season: 1,
  ...o,
});

async function stubProfile(page: Page) {
  await page.addInitScript(() => localStorage.setItem('ft_session', '1'));
  await page.route(`${API}/v1/**`, (r) => r.fulfill(fail(503, 'UNAVAILABLE', 'unavailable')));
  await page.route(`${API}/v1/profile`, (r) =>
    r.fulfill(
      ok({
        id: 'specials-test',
        linked: { google: true, toss: false },
        nickname: '특별카드',
        googleEmailMasked: 'a***@example.com',
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ),
  );
  await page.route(`${API}/v1/boards/viewer`, (r) =>
    r.fulfill(ok({ admin: false, google: true, nickname: '특별카드' })),
  );
}

test('특별 카드는 라커룸 카드에 표식 띠를 달고, 표식이 없는 카드는 그대로다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await stubProfile(page);
  const players = [
    card(11, {
      specials: [
        { season: 1, kind: 'mvp', rank: 1 },
        { season: 1, kind: 'best11', rank: 1 },
      ],
    }),
    card(12, { pos: 'MF', dpos: 'CM', specials: [{ season: 1, kind: 'best11', rank: 2 }] }),
    card(13, { pos: 'DF', dpos: 'CB' }),
  ];
  let gets = 0;
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/owner-team',
    (r) => {
      gets++;
      return r.fulfill(
        ok({
          season: 1,
          current: 1,
          seasons: [
            { id: 0, name: '프리시즌' },
            { id: 1, name: '시즌 1' },
          ],
          team: null,
          players,
          lastManager: null,
          matchesLeft: 10,
          matchesPerDay: 10,
        }),
      );
    },
  );
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="team"]').click();
  const locker = page.locator('[data-team-locker]');
  const mvp = locker.locator(`[data-locker-player="${players[0]!.careerId}"]`);
  // 여러 표식이면 높은 것(MVP) 하나만 띠로.
  await expect(mvp.locator('[data-card-special="mvp"]')).toHaveText('S1 MVP');
  await expect(mvp.locator('.player-card')).toHaveAttribute('data-special', 'mvp');
  await expect(
    locker.locator(`[data-locker-player="${players[1]!.careerId}"] [data-card-special="best11"]`),
  ).toHaveText('S1 베스트 11');
  const plain = locker.locator(`[data-locker-player="${players[2]!.careerId}"]`);
  await expect(plain.locator('[data-card-special]')).toHaveCount(0);
  await expect(plain.locator('.player-card')).not.toHaveAttribute('data-special', /.+/);
  // 표식은 카드 응답에 같이 실려 온다(표식만 따로 부르지 않는다).
  expect(gets).toBe(1);
  if (SHOTS) await locker.screenshot({ path: `${SHOTS}/web-locker-specials.png` });
});

test('결산 화면은 그 시즌 특별 카드를 개인상 · 베스트 11 순으로 보여 주고 내 선수를 표시한다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await stubProfile(page);
  const archive = {
    ...archiveFixture,
    owner: {
      ...archiveFixture.owner,
      seasons: archiveFixture.owner.seasons.map((s) => ({ ...s, closed: true })),
    },
  };
  const kinds = ['mvp', 'top_scorer', 'top_assist', 'best11', 'best11', 'best11'] as const;
  const seasonBest = kinds.map((kind, i) => ({
    special: { season: 1, kind, rank: kind === 'best11' ? i - 2 : 1 },
    card: card(20 + i, { pos: i === 3 ? 'GK' : 'FW', dpos: i === 3 ? 'GK' : 'ST' }),
    mine: i === 0 || i === 4,
  }));
  const recap: SeasonRecapResponse = {
    ...recapFixture,
    season: 1,
    recap: { ...recapFixture.recap!, season: 1, seasonBest },
  };
  let details = 0;
  await page.route(`${API}/v1/owner/archive`, (r) => r.fulfill(ok(archive)));
  await page.route(`${API}/v1/owner/season-recap?season=1`, (r) => {
    details++;
    return r.fulfill(ok(recap));
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="open-owner-hall"]').click();
  await page.locator('[data-room-zone="0"]').click();
  await page.locator('[data-archive-season="1"]').click();
  await page.locator('[data-act="archive-details"]').click();
  const sec = page.locator('[data-recap-section="specials"]');
  await expect(sec).toBeVisible();
  await expect(sec.locator('h2')).toHaveText('시즌 특별 카드');
  await expect(sec.locator('[data-recap-special]')).toHaveCount(6);
  await expect(sec.locator('[data-recap-special]').first()).toHaveAttribute(
    'data-recap-special',
    'mvp',
  );
  await expect(sec.locator('[data-recap-specials-mine]')).toHaveText('내 선수 2명이 뽑혔어요');
  await expect(sec.locator('li.mine')).toHaveCount(2);
  await expect(sec.locator('[data-card-special="top_scorer"]')).toHaveText('S1 득점왕');
  expect(details).toBe(1);
  if (SHOTS) {
    await sec.scrollIntoViewIfNeeded();
    await sec.screenshot({ path: `${SHOTS}/web-recap-specials.png` });
  }
});

test('표식이 없는 결산(프리시즌)에는 특별 카드 칸이 없다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await stubProfile(page);
  await page.route(`${API}/v1/owner/archive`, (r) => r.fulfill(ok(archiveFixture)));
  await page.route(`${API}/v1/owner/season-recap?season=0`, (r) =>
    r.fulfill(ok({ ...recapFixture, recap: { ...recapFixture.recap!, seasonBest: [] } })),
  );
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="open-owner-hall"]').click();
  await page.locator('[data-room-zone="0"]').click();
  await page.locator('[data-archive-season="0"]').click();
  await page.locator('[data-act="archive-details"]').click();
  await expect(page.locator('[data-recap-section="team"]')).toBeVisible();
  await expect(page.locator('[data-recap-section="specials"]')).toHaveCount(0);
});
