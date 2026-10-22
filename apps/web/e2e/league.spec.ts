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

  // T-11-444 신청은 확인 창(자격 · 기권 · 취소 마감)을 거친다. 닫으면 신청하지 않는다.
  await page.locator('[data-act="league-enter"]').click();
  const ask = page.locator('[data-league-ask="enter"]');
  await expect(ask).toContainText('참가 자격');
  await expect(ask).toContainText('11월 4일 23:59까지는 신청을 취소할 수 있어요.');
  await ask.locator('[data-act="league-ask-close"]').click();
  await expect(ask).toHaveCount(0);
  expect(hits['POST /v1/leagues/current/entries']).toBeUndefined();
  await page.locator('[data-act="league-enter"]').click();
  await page.locator('[data-act="league-enter-confirm"]').click();
  await expect(page.locator('[data-league-entered]')).toBeVisible();
  await page.locator('[data-act="league-withdraw"]').click();
  await page.locator('[data-act="league-withdraw-confirm"]').click();
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

// T-11-430 신청 · 자격 · 기권 안내.
const profile = {
  id: 'u1',
  linked: { google: true },
  googleEmailMasked: 'u***@example.com',
  recoveryCodeIssuedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

test('T-11-430 사전 신청: 지금 시즌 팀 선발 수와 자격 · 기권 규칙을 신청 카드에 보인다', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-27T03:00:00.000Z'));
  await page.route(`${API}/**`, (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path === '/v1/profile') return r.fulfill(ok(profile));
    if (path === '/v1/leagues/current') return r.fulfill(ok({ league, phase: 'open', entries: 3 }));
    if (path === '/v1/leagues/current/me')
      return r.fulfill(
        ok({ entry: null, canEnter: true, team: null, lastTeam: { season: 1, filled: 6 } }),
      );
    return r.fulfill({ status: 503, body: '' });
  });
  await page.goto('/');
  await page.locator('[data-league-banner]').click();
  await expect(page.locator('[data-league-ready="short"]')).toContainText(
    '지금 시즌 1 팀 선발에 내 은퇴 선수가 6명이에요',
  );
  const rules = page.locator('[data-league-entry-rules] li');
  await expect(rules).toHaveCount(2);
  await expect(rules.first()).toContainText('참가 자격');
  await expect(rules.nth(1)).toContainText('3번 기권하면');
  // 사전 신청 기간엔 시즌 2 팀을 아직 만들 수 없어 팀 화면 버튼이 없다.
  await expect(page.locator('[data-act="league-team"]')).toHaveCount(0);
});

test('T-11-430 접수 마감 뒤 배치 전: 준비 상태 n/8과 팀 선발 고치기로 팀 화면을 연다', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-04T16:00:00.000Z'));
  await page.route(`${API}/**`, (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path === '/v1/profile') return r.fulfill(ok(profile));
    if (path === '/v1/leagues/current')
      return r.fulfill(ok({ league, phase: 'closed', entries: 20 }));
    if (path === '/v1/leagues/current/me')
      return r.fulfill(
        ok({
          entry: { createdAt: '2026-11-01T03:00:00.000Z' },
          canEnter: false,
          team: { teamId: 'tem_1', filled: 7, ovr: 80 },
          lastTeam: null,
        }),
      );
    return r.fulfill({ status: 503, body: '' });
  });
  await page.goto('/');
  await page.locator('[data-league-banner]').click();
  await expect(page.locator('[data-league-ready="short"]')).toContainText('7/8명');
  const team = page.waitForRequest((q) => new URL(q.url()).pathname === '/v1/owner-team');
  await page.locator('[data-act="league-team"]').click();
  await team;
  await expect(page.locator('[data-league-hero]')).toHaveCount(0);
});

