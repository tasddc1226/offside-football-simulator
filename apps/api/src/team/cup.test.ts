import { IDEMPOTENCY_KEY_HEADER } from '@offside/contracts';
import { CUP_REWARDS, CUPS, cupGroupCount } from '@offside/contracts/cup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cupEntries, ownerItems, ownerTeams, profiles } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueGoogleCookie } from '../test/http.js';
import { checkCupLineup } from '../routes/cup.js';
import { cupText } from '../cupText.js';
import { cupSchedule, loadCupSchedule } from './cupSchedule.js';
import {
  cupEntriesOf,
  cupHonorsOf,
  cupMatchesOf,
  cupStateOf,
  lineupLocked,
  runCup,
} from './cup.js';
import { drawGroups, firstKoPairs, groupFixtures, groupStandings } from './cupRules.js';
import { buildLineup, penaltyShootout } from './sim.js';

// 실제 제1회 대회 일정 그대로 돌린다(기록·명단 검사가 CUPS를 본다).
const CUP = CUPS[0]!;

describe('T-11-145 컵 규칙', () => {
  it('팀 수로 조 수를 정한다', () => {
    expect(cupGroupCount(64)).toBe(16);
    expect(cupGroupCount(32)).toBe(16);
    expect(cupGroupCount(31)).toBe(8);
    expect(cupGroupCount(8)).toBe(4);
    expect(cupGroupCount(4)).toBe(2);
    expect(cupGroupCount(3)).toBe(0);
  });

  it('포트 추첨은 조마다 고르게 나누고 같은 시드면 같다', () => {
    const teams = Array.from({ length: 64 }, (_, i) => ({
      teamId: `t${i}`,
      ovr: 90 - Math.floor(i / 2),
    }));
    const a = drawGroups(teams, 16, 'seed');
    expect(drawGroups(teams, 16, 'seed')).toEqual(a);
    const sizes = new Map<number, number>();
    for (const g of a.values()) sizes.set(g, (sizes.get(g) ?? 0) + 1);
    expect([...sizes.values()].every((n) => n === 4)).toBe(true);
    // 상위 16팀(1포트)은 모두 다른 조.
    expect(new Set(teams.slice(0, 16).map((t) => a.get(t.teamId))).size).toBe(16);
  });

  it('조 일정: 4팀은 6경기, 3팀은 3경기, 2팀은 1경기', () => {
    const n = (ids: string[]) => groupFixtures(ids).flat().length;
    expect(n(['a', 'b', 'c', 'd'])).toBe(6);
    expect(n(['a', 'b', 'c'])).toBe(3);
    expect(n(['a', 'b'])).toBe(1);
    // 4팀 조는 모든 짝이 한 번씩.
    const pairs = groupFixtures(['a', 'b', 'c', 'd'])
      .flat()
      .map((p) => [...p].sort().join(''));
    expect(new Set(pairs).size).toBe(6);
  });

  it('순위: 승점 → 득실 → 다득점 → 승자승', () => {
    const m = (home: string, away: string, homeGoals: number, awayGoals: number) => ({
      home,
      away,
      homeGoals,
      awayGoals,
    });
    // 셋이 3점씩 돌고 돌면 득실로: b +1, a 0, c -1.
    const cycle = [m('a', 'b', 1, 0), m('b', 'c', 2, 0), m('c', 'a', 1, 0)];
    expect(groupStandings(['a', 'b', 'c'], cycle, 's').map((x) => x.teamId)).toEqual([
      'b',
      'a',
      'c',
    ]);
    // a·b가 승점 6·2득 1실로 같다 → 승자승(a가 b를 1-0)은 추첨 시드와 상관없이 a.
    const tie = [
      m('a', 'b', 1, 0),
      m('a', 'c', 0, 1),
      m('a', 'd', 1, 0),
      m('b', 'c', 1, 0),
      m('b', 'd', 1, 0),
      m('c', 'd', 0, 0),
    ];
    for (const seed of ['s1', 's2', 's3', 's4', 's5', 's6']) {
      const t = groupStandings(['d', 'c', 'b', 'a'], tie, seed);
      expect(t.map((x) => x.teamId)).toEqual(['a', 'b', 'c', 'd']);
      expect(t.map((x) => x.rank)).toEqual([1, 2, 3, 4]);
    }
  });

  it('토너먼트 첫 대진: 같은 조 1·2위는 다른 반쪽', () => {
    const pairs = firstKoPairs(['A1', 'B1', 'C1', 'D1'], ['A2', 'B2', 'C2', 'D2']);
    expect(pairs).toEqual([
      ['A1', 'B2'],
      ['C1', 'D2'],
      ['B1', 'A2'],
      ['D1', 'C2'],
    ]);
  });

  it('알림 문장을 영어·일본어로 옮긴다(팀 이름은 그대로)', () => {
    expect(cupText('오프사이드 컵 결승 — 이겼어요', 'en')).toBe('OFFSIDE Cup Final: You won');
    expect(cupText('시즌 1 제1회 오프사이드 컵 조 추첨 결과', 'en')).toBe(
      'Season 1 OFFSIDE Cup #1 group draw',
    );
    expect(cupText('우리 FC은(는) 3조예요. 첫 경기는 오늘 밤 9시예요.', 'ja')).toBe(
      '우리 FCはグループ3です。初戦は今夜9時です。',
    );
    expect(cupText('다른 문장', 'en')).toBeUndefined();
  });

  it('일정 덮어쓰기는 운영에서는 듣지 않는다', () => {
    const fake = JSON.stringify([{ ...CUP, id: 's1-8' }]);
    loadCupSchedule({ ENVIRONMENT: 'production', CUP_SCHEDULE: fake });
    expect(cupSchedule()).toBe(CUPS);
    loadCupSchedule({ ENVIRONMENT: 'staging', CUP_SCHEDULE: fake });
    expect(cupSchedule()[0]!.id).toBe('s1-8');
    loadCupSchedule({ ENVIRONMENT: 'staging' });
    expect(cupSchedule()).toBe(CUPS);
  });

  it('승부차기는 늘 승자가 있고 시드가 같으면 같다', () => {
    const youth = buildLineup('4-4-2', Array(11).fill(null), new Map());
    for (let i = 0; i < 50; i++) {
      const p = penaltyShootout(`m${i}`, youth, youth);
      expect(p.home).not.toBe(p.away);
      expect(penaltyShootout(`m${i}`, youth, youth)).toEqual(p);
    }
  });
});

