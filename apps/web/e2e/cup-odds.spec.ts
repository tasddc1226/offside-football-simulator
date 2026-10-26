import { expect, test } from '@playwright/test';
import { API, ok } from './helpers.js';

// T-11-405 컵 화면 다음 경기 칸: 지금 두 팀 명단으로 계산한 예상 승 · 무 · 패를 보이고, 토너먼트면 승부차기 안내를 붙인다.
const AT = '2026-10-19T12:00:00.000Z';
const cup = {
  id: 's2-2',
  season: 2,
  edition: 2,
  opensAt: '2026-10-17T15:00:00.000Z',
  closesAt: '2026-10-17T19:00:00.000Z',
  drawAt: '2026-10-18T01:00:00.000Z',
  rounds: [
    { round: 'g1', at: '2026-10-18T12:00:00.000Z', lockAt: '2026-10-18T11:00:00.000Z' },
    { round: 'g2', at: AT, lockAt: '2026-10-19T11:00:00.000Z' },
    { round: 'g3', at: '2026-10-20T12:00:00.000Z', lockAt: '2026-10-20T11:00:00.000Z' },
    { round: 'r64', at: '2026-10-21T12:00:00.000Z', lockAt: '2026-10-21T11:00:00.000Z' },
  ],
  capacity: 128,
  minFilled: 8,
};
const team = (teamId: string, name: string, ovr: number) => ({
  teamId,
  name,
  owner: '감독',
  logo: null,
  ovr,
});
const match = (round: string, group: number | null) => ({
  id: 'm1',
  round,
  group,
  slot: 0,
  homeTeamId: 'tem_a',
  awayTeamId: 'tem_b',
  at: AT,
  played: false,
  homeGoals: null,
  awayGoals: null,
  pens: null,
  winnerTeamId: null,
  forfeit: false,
});

async function open(page: import('@playwright/test').Page, round: string, group: number | null) {
  await page.clock.setFixedTime(new Date('2026-10-19T09:00:00.000Z'));
  await page.route(`${API}/**`, (r) => {
    const path = new URL(r.request().url()).pathname;
    const data =
      path === '/v1/profile'
        ? {
            id: 'u1',
            linked: { google: true },
            googleEmailMasked: 'u***@example.com',
            recoveryCodeIssuedAt: null,
            createdAt: '2026-01-01T00:00:00.000Z',
          }
        : path === '/v1/cups/home'
          ? {
              cup,
              phase: 'group',
              entries: 2,
              teamCount: 2,
              round: null,
              championName: null,
              champion: null,
            }
          : path === '/v1/cups/current'
            ? {
                cup,
                phase: group ? 'group' : 'knockout',
                entries: 2,
                teams: [team('tem_a', '우리팀', 88), team('tem_b', '상대팀', 92)],
                groups: [],
                matches: [match(round, group)],
                championTeamId: null,
              }
            : path === '/v1/cups/current/me'
              ? {
                  entry: {
                    teamId: 'tem_a',
                    status: 'active',
                    group,
                    stage: null,
                    createdAt: cup.opensAt,
                  },
                  eligibility: { ok: false, reason: 'closed', filled: 11 },
                  next: match(round, group),
                  nextOdds: { win: 31, draw: 26, loss: 43, xg: { mine: 1.1, opp: 1.5 } },
                  locked: false,
                  rerolls: 0,
                }
              : null;
    return data ? r.fulfill(ok(data)) : r.fulfill({ status: 503, body: '' });
  });
  await page.goto('/');
  await page.locator('[data-act="cup-open"]').click();
}

test('조별 경기: 예상 승 · 무 · 패와 명단 기준 안내', async ({ page }) => {
  await open(page, 'g2', 1);
  const odds = page.locator('[data-cup-next] [data-cup-odds]');
  await expect(odds).toContainText('예상 승 31% · 무 26% · 패 43%');
  await expect(odds).toContainText('지금 두 팀 명단으로 계산했어요');
  await expect(odds).not.toContainText('승부차기');
  // 모바일 폭에서 가로로 넘치지 않는다.
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(360);
});

test('토너먼트 경기: 비기면 승부차기 안내를 붙인다', async ({ page }) => {
  await open(page, 'r64', null);
  await expect(page.locator('[data-cup-odds]')).toContainText('승부차기로 가려요');
});

// T-11-407 모든 경기: 참가하지 않은 사람도 명단이 잠긴 경기의 예상 막대를 보고, 끝난 경기는 '경기 전 예상'으로 남는다.
test('참가하지 않아도 경기 일정에 예상 승 · 무 · 패가 보인다', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-19T11:30:00.000Z'));
  const played = {
    ...match('g1', 1),
    id: 'm0',
    at: '2026-10-18T12:00:00.000Z',
    played: true,
    homeGoals: 0,
    awayGoals: 1,
    winnerTeamId: 'tem_b',
    odds: { home: 62, draw: 21, away: 17 },
  };
  const next = { ...match('g2', 1), odds: { home: 47, draw: 26, away: 27 } };
  const later = { ...match('g3', 1), id: 'm2', at: '2026-10-20T12:00:00.000Z', odds: null };
  const requests: string[] = [];
  await page.route(`${API}/**`, (r) => {
    const path = new URL(r.request().url()).pathname;
    requests.push(path);
    const data =
      path === '/v1/cups/home'
        ? {
            cup,
            phase: 'group',
            entries: 2,
            teamCount: 2,
            round: null,
            championName: null,
            champion: null,
          }
        : path === '/v1/cups/current'
          ? {
              cup,
              phase: 'group',
              entries: 2,
              teams: [team('tem_a', '우리팀', 88), team('tem_b', '상대팀', 92)],
              groups: [{ no: 1, standings: [] }],
              matches: [played, next, later],
              championTeamId: null,
            }
          : null;
    return data ? r.fulfill(ok(data)) : r.fulfill({ status: 503, body: '' });
  });
  await page.goto('/');
  await page.locator('[data-act="cup-open"]').click();
  await expect(page.locator('[data-cup-odds-note]')).toContainText('경기 1시간 전');
  const row = (id: string) => page.locator(`[data-cup-match="${id}"] [data-cup-match-odds]`);
  await expect(row('m1')).toContainText('47%');
  await expect(row('m1')).toContainText('무 26%');
  await expect(row('m1')).toHaveAttribute('aria-label', /우리팀 승 47%, 무승부 26%, 상대팀 승 27%/);
  await expect(row('m0')).toContainText('경기 전 예상');
  await expect(row('m2')).toHaveCount(0);
  // 예상은 대회 응답에 들어 있어 따로 부르지 않고, 내 상태(/me)도 로그인 전에는 부르지 않는다.
  expect(requests.filter((p) => p.includes('odds'))).toEqual([]);
  expect(requests).not.toContain('/v1/cups/current/me');
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(360);
});
