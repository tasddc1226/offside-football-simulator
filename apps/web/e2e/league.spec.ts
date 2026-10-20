import { expect, test } from '@playwright/test';
import { API, ok } from './helpers.js';

// T-11-418 오프사이드 리그 1차: 홈 배너 → 리그 화면에서 신청 · 취소. 다시 들어와도 공개 조회는 메모로 한 번만 부른다.
const league = {
  season: 2,
  startsAt: '2026-10-30T15:00:00.000Z',
  opensAt: '2026-10-23T15:00:00.000Z',
  closesAt: '2026-11-04T15:00:00.000Z',
  drawAt: '2026-11-05T00:00:00.000Z',
  rounds: Array.from(
    { length: 14 },
    (_, i) => `2026-11-${String(5 + i).padStart(2, '0')}T04:00:00.000Z`,
  ),
  minFilled: 8,
};

test('배너 → 리그 화면 신청 · 취소, 다시 들어와도 리그 조회는 한 번', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-01T03:00:00.000Z'));
  const hits: Record<string, number> = {};
  let entered = false;
  await page.route(`${API}/**`, async (r) => {
    const path = new URL(r.request().url()).pathname;
    const method = r.request().method();
    hits[`${method} ${path}`] = (hits[`${method} ${path}`] ?? 0) + 1;
    if (path === '/v1/profile')
      return r.fulfill(
        ok({
          id: 'u1',
          linked: { google: true },
          googleEmailMasked: 'u***@example.com',
          recoveryCodeIssuedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        }),
      );
    if (path === '/v1/leagues/current')
      return r.fulfill(ok({ league, phase: 'open', entries: entered ? 13 : 12 }));
    if (path === '/v1/leagues/current/me')
      return r.fulfill(
        ok({
          entry: entered ? { createdAt: '2026-11-01T03:00:00.000Z' } : null,
          canEnter: !entered,
          team: { teamId: 'tem_1', filled: 9, ovr: 84 },
        }),
      );
    if (path === '/v1/leagues/current/entries' && method === 'POST') {
      entered = true;
      return r.fulfill({ status: 204, body: '' });
    }
    if (path === '/v1/leagues/current/entries/me' && method === 'DELETE') {
      entered = false;
      return r.fulfill({ status: 204, body: '' });
    }
    return r.fulfill({ status: 503, body: '' });
  });
  await page.goto('/');
  const banner = page.locator('[data-league-banner]');
  await expect(banner).toContainText('12팀 신청 · 11월 4일 23:59까지');
  await banner.click();
  await expect(page.locator('[data-league-schedule]')).toContainText(
    '11월 5일 ~ 11월 18일, 매일 13:00',
  );
  await expect(page.locator('[data-league-ovr]')).toContainText('84');

  // 홈에 갔다가 다시 들어와도 리그 조회는 메모(30초)로 한 번만.
  await page.goBack();
  await page.locator('[data-league-banner]').click();
  await expect(page.locator('[data-act="league-enter"]')).toBeVisible();
  expect(hits['GET /v1/leagues/current']).toBe(1);

  await page.locator('[data-act="league-enter"]').click();
  await expect(page.locator('[data-league-entered]')).toBeVisible();
  page.once('dialog', (d) => void d.accept());
  await page.locator('[data-act="league-withdraw"]').click();
  await expect(page.locator('[data-act="league-enter"]')).toBeVisible();
  expect(hits['POST /v1/leagues/current/entries']).toBe(1);
  expect(hits['DELETE /v1/leagues/current/entries/me']).toBe(1);
});

test('사전 신청: 시즌 2 팀이 없어도 신청할 수 있고, 개막 뒤엔 선발 실카드 n/8을 보인다', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-27T03:00:00.000Z'));
  let team: { teamId: string; filled: number; ovr: number } | null = null;
  await page.route(`${API}/**`, (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path === '/v1/profile')
      return r.fulfill(
        ok({
          id: 'u1',
          linked: { google: true },
          googleEmailMasked: 'u***@example.com',
          recoveryCodeIssuedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        }),
      );
    if (path === '/v1/leagues/current') return r.fulfill(ok({ league, phase: 'open', entries: 3 }));
    if (path === '/v1/leagues/current/me')
      return r.fulfill(ok({ entry: null, canEnter: true, team }));
    return r.fulfill({ status: 503, body: '' });
  });
  await page.goto('/');
  await page.locator('[data-league-banner]').click();
  await expect(page.locator('[data-act="league-enter"]')).toBeVisible();
  await expect(page.locator('[data-league-presign]')).toContainText('10월 31일 00:00 개막부터');
  await expect(page.locator('[data-league-ready]')).toHaveCount(0);

  // 개막 뒤: 시즌 2 팀 선발 실카드가 모자라면 n/8을 보이지만 신청은 막지 않는다.
  team = { teamId: 'tem_1', filled: 6, ovr: 70 };
  await page.clock.setFixedTime(new Date('2026-11-01T03:00:00.000Z'));
  await page.goto('/');
  await page.locator('[data-league-banner]').click();
  await expect(page.locator('[data-league-ready="short"]')).toContainText('6/8명');
  await expect(page.locator('[data-league-presign]')).toHaveCount(0);
  await expect(page.locator('[data-act="league-enter"]')).toBeVisible();
});