test('T-11-430 팀 수 조정으로 빠지면 자격 탓이 아니라고 알린다', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-07T06:00:00.000Z'));
  await page.route(`${API}/**`, (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path === '/v1/profile') return r.fulfill(ok(profile));
    if (path === '/v1/leagues/current')
      return r.fulfill(
        ok({
          league,
          phase: 'running',
          entries: 8,
          tiers: [{ tier: 1, leagues: 1, teams: 8 }],
          playedRounds: 0,
        }),
      );
    if (path === '/v1/leagues/current/me')
      return r.fulfill(
        ok({
          entry: { createdAt: '2026-11-01T03:00:00.000Z' },
          canEnter: false,
          team: { teamId: 'tem_9', filled: 9, ovr: 60 },
          placement: {
            status: 'dropped',
            tier: null,
            league: null,
            teamId: null,
            rank: null,
            reason: 'capacity',
          },
        }),
      );
    return r.fulfill({ status: 503, body: '' });
  });
  await page.goto('/');
  await page.locator('[data-league-banner]').click();
  const line = page.locator('[data-league-placement="dropped"]');
  await expect(line).toContainText('자격은 갖췄지만');
  await expect(line).toContainText('다음 시즌에 다시 신청할 수 있어요');
  await expect(line).not.toContainText('모자라');
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
  await expect(board).toContainText('기권 1/3');
  // T-11-430 내 줄에는 기권이 없어도 기권 0/3을 보인다.
  await expect(board.locator('[data-league-forfeits="mine"]')).toContainText('기권 0/3');
  // T-11-444 범례는 이 부(1부)에 맞춘 승강 한 줄, 라운드에는 날짜와 한국 시간.
  await expect(board.locator('[data-league-legend]')).toHaveText(
    '1위는 우승, 7 · 8위는 다음 시즌 2부로 내려가요.',
  );
  // 다음 라운드(4라운드)가 먼저 보이고, 3라운드를 고르면 끝난 경기를 연다.
  await expect(page.locator('[data-league-round]')).toHaveValue('4');
  await expect(page.locator('[data-league-round-at]')).toHaveText('11월 8일 13:00 한국 시간');
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

test('T-11-418d 끝난 리그: 확정 배지 · 리그 기록 · 마지막 라운드 동시 중계', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date('2026-11-18T06:00:00.000Z'));
  const ids = Array.from({ length: 8 }, (_, i) => `tem_${i + 1}`);
  const finalGoals = [
    { minute: 10, side: 'home' },
    { minute: 50, side: 'away' },
    { minute: 80, side: 'home' },
  ];
  const table = {
    season: 2,
    tier: 1,
    league: 1,
    teams: ids.map((id, i) => ({
      teamId: id,
      name: `리그팀${i + 1}`,
      owner: `감독${i + 1}`,
      logo: null,
      ovr: 90 - i,
    })),
    standings: ids.map((id, i) => ({
      teamId: id,
      p: 14,
      w: 14 - i,
      d: 0,
      l: i,
      gf: 30 - i,
      ga: 10 + i,
      pts: (14 - i) * 3,
      rank: i + 1,
      forfeits: 0,
    })),
    matches: Array.from({ length: 14 }, (_, r) =>
      Array.from({ length: 4 }, (_, s) => ({
        id: `lgm_${r + 1}_${s}`,
        round: r + 1,
        homeTeamId: ids[s]!,
        awayTeamId: ids[7 - s]!,
        at: `2026-11-${String(5 + r).padStart(2, '0')}T04:00:00.000Z`,
        played: true,
        homeGoals: 2,
        awayGoals: 1,
        forfeit: false,
        ...(r === 13 ? { goals: finalGoals } : {}),
      })),
    ).flat(),
    scorers: [
      { name: '김공격', pos: 'FW', number: 9, teamId: 'tem_1', goals: 12 },
      { name: null, pos: 'MF', number: 8, teamId: 'tem_2', goals: 9 },
    ],
  };
  await page.route(`${API}/**`, async (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path === '/v1/leagues/current')
      return r.fulfill(
        ok({
          league,
          phase: 'running',
          entries: 16,
          tiers: [
            { tier: 1, leagues: 1, teams: 8 },
            { tier: 2, leagues: 1, teams: 8 },
          ],
          playedRounds: 14,
        }),
      );
    if (path === '/v1/leagues/2/tables/1/1') return r.fulfill(ok(table));
    return r.fulfill({ status: 503, body: '' });
  });
  await page.goto('/');
  await page.locator('[data-league-banner]').click();
  const board = page.locator('[data-league-table="1-1"]');
  // 다 끝났으니 최종 순위대로: 1부 1위는 우승, 7 · 8위는 강등, 나머지는 잔류.
  await expect(board.locator('[data-league-clinch="champion"]')).toHaveCount(1);
  await expect(board.locator('[data-league-clinch="safe"]')).toHaveCount(5);
  await expect(board.locator('[data-league-clinch="down"]')).toHaveCount(2);
  const records = page.locator('[data-league-records]');
  await expect(records.locator('[data-league-scorer]')).toHaveCount(2);
  await expect(records.locator('[data-league-scorer]').first()).toContainText('김공격');
  await expect(records.locator('[data-league-scorer]').first()).toContainText('12골');
  await expect(records.locator('[data-league-scorer]').nth(1)).toContainText('No.8');
  await expect(records.locator('[data-league-run="win"]')).toContainText('리그팀1 · 14경기');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await expect(page.locator('[data-league-round]')).toHaveValue('14');
  await page.locator('[data-act="league-final-live"]').click();
  const live = page.locator('[data-league-live]');
  await expect(live).toBeVisible();
  await expect(live.locator('[data-league-live-rank]')).toHaveCount(8);
  await live.locator('[data-act="league-live-skip"]').click();
  await expect(live.locator('[data-league-clock]')).toHaveText('경기 끝');
  await expect(live.locator('[data-league-live-match="lgm_14_0"]')).toContainText('2 : 1');
  await expect(live.locator('[data-league-live-rank="1"]')).toContainText('리그팀1');
  await live.locator('[data-act="league-live-close"]').click();
  await expect(live).toBeHidden();
});

