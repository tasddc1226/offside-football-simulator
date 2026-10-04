import {
  AchRankResponseSchema,
  ClubAchievementsResponseSchema,
  ErrorEnvelopeSchema,
  OwnerTeamResponseSchema,
  PlayTeamMatchResponseSchema,
  PutOwnerTeamResponseSchema,
  TeamMatchesResponseSchema,
  TeamOpponentsResponseSchema,
  TeamProfileResponseSchema,
  TeamRankResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import {
  TEAM_MATCHES_PER_DAY,
  YOUTH_OVR,
  matchScore,
  ratingChange,
  presetLayout,
  FORMATIONS,
} from '@offside/contracts/owner-team';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cards, careers, ownerTeams, teamMatches } from '../db/schema.js';
import { rebuildStaleAchievements } from '../team/ownerAchievements.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, deleteProfile, issueCookie, issueGoogleCookie } from '../test/http.js';

const GetRes = successEnvelope(OwnerTeamResponseSchema);
const PutRes = successEnvelope(PutOwnerTeamResponseSchema);
const OppRes = successEnvelope(TeamOpponentsResponseSchema);
const PlayRes = successEnvelope(PlayTeamMatchResponseSchema);
const MatchesRes = successEnvelope(TeamMatchesResponseSchema);
const AchRes = successEnvelope(ClubAchievementsResponseSchema);
const AchRankRes = successEnvelope(AchRankResponseSchema);

type Pos = 'FW' | 'MF' | 'DF' | 'GK';
let seq = 0;