test('T-11-418b 배치 뒤: 내 배치 · 순위표 · 라운드 경기 · 경기 상세, 다른 리그 고르기', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-07T06:00:00.000Z'));
  const hits: Record<string, number> = {};
  const ids = Array.from({ length: 8 }, (_, i) => `tem_${i + 1}`);
  const team = (id: string, i: number) => ({
    teamId: id,
    name: `리그팀${i + 1}`,
    owner: `감독${i + 1}`,
    logo: null,
    ovr: 90 - i,
  });
  const standing = (id: string, i: number) => ({
    teamId: id,
    p: 3,
    w: 3 - Math.min(3, i),
    d: 0,
    l: Math.min(3, i),
    gf: 6 - i,
    ga: i,
    pts: (3 - Math.min(3, i)) * 3,
    rank: i + 1,
    forfeits: i === 7 ? 1 : 0,
  });
  const match = (round: number, slot: number, played: boolean) => ({
    id: `lgm_${round}_${slot}`,
    round,
    homeTeamId: ids[slot]!,
    awayTeamId: ids[7 - slot]!,
    at: `2026-11-${String(4 + round).padStart(2, '0')}T04:00:00.000Z`,
    played,
    homeGoals: played ? 2 : null,
    awayGoals: played ? 1 : null,
    forfeit: false,
  });
  const table = (tier: number, no: number) => ({
    season: 2,
    tier,
    league: no,
    teams: ids.map(team),
    standings: ids.map(standing),
    matches: Array.from({ length: 14 }, (_, r) =>
      Array.from({ length: 4 }, (_, s) => match(r + 1, s, r < 3)),
    ).flat(),
  });
  await page.route(`${API}/**`, async (r) => {
    const path = new URL(r.request().url()).pathname;
    hits[path] = (hits[path] ?? 0) + 1;
    if (path === '/v1/profile')
      return r.fulfill(
        ok({
          id: 'u1',
          linked: { google: true },
          googleEmailMasked: 'u***@example.com',
          recoveryCodeIssuedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        }),
      );
    if (path === '/v1/leagues/current')
      return r.fulfill(
        ok({
          league,
          phase: 'running',
          entries: 24,
          tiers: [
            { tier: 1, leagues: 1, teams: 8 },
            { tier: 2, leagues: 2, teams: 16 },
          ],
          playedRounds: 3,
        }),
      );
    if (path === '/v1/leagues/current/me')
      return r.fulfill(
        ok({
          entry: { createdAt: '2026-11-01T03:00:00.000Z' },
          canEnter: false,
          team: { teamId: 'tem_3', filled: 9, ovr: 88 },
          placement: { status: 'placed', tier: 1, league: 1, teamId: 'tem_3', rank: 3 },
        }),
      );
    const t = /^\/v1\/leagues\/2\/tables\/(\d+)\/(\d+)$/.exec(path);
    if (t) return r.fulfill(ok(table(Number(t[1]), Number(t[2]))));
    if (path === '/v1/leagues/2/matches/lgm_3_2')
      return r.fulfill(
        ok({
          match: {
            id: 'lgm_3_2',
            home: {
              teamId: 'tem_3',
              name: '리그팀3',
              owner: '감독3',
              formation: '4-3-3',
              ovr: 88,
              goals: 2,
              ratingChange: null,
            },
            away: {
              teamId: 'tem_6',
              name: '리그팀6',
              owner: '감독6',
              formation: '4-3-3',
              ovr: 85,
              goals: 1,
              ratingChange: null,
            },
            events: [],
            mine: 'home',
            createdAt: '2026-11-07T04:00:00.000Z',
          },
          league: { tier: 1, league: 1, round: 3, forfeit: false },
        }),
      );
    return r.fulfill({ status: 503, body: '' });
  });
  await page.goto('/');
  await page.locator('[data-league-banner]').click();
  await expect(page.locator('[data-league-placement="placed"]')).toHaveText('1부 1리그 · 지금 3위');
  const board = page.locator('[data-league-table="1-1"]');
  await expect(board.locator('tbody tr')).toHaveCount(8);
  await expect(board.locator('tr.down')).toHaveCount(2);
  await expect(board).toContainText('기권 1');
  // 다음 라운드(4라운드)가 먼저 보이고, 3라운드를 고르면 끝난 경기를 연다.
  await expect(page.locator('[data-league-round]')).toHaveValue('4');
  await page.locator('[data-league-round]').selectOption('3');
  await page.locator('[data-league-match="lgm_3_2"] [data-act="league-match-open"]').click();
  await expect(page.locator('[data-act="league-detail-back"]')).toBeVisible();
  await page.locator('[data-act="league-detail-back"]').click();
  await expect(board).toBeVisible();
  await page.locator('[data-league-pick]').selectOption('2-2');
  await expect(page.locator('[data-league-table="2-2"] tr.up')).toHaveCount(1);
  // 같은 리그를 다시 골라도 메모(60초)로 한 번만 부른다.
  await page.locator('[data-league-pick]').selectOption('1-1');
  await expect(page.locator('[data-league-table="1-1"]')).toBeVisible();
  expect(hits['/v1/leagues/2/tables/1/1']).toBe(1);
  expect(hits['/v1/leagues/2/matches/lgm_3_2']).toBe(1);
});