describe('T-11-145 컵 진행(cron)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  async function enter(n: number, filled = 11) {
    const out: { profileId: string; teamId: string }[] = [];
    for (let i = 0; i < n; i++) {
      // 세션 발급은 IP 한도가 있어 프로필을 바로 넣는다(cron은 세션을 보지 않는다).
      const who = { profileId: `prf_${crypto.randomUUID()}` };
      await ctx.db.insert(profiles).values({
        id: who.profileId,
        settingsJson: '{}',
        createdAt: CUP.opensAt,
        lastSeenAt: CUP.opensAt,
      });
      const teamId = `tem_${crypto.randomUUID()}`;
      await ctx.db.insert(ownerTeams).values({
        id: teamId,
        profileId: who.profileId,
        season: 1,
        name: `팀${i}`,
        manager: `감독${i}`,
        formation: '4-4-2',
        slotsJson: JSON.stringify(Array(11).fill(null)),
        filled,
        ovr: 60 + (i % 30),
        createdAt: CUP.opensAt,
        updatedAt: CUP.opensAt,
      });
      await ctx.db.insert(cupEntries).values({
        cupId: CUP.id,
        teamId,
        profileId: who.profileId,
        name: `팀${i}`,
        manager: `감독${i}`,
        ovr: 60,
        createdAt: CUP.opensAt,
        updatedAt: CUP.opensAt,
      });
      out.push({ ...who, teamId });
    }
    return out;
  }

  async function runAll() {
    await runCup(ctx.db, CUP.drawAt, [CUP]);
    for (const at of CUP.rounds) await runCup(ctx.db, at, [CUP]);
  }

  it.each([64, 40, 20, 5])('%i팀: 끝까지 치르고 모두 한 번씩 보상받는다', async (n) => {
    const teams = await enter(n);
    await runAll();
    const [state] = await cupStateOf(ctx.db, CUP.id);
    expect(state?.doneAt).not.toBeNull();
    const entries = await cupEntriesOf(ctx.db, CUP.id);
    expect(entries.every((e) => e.rewardedAt && e.stage)).toBe(true);
    expect(entries.filter((e) => e.stage === 'champion')).toHaveLength(1);
    expect(entries.filter((e) => e.stage === 'runnerup')).toHaveLength(1);
    // 조 수 × 2팀이 토너먼트, 나머지는 조별 탈락.
    const g = cupGroupCount(n);
    expect(entries.filter((e) => e.stage === 'group')).toHaveLength(n - 2 * g);
    const items = await ctx.db.select().from(ownerItems);
    const expected = entries.reduce((s, e) => s + CUP_REWARDS[e.stage as 'group'].rerolls, 0);
    expect(items.reduce((s, x) => s + x.qty, 0)).toBe(expected);
    // 한 번 더 돌려도 바뀌지 않는다(멱등).
    await runCup(ctx.db, CUP.rounds.at(-1)!, [CUP]);
    const again = await ctx.db.select().from(ownerItems);
    expect(again.reduce((s, x) => s + x.qty, 0)).toBe(expected);
    const matches = await cupMatchesOf(ctx.db, CUP.id);
    expect(matches.every((m) => m.playedAt && (m.round.startsWith('g') || m.winnerTeamId))).toBe(
      true,
    );
    // 우승팀 구단주의 영구 기록.
    const champ = entries.find((e) => e.stage === 'champion')!;
    expect((await cupHonorsOf(ctx.db, champ.profileId))[0]).toMatchObject({ stage: 'champion' });
    expect(teams).toHaveLength(n);
  });

  it('추첨 때 자격이 모자란 팀은 빠지고, 4팀 미만이면 열지 않는다', async () => {
    await enter(2);
    await enter(1, 5);
    await runCup(ctx.db, CUP.drawAt, [CUP]);
    const [state] = await cupStateOf(ctx.db, CUP.id);
    expect(state).toMatchObject({ groups: 0 });
    expect(state?.doneAt).not.toBeNull();
    const entries = await cupEntriesOf(ctx.db, CUP.id);
    expect(entries.every((e) => e.status === 'withdrawn')).toBe(true);
  });

  it('경기 1시간 전부터 끝날 때까지 명단이 잠긴다', async () => {
    const [a] = await enter(8);
    await runCup(ctx.db, CUP.drawAt, [CUP]);
    const matches = await cupMatchesOf(ctx.db, CUP.id);
    const at = CUP.rounds[0]!;
    const before = new Date(Date.parse(at) - 61 * 60_000).toISOString();
    const during = new Date(Date.parse(at) - 30 * 60_000).toISOString();
    expect(lineupLocked(matches, a!.teamId, before)).toBe(false);
    expect(lineupLocked(matches, a!.teamId, during)).toBe(true);
    // 명단 저장도 같은 판정으로 막고, 잠기기 전에는 통과한다.
    await expect(checkCupLineup(ctx.db, a!.profileId, 1, [], 11, during)).rejects.toMatchObject({
      details: { reason: 'CUP_LINEUP_LOCKED' },
    });
    await expect(checkCupLineup(ctx.db, a!.profileId, 1, [], 11, before)).resolves.toBeUndefined();
    // 실제 카드가 8명보다 적으면 대회 중에는 저장할 수 없다.
    await expect(checkCupLineup(ctx.db, a!.profileId, 1, [], 7, before)).rejects.toMatchObject({
      details: { reason: 'CUP_MIN_FILLED' },
    });
    await runCup(ctx.db, at, [CUP]);
    expect(lineupLocked(await cupMatchesOf(ctx.db, CUP.id), a!.teamId, during)).toBe(false);
  });

  it('리롤권은 있는 만큼만 쓴다', async () => {
    const who = await issueGoogleCookie(ctx);
    const use = (k: string) =>
      callJson(ctx.env, 'POST', '/v1/items/reroll/use', {
        cookie: who.cookie,
        headers: { [IDEMPOTENCY_KEY_HEADER]: `reroll-${k}-key` },
      });
    expect((await use('a')).status).toBe(409);
    await ctx.db
      .insert(ownerItems)
      .values({ profileId: who.profileId, item: 'reroll', qty: 1, updatedAt: CUP.opensAt });
    const ok = await use('b');
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { data: { reroll: number } }).data.reroll).toBe(0);
    // 같은 키로 다시 보내면 한 장을 더 쓰지 않는다.
    expect((await use('b')).status).toBe(200);
    expect((await use('c')).status).toBe(409);
  });

  it('대회 화면은 누구나 본다', async () => {
    const res = await callJson(ctx.env, 'GET', '/v1/cups/current');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { cup: { id: string }; phase: string } };
    expect(body.data.cup.id).toBe('s1-1');
  });
});