test('T-11-444 마감 뒤엔 취소할 수 없다고 알리고, 내 신청 조회가 실패하면 다시 시도할 수 있다', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-04T16:00:00.000Z'));
  let fail = true;
  await page.route(`${API}/**`, (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path === '/v1/profile') return r.fulfill(ok(profile));
    if (path === '/v1/leagues/current')
      return r.fulfill(ok({ league, phase: 'closed', entries: 20 }));
    if (path === '/v1/leagues/current/me') {
      if (fail) return r.fulfill({ status: 503, body: '' });
      return r.fulfill(
        ok({
          entry: { createdAt: '2026-11-01T03:00:00.000Z' },
          canEnter: false,
          team: { teamId: 'tem_1', filled: 8, ovr: 80 },
          lastTeam: null,
        }),
      );
    }
    return r.fulfill({ status: 503, body: '' });
  });
  await page.goto('/');
  await page.locator('[data-league-banner]').click();
  await expect(page.locator('[data-league-me-error]')).toContainText(
    '내 신청 정보를 불러오지 못했어요.',
  );
  fail = false;
  await page.locator('[data-act="league-me-retry"]').click();
  await expect(page.locator('[data-league-entered]')).toBeVisible();
  await expect(page.locator('[data-league-note]')).toContainText(
    '접수가 끝나 신청을 취소할 수 없어요.',
  );
  await expect(page.locator('[data-act="league-withdraw"]')).toHaveCount(0);
  await expect(page.locator('[data-league-kst]')).toContainText('한국 시간');
});

test('T-11-444 다음 시즌 접수 중엔 지난 시즌 결산을 보이고, 비회원 로그인 안내는 진행 중에 숨긴다', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-01T03:00:00.000Z'));
  let phase = 'open';
  let member = true;
  await page.route(`${API}/**`, (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path === '/v1/profile')
      return r.fulfill(
        ok(
          member
            ? profile
            : { ...profile, linked: { google: false, apple: false }, googleEmailMasked: null },
        ),
      );
    if (path === '/v1/leagues/current') return r.fulfill(ok({ league, phase, entries: 20 }));
    if (path === '/v1/leagues/current/me')
      return r.fulfill(
        ok({
          entry: null,
          canEnter: true,
          team: null,
          lastFinal: { season: 1, tier: 2, league: 1, rank: 1, outcome: 'promoted', nextTier: 1 },
        }),
      );
    return r.fulfill({ status: 503, body: '' });
  });
  await page.goto('/');
  await page.locator('[data-league-banner]').click();
  const last = page.locator('[data-league-last-final="promoted"]');
  await expect(last).toContainText('시즌 1 결산');
  await expect(last).toContainText('2부 1리그 최종 1위');
  await expect(last).toContainText('이번 시즌에 신청하면 1부에서 시작해요.');

  member = false;
  phase = 'running';
  await page.goto('/');
  await page.locator('[data-league-banner]').click();
  await expect(page.locator('[data-league-hero]')).toHaveAttribute('data-league-phase', 'running');
  await expect(page.locator('[data-league-login]')).toHaveCount(0);
  await expect(page.locator('[data-act="league-login-google"]')).toHaveCount(0);
});