describe('/v1/owner-team (T-10-092 구단주 팀)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    // 기본은 프리시즌(팀 시즌 0) — 시즌 1 개막 뒤에도 테스트가 같은 시즌을 보게 시각을 고정한다.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T00:00:00.000Z'));
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const idem = () => ({ 'Idempotency-Key': `team-match-${++seq}-key` });

  /** 이 프로필의 커리어를 바로 넣는다(은퇴 업로드 검증은 careers.test가 본다). */
  async function addCareer(
    profileId: string,
    over: {
      pos?: Pos;
      dpos?: string | null;
      peak?: number;
      status?: 'active' | 'retired';
      publicName?: string | null;
      nation?: string | null;
      roles?: Record<string, number>;
      serviceSeason?: number | null;
    } = {},
  ) {
    const id = crypto.randomUUID();
    const now = '2026-09-28T00:00:00.000Z';
    const retired = (over.status ?? 'retired') === 'retired';
    await ctx.db.insert(careers).values({
      id,
      profileId,
      pos: over.pos ?? 'FW',
      nation: over.nation ?? null,
      dpos: over.dpos ?? null,
      foot: '오른발',
      type: 'poacher',
      trait: 'late',
      startYear: 2026,
      status: over.status ?? 'retired',
      appVersion: '1.0.0',
      createdAt: now,
      updatedAt: now,
      retiredAt: retired ? now : null,
      retireAge: retired ? 34 : null,
      peak: retired ? (over.peak ?? 80) : null,
      legendScore: retired ? 300 : null,
      shirtNumber: 9,
      publicName: over.publicName ?? null,
      serviceSeason: over.serviceSeason === undefined ? 0 : over.serviceSeason,
      peakProfile: over.roles
        ? JSON.stringify({
            attrs: { pac: 80, sho: 70, pas: 70, dri: 75, def: 60, phy: 70 },
            roles: over.roles,
          })
        : null,
    });
    return id;
  }

  const slots = (...ids: (string | null)[]) => [...ids, ...Array(11 - ids.length).fill(null)];
  const putTeam = (cookie: string, body: Record<string, unknown>) =>
    call('PUT', '/v1/owner-team', {
      cookie,
      body: { name: '우리 FC', manager: '김감독', formation: '4-3-3', ...body },
    });

  /** 구단주 한 명과 선수 n명(공격수)으로 만든 팀. */
  async function ownerWithTeam(n: number, peak = 80, publicName: string | null = null) {
    const who = await issueGoogleCookie(ctx, { nickname: `구단주${++seq}` });
    const ids: string[] = [];
    for (let i = 0; i < n; i++) ids.push(await addCareer(who.profileId, { peak, publicName }));
    // 공격 세 자리(9·10·8번 칸)부터 채운다.
    const order = [9, 8, 10, 7, 6, 5, 1, 2, 3, 4, 0];
    const s: (string | null)[] = Array(11).fill(null);
    ids.forEach((id, i) => (s[order[i]!] = id));
    const res = await putTeam(who.cookie, { slots: s, name: `팀${seq}` });
    expect(res.status).toBe(200);
    return { ...who, ids, team: PutRes.parse(await res.json()).data.team };
  }

  it('세션이 없으면 401, 익명 프로필은 403 GOOGLE_LOGIN_REQUIRED', async () => {
    expect((await call('GET', '/v1/owner-team')).status).toBe(401);
    const anon = await issueCookie(ctx);
    for (const [method, path] of [
      ['GET', '/v1/owner-team'],
      ['PUT', '/v1/owner-team'],
      ['GET', '/v1/owner-team/opponents'],
      ['GET', '/v1/owner-team/matches'],
      ['GET', '/v1/owner-team/achievements'],
    ] as const) {
      const res = await call(method, path, { cookie: anon.cookie, body: {} });
      expect(res.status, `${method} ${path}`).toBe(403);
      const err = ErrorEnvelopeSchema.parse(await res.json()).error;
      expect(err.code).toBe('FORBIDDEN');
      expect(err.details).toEqual({ reason: 'GOOGLE_LOGIN_REQUIRED' });
    }
  });

  it('팀이 없으면 빈 목록과 내 은퇴 선수만(뛰는 중·남의 선수 제외) 돌려준다', async () => {
    const me = await issueGoogleCookie(ctx);
    const a = await addCareer(me.profileId, { peak: 88, publicName: '공개 선수' });
    const b = await addCareer(me.profileId, { pos: 'GK', peak: 70 });
    await addCareer(me.profileId, { status: 'active' });
    const other = await issueGoogleCookie(ctx);
    await addCareer(other.profileId);
    const res = await call('GET', '/v1/owner-team', { cookie: me.cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const data = GetRes.parse(await res.json()).data;
    expect(data).toMatchObject({
      season: 0,
      current: 0,
      seasons: [{ id: 0, name: '프리시즌' }],
      team: null,
      lastManager: null,
    });
    expect(data.matchesLeft).toBe(TEAM_MATCHES_PER_DAY);
    expect(data.players.map((p) => p.careerId)).toEqual([a, b]);
    expect(data.players[0]).toMatchObject({
      pos: 'FW',
      dpos: null,
      peak: 88,
      publicName: '공개 선수',
    });
  });

  it('T-10-091 세부 포지션이 있는 선수는 제자리에서 적합도 1.0, 다른 세부 자리에서 0.9', async () => {
    const me = await issueGoogleCookie(ctx);
    const w = await addCareer(me.profileId, { peak: 80, dpos: 'W' });
    const data = GetRes.parse(
      await (await call('GET', '/v1/owner-team', { cookie: me.cookie })).json(),
    ).data;
    expect(data.players[0]).toMatchObject({ careerId: w, dpos: 'W' });
    // 4-3-3의 8번 칸은 W, 9번 칸은 ST.
    const res = await putTeam(me.cookie, { slots: slots(...Array(8).fill(null), w) });
    const team = PutRes.parse(await res.json()).data.team;
    expect(team.slots[8]).toMatchObject({ careerId: w, rating: 80, fit: 1 });
    const moved = await putTeam(me.cookie, { slots: slots(...Array(9).fill(null), w) });
    expect(PutRes.parse(await moved.json()).data.team.slots[9]).toMatchObject({
      rating: 72,
      fit: 0.9,
    });
  });

  it('추정 능력치 백필은 카드에서만 보이고 기존 편성과 경기 실력을 바꾸지 않는다', async () => {
    const me = await issueGoogleCookie(ctx);
    const fw = await addCareer(me.profileId, { peak: 80 });
    const teamBefore = PutRes.parse(
      await (await putTeam(me.cookie, { slots: slots(null, null, fw) })).json(),
    ).data.team;
    const attrs = { pac: 83, sho: 86, pas: 65, dri: 76, def: 35, phy: 72 };
    await ctx.db
      .update(careers)
      .set({
        cardAttrsJson: JSON.stringify({ v: 1, source: 'estimated', attrs }),
      })
      .where(eq(careers.id, fw));
    const data = GetRes.parse(
      await (await call('GET', '/v1/owner-team', { cookie: me.cookie })).json(),
    ).data;
    expect(data.players[0]).toMatchObject({ attrs, attrsEstimated: true, roles: null });
    expect(data.team).toEqual(teamBefore);
    const [stored] = await ctx.db.select().from(careers).where(eq(careers.id, fw));
    expect(stored).toMatchObject({ peak: 80, peakProfile: null, legendScore: 300 });
  });

  it('원본 능력치가 추정치보다 우선하고 모양이 잘못된 추정치는 표시하지 않는다', async () => {
    const me = await issueGoogleCookie(ctx);
    const roles = { GK: 22, CB: 83, FB: 79, DM: 74, CM: 66, AM: 58, W: 55, ST: 52 };
    const original = await addCareer(me.profileId, { peak: 90, roles });
    const invalid = await addCareer(me.profileId, { peak: 80 });
    const estimate = JSON.stringify({
      v: 1,
      source: 'estimated',
      attrs: { pac: 99, sho: 99, pas: 99, dri: 99, def: 99, phy: 99 },
    });
    await ctx.db.update(careers).set({ cardAttrsJson: estimate }).where(eq(careers.id, original));
    // T-11-080 카드 기준가는 cards에서 붙인다(카드가 없거나 소급 전이면 null).
    await ctx.db.insert(cards).values({
      careerId: original,
      ownerId: me.profileId,
      serviceSeason: 0,
      pos: 'FW',
      peak: 90,
      legendScore: 300,
      cardValue: 123_000,
      retireValue: 456_000,
      createdAt: '2026-09-28T00:00:00.000Z',
      updatedAt: '2026-09-28T00:00:00.000Z',
    });
    await ctx.db
      .update(careers)
      .set({ cardAttrsJson: JSON.stringify({ v: 1, source: 'estimated', attrs: { pac: 120 } }) })
      .where(eq(careers.id, invalid));
    const data = GetRes.parse(
      await (await call('GET', '/v1/owner-team', { cookie: me.cookie })).json(),
    ).data;
    expect(data.players.find((p) => p.careerId === original)).toMatchObject({
      cardValue: 123_000,
      attrsEstimated: false,
      roles,
      attrs: { pac: 80, sho: 70 },
    });
    expect(data.players.find((p) => p.careerId === invalid)).toMatchObject({
      cardValue: null,
      attrsEstimated: false,
      attrs: null,
      roles: null,
    });
  });

  it('T-10-092 최고 시점 능력치가 있으면 자리마다 그 자리 실력으로 뛰고, 팀 줄 힘을 돌려준다', async () => {
    const me = await issueGoogleCookie(ctx);
    const roles = { GK: 22, CB: 83, FB: 79, DM: 74, CM: 66, AM: 58, W: 55, ST: 52 };
    const cb = await addCareer(me.profileId, { pos: 'DF', dpos: 'CB', peak: 82, roles });
    const data = GetRes.parse(
      await (await call('GET', '/v1/owner-team', { cookie: me.cookie })).json(),
    ).data;
    expect(data.players[0]).toMatchObject({ careerId: cb, roles, nation: 'KR' });
    // 4-3-3: 1번 칸 FB, 2번 칸 CB, 5번 칸 DM.
    const res = await putTeam(me.cookie, { slots: slots(null, cb) });
    const team = PutRes.parse(await res.json()).data.team;
    expect(team.slots[1]).toMatchObject({ slot: 'FB', rating: 79, fit: 0.96, nation: 'KR' });
    const moved = PutRes.parse(
      await (await putTeam(me.cookie, { slots: slots(null, null, cb) })).json(),
    ).data.team;
    expect(moved.slots[2]).toMatchObject({ slot: 'CB', rating: 82, fit: 1 });
    expect(moved.lines.def).toBeGreaterThan(moved.lines.atk);
    expect(moved.lines.gk).toBe(YOUTH_OVR);
  });

  it('자유 배치와 로고를 저장하고 공개 프로필·경기에 같은 자리 실력을 쓴다', async () => {
    const me = await issueGoogleCookie(ctx);
    const roles = { GK: 22, CB: 83, FB: 79, DM: 74, CM: 66, AM: 58, W: 55, ST: 52 };
    const cb = await addCareer(me.profileId, {
      pos: 'DF',
      dpos: 'CB',
      peak: 82,
      roles,
      nation: 'BR',
    });
    const layout = presetLayout('4-3-3');
    layout[2] = { x: 50, y: 60, slot: 'DM' };
    const logo = { shape: 'r', pattern: 'sash', text: 'FC', bg: '#174386', fg: '#ffffff' };
    const ids = slots(null, null, cb);
    const res = await putTeam(me.cookie, { slots: ids, layout, logo });
    expect(res.status).toBe(200);
    const team = PutRes.parse(await res.json()).data.team;
    expect(team).toMatchObject({ layout, logo });
    expect(team.slots[2]).toMatchObject({ slot: 'DM', rating: 74, nation: 'BR' });
    expect(team.slots[0]?.nation).toBeNull();
    const mine = GetRes.parse(
      await (await call('GET', '/v1/owner-team', { cookie: me.cookie })).json(),
    ).data;
    expect(mine.players.find((p) => p.careerId === cb)?.nation).toBe('BR');
    expect(mine.team?.slots[2]?.nation).toBe('BR');
    const profile = successEnvelope(TeamProfileResponseSchema).parse(
      await (await call('GET', `/v1/teams/${team.id}`)).json(),
    ).data.team;
    expect(profile).toMatchObject({ layout, logo });
    expect(profile.slots[2]).toMatchObject({ slot: 'DM', rating: 74, nation: 'BR' });
    const rival = await ownerWithTeam(1);
    const rivalLogo = { ...logo, text: 'RV', bg: '#a52e37' };
    await ctx.db
      .update(ownerTeams)
      .set({ logoJson: JSON.stringify(rivalLogo) })
      .where(eq(ownerTeams.id, rival.team.id));
    const ranking = successEnvelope(TeamRankResponseSchema).parse(
      await (await call('GET', '/v1/teams')).json(),
    ).data.items;
    expect(ranking.find((t) => t.teamId === team.id)?.logo).toEqual(logo);
    const opponents = OppRes.parse(
      await (await call('GET', '/v1/owner-team/opponents', { cookie: me.cookie })).json(),
    ).data.items;
    expect(opponents.find((t) => t.teamId === rival.team.id)?.logo).toEqual(rivalLogo);
    await rebuildStaleAchievements(ctx.db, new Date().toISOString());
    const achievements = AchRankRes.parse(
      await (await call('GET', '/v1/achievements/ranking')).json(),
    ).data.items;
    expect(achievements.find((r) => r.team?.id === team.id)?.team?.logo).toEqual(logo);
    const match = PlayRes.parse(
      await (
        await call('POST', '/v1/owner-team/matches', {
          cookie: me.cookie,
          headers: idem(),
          body: { opponentTeamId: rival.team.id },
        })
      ).json(),
    ).data.match;
    expect(match.home.ovr).toBe(team.ovr);
    expect(match.home.logo).toEqual(logo);
    expect(match.away.logo).toEqual(rivalLogo);
    // 로고를 저장하지 않았던 옛 경기에도 현재 로고를 붙인다. 경기 원본은 덮어쓰지 않는다.
    const [storedBefore] = await ctx.db
      .select()
      .from(teamMatches)
      .where(eq(teamMatches.id, match.id));
    expect(JSON.parse(storedBefore!.detailJson).home).not.toHaveProperty('logo');
    const nextLogo = { ...logo, text: 'NEW' };
    await ctx.db
      .update(ownerTeams)
      .set({ logoJson: JSON.stringify(nextLogo) })
      .where(eq(ownerTeams.id, team.id));
    const history = MatchesRes.parse(
      await (await call('GET', '/v1/owner-team/matches', { cookie: me.cookie })).json(),
    ).data.items;
    expect(history[0]!.home.logo).toEqual(nextLogo);
    expect(history[0]!.away.logo).toEqual(rivalLogo);
    const [storedAfter] = await ctx.db
      .select()
      .from(teamMatches)
      .where(eq(teamMatches.id, match.id));
    expect(storedAfter!.detailJson).toBe(storedBefore!.detailJson);
    await ctx.db
      .update(ownerTeams)
      .set({ logoJson: JSON.stringify(logo) })
      .where(eq(ownerTeams.id, team.id));
    // 옛 앱이 새 필드를 생략해도 저장된 값은 보존한다.
    const legacy = PutRes.parse(await (await putTeam(me.cookie, { slots: ids })).json()).data.team;
    expect(legacy).toMatchObject({ layout, logo });
    // 명시적 null은 기본 배치/로고로 되돌린다.
    const reset = PutRes.parse(
      await (await putTeam(me.cookie, { slots: ids, layout: null, logo: null })).json(),
    ).data.team;
    expect(reset).toMatchObject({ layout: null, logo: null });
    expect(reset.slots[2]).toMatchObject({ slot: 'CB', rating: 82 });
  });

  it('유효하지 않은 좌표·자리 및 큰 이미지 로고는 저장하지 않는다', async () => {
    const me = await issueGoogleCookie(ctx);
    for (const point of [
      { x: 50, y: 95, slot: 'GK' },
      { x: 50, y: 30, slot: 'GK' },
      { x: 50, y: 60, slot: 'CB' },
    ]) {
      const layout = presetLayout('4-3-3');
      layout[point.slot === 'GK' ? 0 : 2] = point as (typeof layout)[number];
      expect((await putTeam(me.cookie, { slots: slots(), layout })).status).toBe(400);
    }
    const logo = {
      shape: 's',
      pattern: 'plain',
      text: 'FC',
      bg: '#1c4a35',
      fg: '#f0b437',
      img: `data:image/webp;base64,${'A'.repeat(16000)}`,
    };
    expect((await putTeam(me.cookie, { slots: slots(), logo })).status).toBe(400);
    expect(await ctx.db.select().from(ownerTeams)).toHaveLength(0);
  });

  it.each([
    { label: '기본 배치', free: false, cb: 99, dm: 70, youth: false, done: true, fit: 1 },
    { label: '자유배치 미달성 회귀', free: true, cb: 70, dm: 99, youth: false, done: true, fit: 1 },
    {
      label: '자유배치 잘못된 달성 회귀',
      free: true,
      cb: 99,
      dm: 70,
      youth: false,
      done: false,
      fit: 0.71,
    },
    {
      label: '1.00 바로 아래 경계',
      free: true,
      cb: 99,
      dm: 98,
      youth: false,
      done: false,
      fit: 0.99,
    },
    { label: '유스 적합도 1 제외', free: true, cb: 70, dm: 99, youth: true, done: false, fit: 1 },
  ])('$label: 실제 팀 자리와 업적의 적합도 판정을 일치시킨다', async (scenario) => {
    const me = await issueGoogleCookie(ctx);
    const group = {
      GK: 'GK',
      FB: 'DF',
      CB: 'DF',
      DM: 'MF',
      CM: 'MF',
      AM: 'MF',
      W: 'FW',
      ST: 'FW',
    } as const;
    const ids: (string | null)[] = [];
    for (const [i, role] of FORMATIONS['4-3-3'].entries()) {
      const roles = { GK: 70, CB: 70, FB: 70, DM: 70, CM: 70, AM: 70, W: 70, ST: 70, [role]: 99 };
      if (i === 2) Object.assign(roles, { CB: scenario.cb, DM: scenario.dm });
      ids.push(await addCareer(me.profileId, { pos: group[role], peak: 99, roles }));
    }
    if (scenario.youth) ids[10] = null;
    const layout = presetLayout('4-3-3');
    layout[2] = { x: 50, y: 60, slot: 'DM' };
    const res = await putTeam(me.cookie, { slots: ids, ...(scenario.free ? { layout } : {}) });
    expect(res.status).toBe(200);
    const saved = PutRes.parse(await res.json()).data.team;
    expect(saved.slots[2]?.fit).toBe(scenario.fit);
    const shown = GetRes.parse(
      await (await call('GET', '/v1/owner-team', { cookie: me.cookie })).json(),
    ).data.team!;
    expect(shown.slots.map((s) => s.fit)).toEqual(saved.slots.map((s) => s.fit));
    const ach = AchRes.parse(
      await (await call('GET', '/v1/owner-team/achievements', { cookie: me.cookie })).json(),
    ).data;
    expect(ach.groups.flatMap((g) => g.items).find((i) => i.id === 'team-fit')?.done).toBe(
      scenario.done,
    );
    expect(shown.slots.every((s) => s.careerId !== null && s.fit >= 1)).toBe(scenario.done);
  });

  it('구단 시즌 업적은 그 시즌에 처음 올라온 내 은퇴 선수와 그 시즌 팀으로 판정한다', async () => {
    const me = await issueGoogleCookie(ctx);
    await addCareer(me.profileId, { pos: 'GK', peak: 70 });
    const s1 = await addCareer(me.profileId, { pos: 'DF', dpos: 'CB', peak: 80, serviceSeason: 1 });
    await addCareer(me.profileId, { status: 'active' });
    const read = async (q = '') => {
      const res = await call('GET', `/v1/owner-team/achievements${q}`, { cookie: me.cookie });
      return { status: res.status, body: await res.json() };
    };
    const item = (d: { groups: { items: { id: string; done: boolean }[] }[] }, id: string) =>
      d.groups.flatMap((g) => g.items).find((i) => i.id === id);

    const pre = AchRes.parse((await read()).body).data;
    expect(pre).toMatchObject({ season: 0, players: 1, seasons: [{ id: 0 }] });
    expect(item(pre, 'retire-GK')?.done).toBe(true);
    expect(item(pre, 'retire-DF')?.done).toBe(false);
    expect(item(pre, 'all-dpos')).toBeUndefined();
    // 지금 시즌(프리시즌) — 팀이 없어도 팀 업적 목록은 보인다. T-11-028 선수 → 팀 → 구단주 → 감독(잠금) 순.
    expect(pre.groups.map((g) => g.id).slice(6)).toEqual(['team', 'race', 'owner', 'manager']);
    // T-11-026 3~5단계가 열렸다 — 잠긴 단계 없이 시즌 요약(국적·은퇴 나이·시즌 골)까지 읽어 판정한다.
    expect(pre.groups.filter((g) => g.locked).map((g) => g.id)).toEqual(['manager']);
    // T-11-028 점수(첫 골키퍼 은퇴 10점)와 업적 랭킹 순위.
    expect(pre).toMatchObject({ score: 10, rank: 1, ranked: 1 });
    expect(pre.groups.map((g) => g.stage).slice(3, 6)).toEqual(['3단계', '4단계', '5단계']);
    expect(item(pre, 'one-club')?.done).toBe(false);
    expect(item(pre, 'age-40')).toMatchObject({ label: '40세까지 현역', done: false });
    expect((await read('?season=1')).status).toBe(400); // 아직 열리지 않은 시즌

    vi.setSystemTime(new Date('2026-10-10T00:00:00.000Z')); // 시즌 1
    await putTeam(me.cookie, { slots: slots(null, null, s1) });
    const cur = AchRes.parse((await read()).body).data;
    expect(cur).toMatchObject({ season: 1, players: 1 });
    expect(cur.seasons.map((x) => x.id)).toEqual([0, 1]);
    expect(item(cur, 'retire-DF')?.done).toBe(true);
    expect(item(cur, 'all-dpos')).toMatchObject({ cur: 1, max: 8 });
    expect(item(cur, 'team-one')?.done).toBe(true);
    // T-11-046 시즌 1 선수는 45세에 은퇴하므로 은퇴 직전까지 현역도 44세다.
    expect(item(cur, 'age-40')).toMatchObject({ label: '44세까지 현역', done: false });
    const past = AchRes.parse((await read('?season=0')).body).data;
    expect(past).toMatchObject({ season: 0, players: 1 });
    expect(past.groups.some((g) => g.id === 'team')).toBe(false); // 프리시즌에는 팀을 만들지 않았다
  });

  it('T-11-028 업적 랭킹: 시즌 점수 순, 닉네임과 그 시즌 팀 이름만 보인다', async () => {
    const a = await issueGoogleCookie(ctx);
    const b = await issueGoogleCookie(ctx);
    await addCareer(a.profileId, { pos: 'GK', peak: 70 });
    await addCareer(b.profileId, { pos: 'GK', peak: 70 });
    await addCareer(b.profileId, { pos: 'FW', peak: 70 });
    const st = await addCareer(b.profileId, { pos: 'DF', peak: 70 });
    await putTeam(b.cookie, { slots: slots(null, st) });
    // 점수는 업적 화면을 열 때(그리고 은퇴·팀 저장·경기 응답 뒤) 다시 센다.
    for (const who of [a, b])
      await call('GET', '/v1/owner-team/achievements', { cookie: who.cookie });

    const res = await call('GET', '/v1/achievements/ranking');
    expect(res.status).toBe(200);
    const body = AchRankRes.parse(await res.json()).data;
    expect(body).toMatchObject({ season: 0, page: 1, total: 2 });
    expect(body.items.map((i) => i.rank)).toEqual([1, 2]);
    expect(body.items[0]).toMatchObject({ players: 3, team: { name: expect.any(String) } });
    expect(body.items[0]!.score).toBeGreaterThan(body.items[1]!.score);
    expect(body.items[1]).toMatchObject({ players: 1, team: null, score: 10 });
    expect(JSON.stringify(body)).not.toContain(b.profileId);
  });

  it('T-11-028 매일 cron은 점수보다 새 은퇴·팀 기록이 있는 구단주만 다시 센다', async () => {
    const a = await issueGoogleCookie(ctx);
    const anon = await issueCookie(ctx);
    await addCareer(a.profileId, { pos: 'GK', peak: 70 });
    await addCareer(anon.profileId, { pos: 'GK', peak: 70 }); // 로그인하지 않은 프로필은 구단주가 아니다
    const db = ctx.db;
    const now = new Date().toISOString();
    expect(await rebuildStaleAchievements(db, now)).toEqual({ season: 0, refreshed: 1 });
    expect(await rebuildStaleAchievements(db, now)).toEqual({ season: 0, refreshed: 0 });
    vi.setSystemTime(new Date('2026-09-30T01:00:00.000Z'));
    const fw = await addCareer(a.profileId, { pos: 'FW', peak: 70 });
    await ctx.db
      .update(careers)
      .set({ retiredAt: new Date().toISOString() })
      .where(eq(careers.id, fw));
    expect(await rebuildStaleAchievements(db, new Date().toISOString())).toEqual({
      season: 0,
      refreshed: 1,
    });
    const body = AchRankRes.parse(
      await (await call('GET', '/v1/achievements/ranking')).json(),
    ).data;
    expect(body.items).toMatchObject([{ rank: 1, score: 20, players: 2 }]);
  });

  it('팀을 만들고 고친다 — 빈 자리는 유스 선수, 시즌마다 한 팀', async () => {
    const me = await issueGoogleCookie(ctx);
    const st = await addCareer(me.profileId, { peak: 90 });
    const gk = await addCareer(me.profileId, { pos: 'GK', peak: 80 });
    const created = await putTeam(me.cookie, {
      name: '  우리 FC  ',
      slots: slots(gk, ...Array(8).fill(null), st),
    });
    expect(created.status).toBe(200);
    const team = PutRes.parse(await created.json()).data.team;
    expect(team.name).toBe('우리 FC');
    expect(team.slots[0]).toMatchObject({ slot: 'GK', careerId: gk, rating: 76, fit: 0.95 });
    expect(team.slots[9]).toMatchObject({
      slot: 'ST',
      careerId: st,
      rating: 86,
      name: '익명의 공격수 No.9',
    });
    expect(team.slots[1]).toMatchObject({ careerId: null, name: '유스 선수', rating: YOUTH_OVR });
    expect(team.ovr).toBe(Math.round((76 + 86 + 9 * YOUTH_OVR) / 11));
    expect(team.record).toEqual({ w: 0, d: 0, l: 0 });

    // 같은 시즌에 다시 저장하면 같은 팀이 바뀐다(시즌마다 한 팀 — 포메이션·자리·감독).
    const updated = await putTeam(me.cookie, {
      formation: '3-5-2',
      manager: '박감독',
      slots: slots(null, null, null, null, null, null, null, null, null, st),
    });
    expect(updated.status).toBe(200);
    const after = PutRes.parse(await updated.json()).data.team;
    expect(after).toMatchObject({ id: team.id, formation: '3-5-2', manager: '박감독', season: 0 });
    const got = GetRes.parse(
      await (await call('GET', '/v1/owner-team', { cookie: me.cookie })).json(),
    );
    expect(got.data.team!.id).toBe(team.id);
    expect(got.data.team!.slots[9]!.careerId).toBe(st);
    expect(got.data.team!.slots[0]!.careerId).toBeNull();
    expect(got.data.lastManager).toBe('박감독');
    expect(await ctx.db.select().from(ownerTeams)).toHaveLength(1);
  });

  it('시즌마다 새 팀 — 그 시즌에 처음 올라온 선수만 넣고, 지난 시즌 팀은 그대로 남는다', async () => {
    const me = await issueGoogleCookie(ctx);
    const pre = await addCareer(me.profileId, { peak: 90 });
    const s1 = await addCareer(me.profileId, { peak: 85, serviceSeason: 1 });
    // 프리시즌에는 시즌 1 선수를 넣을 수 없다.
    const early = await putTeam(me.cookie, { slots: slots(s1) });
    expect(ErrorEnvelopeSchema.parse(await early.json()).error.details).toEqual({
      reason: 'PLAYER_NOT_ELIGIBLE',
    });
    const preTeam = PutRes.parse(
      await (await putTeam(me.cookie, { name: '프리 FC', slots: slots(pre) })).json(),
    ).data.team;
    const rival = await ownerWithTeam(1);

    vi.setSystemTime(new Date('2026-10-10T00:00:00.000Z')); // 시즌 1
    const fresh = GetRes.parse(
      await (await call('GET', '/v1/owner-team', { cookie: me.cookie })).json(),
    ).data;
    expect(fresh).toMatchObject({ season: 1, current: 1, team: null, lastManager: '김감독' });
    expect(fresh.seasons.map((x) => x.id)).toEqual([0, 1]);
    expect(fresh.players.map((p) => p.careerId)).toEqual([s1]);
    // 지난 시즌 팀으로는 경기할 수 없다(이번 시즌 팀이 없다).
    const noTeam = await call('POST', '/v1/owner-team/matches', {
      cookie: me.cookie,
      headers: idem(),
      body: { opponentTeamId: rival.team.id },
    });
    expect(noTeam.status).toBe(409);
    expect((await putTeam(me.cookie, { slots: slots(pre) })).status).toBe(400);
    const s1Team = PutRes.parse(
      await (await putTeam(me.cookie, { name: '시즌 FC', slots: slots(s1) })).json(),
    ).data.team;
    expect(s1Team).toMatchObject({ season: 1, name: '시즌 FC' });
    expect(s1Team.id).not.toBe(preTeam.id);
    // 프리시즌 팀은 상대가 될 수 없다.
    const vsOld = await call('POST', '/v1/owner-team/matches', {
      cookie: me.cookie,
      headers: idem(),
      body: { opponentTeamId: rival.team.id },
    });
    expect(vsOld.status).toBe(404);
    const past = GetRes.parse(
      await (await call('GET', '/v1/owner-team?season=0', { cookie: me.cookie })).json(),
    ).data;
    expect(past).toMatchObject({ season: 0, current: 1 });
    expect(past.team).toMatchObject({ id: preTeam.id, name: '프리 FC' });
    expect(past.team!.slots[0]!.careerId).toBe(pre);
    expect((await call('GET', '/v1/owner-team?season=2', { cookie: me.cookie })).status).toBe(400);
  });

  it('남의 선수·뛰는 중인 선수·같은 선수 두 번·욕설 이름은 거절한다', async () => {
    const me = await issueGoogleCookie(ctx);
    const mine = await addCareer(me.profileId);
    const active = await addCareer(me.profileId, { status: 'active' });
    const other = await issueGoogleCookie(ctx);
    const theirs = await addCareer(other.profileId);
    const reason = async (res: Response) => {
      expect(res.status).toBeGreaterThanOrEqual(400);
      return (ErrorEnvelopeSchema.parse(await res.json()).error.details as { reason?: string })
        ?.reason;
    };
    expect(await reason(await putTeam(me.cookie, { slots: slots(theirs) }))).toBe(
      'PLAYER_NOT_ELIGIBLE',
    );
    expect(await reason(await putTeam(me.cookie, { slots: slots(active) }))).toBe(
      'PLAYER_NOT_ELIGIBLE',
    );
    expect(await reason(await putTeam(me.cookie, { slots: slots(mine, mine) }))).toBe(
      'DUPLICATE_PLAYER',
    );
    expect(await reason(await putTeam(me.cookie, { name: '시발 FC', slots: slots() }))).toBe(
      'BLOCKED_WORD',
    );
    expect(await reason(await putTeam(me.cookie, { name: '운영자 FC', slots: slots() }))).toBe(
      'RESERVED_NAME',
    );
    expect(await reason(await putTeam(me.cookie, { manager: '시발감독', slots: slots() }))).toBe(
      'BLOCKED_WORD',
    );
    const short = await putTeam(me.cookie, { name: '가', slots: slots() });
    expect(short.status).toBe(400);
    const rows = await ctx.db.select().from(ownerTeams);
    expect(rows).toEqual([]);
  });

  it('상대 목록은 선수가 있는 다른 구단주의 팀만(내 팀·빈 팀·익명 전환한 구단주 제외)', async () => {
    const me = await ownerWithTeam(3);
    const rival = await ownerWithTeam(2, 75, '라이벌 에이스');
    const empty = await issueGoogleCookie(ctx);
    expect((await putTeam(empty.cookie, { slots: slots() })).status).toBe(200);
    const res = await call('GET', '/v1/owner-team/opponents', { cookie: me.cookie });
    expect(res.status).toBe(200);
    const items = OppRes.parse(await res.json()).data.items;
    expect(items.map((i) => i.teamId)).toEqual([rival.team.id]);
    expect(items[0]).toMatchObject({ owner: '김감독', rating: 1000, record: { w: 0, d: 0, l: 0 } });

    // 팀이 없으면 409 TEAM_REQUIRED.
    const noTeam = await issueGoogleCookie(ctx);
    const r = await call('GET', '/v1/owner-team/opponents', { cookie: noTeam.cookie });
    expect(r.status).toBe(409);
  });

  it('경기를 치르면 결과·전적이 남고, 상대 쪽 최근 경기에도 보인다', async () => {
    const me = await ownerWithTeam(5, 85);
    const rival = await ownerWithTeam(3, 70, '라이벌 에이스');
    const res = await call('POST', '/v1/owner-team/matches', {
      cookie: me.cookie,
      headers: idem(),
      body: { opponentTeamId: rival.team.id },
    });
    expect(res.status).toBe(201);
    const { match, record, rating, matchesLeft } = PlayRes.parse(await res.json()).data;
    expect(matchesLeft).toBe(TEAM_MATCHES_PER_DAY - 1);
    expect(match.home.teamId).toBe(me.team.id);
    expect(match.away).toMatchObject({ teamId: rival.team.id, name: rival.team.name });
    expect(match.mine).toBe('home');
    expect(match.events).toHaveLength(match.home.goals + match.away.goals);
    const won = match.home.goals > match.away.goals;
    const drew = match.home.goals === match.away.goals;
    expect(record).toEqual({ w: won ? 1 : 0, d: drew ? 1 : 0, l: !won && !drew ? 1 : 0 });
    // 상대 득점자 이름은 공개 이름이거나 익명·유스 표기다(비공개 이름은 서버에 없다).
    for (const e of match.events.filter((x) => x.side === 'away')) {
      expect(e.scorer).toMatch(/^(라이벌 에이스|유스 선수|익명의 .+)$/);
      // 상대 선수의 커리어 id는 내보내지 않는다.
      expect([e.scorerId, e.assistId]).toEqual([null, null]);
    }
    for (const e of match.events.filter((x) => x.side === 'home' && x.scorer !== '유스 선수'))
      expect(me.ids).toContain(e.scorerId);

    const [homeRow] = await ctx.db.select().from(ownerTeams).where(eq(ownerTeams.id, me.team.id));
    const [awayRow] = await ctx.db
      .select()
      .from(ownerTeams)
      .where(eq(ownerTeams.id, rival.team.id));
    expect(homeRow!.wins + homeRow!.draws + homeRow!.losses).toBe(1);
    expect(awayRow!.wins).toBe(homeRow!.losses);
    expect(awayRow!.losses).toBe(homeRow!.wins);
    // 레이팅은 홈 이점을 넣은 엘로만큼 옮겨 가고(두 팀 합은 그대로, T-10-095), 득실·연승·골 차가 쌓인다.
    const want = ratingChange(1000, 1000, matchScore(match.home.goals, match.away.goals));
    // JSON 응답은 -0을 0으로 직렬화하므로 기대값도 같은 표현으로 비교한다.
    expect([match.home.ratingChange, match.away.ratingChange]).toEqual([
      want.home + 0,
      want.away + 0,
    ]);
    expect(homeRow!.rating).toBe(rating);
    expect([homeRow!.rating, awayRow!.rating]).toEqual([1000 + want.home, 1000 + want.away]);
    expect(homeRow!.rating + awayRow!.rating).toBe(2000);
    expect([homeRow!.goalsFor, homeRow!.goalsAgainst]).toEqual([
      match.home.goals,
      match.away.goals,
    ]);
    expect([awayRow!.goalsFor, awayRow!.goalsAgainst]).toEqual([
      match.away.goals,
      match.home.goals,
    ]);
    expect(homeRow!.streak).toBe(won ? 1 : 0);
    expect(homeRow!.bestMargin).toBe(Math.max(0, match.home.goals - match.away.goals));

    const theirs = MatchesRes.parse(
      await (await call('GET', '/v1/owner-team/matches', { cookie: rival.cookie })).json(),
    ).data.items;
    expect(theirs).toHaveLength(1);
    expect(theirs[0]).toMatchObject({ id: match.id, mine: 'away' });
    expect(theirs[0]!.events.map((e) => [e.minute, e.side, e.scorer, e.assist])).toEqual(
      match.events.map((e) => [e.minute, e.side, e.scorer, e.assist]),
    );
    const mineList = MatchesRes.parse(
      await (await call('GET', '/v1/owner-team/matches', { cookie: me.cookie })).json(),
    ).data.items;
    expect(mineList.map((m) => m.mine)).toEqual(['home']);
  });

  it('같은 멱등 키로 다시 보내면 경기를 한 번만 치른다', async () => {
    const me = await ownerWithTeam(1);
    const rival = await ownerWithTeam(1);
    const headers = idem();
    const body = { opponentTeamId: rival.team.id };
    const a = await call('POST', '/v1/owner-team/matches', { cookie: me.cookie, headers, body });
    const b = await call('POST', '/v1/owner-team/matches', { cookie: me.cookie, headers, body });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.headers.get('Idempotent-Replayed')).toBe('true');
    expect(await ctx.db.select().from(teamMatches)).toHaveLength(1);
  });

  it('내 팀·빈 팀·없는 팀은 상대가 될 수 없고, 내 팀에 선수가 없으면 경기할 수 없다', async () => {
    const me = await ownerWithTeam(1);
    const play = (cookie: string, opponentTeamId: string) =>
      call('POST', '/v1/owner-team/matches', { cookie, headers: idem(), body: { opponentTeamId } });
    expect((await play(me.cookie, me.team.id)).status).toBe(404);
    expect((await play(me.cookie, `tem_${crypto.randomUUID()}`)).status).toBe(404);
    const empty = await issueGoogleCookie(ctx);
    const emptyTeam = PutRes.parse(await (await putTeam(empty.cookie, { slots: slots() })).json())
      .data.team;
    expect((await play(me.cookie, emptyTeam.id)).status).toBe(404);
    const res = await play(empty.cookie, me.team.id);
    expect(res.status).toBe(409);
    expect(ErrorEnvelopeSchema.parse(await res.json()).error.details).toEqual({
      reason: 'TEAM_EMPTY',
    });
  });

  it('한국 시각 하루 경기 수를 넘으면 429 TEAM_MATCH_DAILY_LIMIT', async () => {
    const me = await ownerWithTeam(1);
    const rival = await ownerWithTeam(1);
    // 오늘 이미 치른 경기를 채워 둔다(어제 경기는 세지 않는다).
    const now = Date.now();
    const rows = Array.from({ length: TEAM_MATCHES_PER_DAY }, (_, i) => ({
      id: `mat_seed-${i}`,
      profileId: me.profileId,
      homeTeamId: me.team.id,
      awayTeamId: rival.team.id,
      homeGoals: 0,
      awayGoals: 0,
      detailJson: '{"home":{},"away":{},"events":[]}',
      createdAt: new Date(now - i).toISOString(),
    }));
    await ctx.db.insert(teamMatches).values(rows);
    await ctx.db.insert(teamMatches).values({
      ...rows[0]!,
      id: 'mat_yesterday',
      createdAt: new Date(now - 2 * 86_400_000).toISOString(),
    });
    const left = GetRes.parse(
      await (await call('GET', '/v1/owner-team', { cookie: me.cookie })).json(),
    ).data.matchesLeft;
    expect(left).toBe(0);
    const res = await call('POST', '/v1/owner-team/matches', {
      cookie: me.cookie,
      headers: idem(),
      body: { opponentTeamId: rival.team.id },
    });
    expect(res.status).toBe(429);
    const err = ErrorEnvelopeSchema.parse(await res.json()).error;
    expect(err).toMatchObject({ code: 'RATE_LIMITED', retryable: true });
    expect(err.details).toEqual({ reason: 'TEAM_MATCH_DAILY_LIMIT' });
  });

  it('T-10-095 같은 상대에게는 하루 한 번만 걸고, 다음 날 다시 만나면 레이팅 변화가 줄어든다', async () => {
    const me = await ownerWithTeam(1);
    const rival = await ownerWithTeam(1);
    const other = await ownerWithTeam(1);
    const play = (cookie: string, opponentTeamId: string) =>
      call('POST', '/v1/owner-team/matches', { cookie, headers: idem(), body: { opponentTeamId } });
    const opponents = async (cookie: string) =>
      OppRes.parse(await (await call('GET', '/v1/owner-team/opponents', { cookie })).json())
        .data.items.map((i) => i.teamId)
        .sort();

    expect((await play(me.cookie, rival.team.id)).status).toBe(201);
    // 오늘 건 상대는 후보에서 빠지고, 다시 걸면 429.
    expect(await opponents(me.cookie)).toEqual([other.team.id]);
    const again = await play(me.cookie, rival.team.id);
    expect(again.status).toBe(429);
    expect(ErrorEnvelopeSchema.parse(await again.json()).error.details).toEqual({
      reason: 'TEAM_OPPONENT_DAILY_LIMIT',
    });
    // 받은 쪽은 되갚을 수 있다(받은 경기는 세지 않는다).
    expect((await play(rival.cookie, me.team.id)).status).toBe(201);

    // 다음 날(한국 시각 자정 뒤) 다시 걸 수 있지만, 최근 7일 안에 두 번 만났으니 ×0.25.
    vi.setSystemTime(new Date('2026-10-01T00:00:00.000Z'));
    expect(await opponents(me.cookie)).toEqual([rival.team.id, other.team.id].sort());
    const rivalRating = async () =>
      (await ctx.db.select().from(ownerTeams).where(eq(ownerTeams.id, rival.team.id)))[0]!.rating;
    const [mineBefore] = await ctx.db
      .select()
      .from(ownerTeams)
      .where(eq(ownerTeams.id, me.team.id));
    const rivalBefore = await rivalRating();
    const res = await play(me.cookie, rival.team.id);
    expect(res.status).toBe(201);
    const { match } = PlayRes.parse(await res.json()).data;
    const score = matchScore(match.home.goals, match.away.goals);
    const want = ratingChange(mineBefore!.rating, rivalBefore, score, 2);
    // JSON 응답은 -0을 0으로 직렬화하므로 기대값도 같은 표현으로 비교한다.
    expect([match.home.ratingChange, match.away.ratingChange]).toEqual([
      want.home + 0,
      want.away + 0,
    ]);
    expect(await rivalRating()).toBe(rivalBefore + want.away);
  });

  it('프로필을 지우면 팀과 그 팀의 경기도 지워진다', async () => {
    const me = await ownerWithTeam(1);
    const rival = await ownerWithTeam(1);
    const res = await call('POST', '/v1/owner-team/matches', {
      cookie: me.cookie,
      headers: idem(),
      body: { opponentTeamId: rival.team.id },
    });
    expect(res.status).toBe(201);
    expect((await deleteProfile(ctx.env, me.cookie, 'team-del')).status).toBe(204);
    expect((await ctx.db.select().from(ownerTeams)).map((t) => t.id)).toEqual([rival.team.id]);
    expect(await ctx.db.select().from(teamMatches)).toEqual([]);
  });
});
