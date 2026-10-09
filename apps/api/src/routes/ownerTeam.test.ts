import {
  AchRankResponseSchema,
  FriendRemoveResponseSchema,
  FriendRequestResponseSchema,
  FriendsResponseSchema,
  PlayFriendlyResponseSchema,
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
  FRIENDLY_MATCHES_PER_DAY,
  TEAM_MATCHES_PER_DAY,
  YOUTH_OVR,
  matchScore,
  ratingChange,
  presetLayout,
  FORMATIONS,
} from '@offside/contracts/owner-team';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  boardBlocks,
  cards,
  careerSeasons,
  careers,
  friendMatches,
  notifications,
  pushDeliveries,
  friends,
  ownerTeams,
  teamMatches,
} from '../db/schema.js';
import { rebuildStaleAchievements } from '../team/ownerAchievements.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, deleteProfile, issueCookie, issueGoogleCookie } from '../test/http.js';
import { addAppPushDevice } from '../test/push.js';
import { runPersonalPush } from '../push/personal.js';

const GetRes = successEnvelope(OwnerTeamResponseSchema);
const PutRes = successEnvelope(PutOwnerTeamResponseSchema);
const OppRes = successEnvelope(TeamOpponentsResponseSchema);
const PlayRes = successEnvelope(PlayTeamMatchResponseSchema);
const MatchesRes = successEnvelope(TeamMatchesResponseSchema);
const AchRes = successEnvelope(ClubAchievementsResponseSchema);
const AchRankRes = successEnvelope(AchRankResponseSchema);
const FriendsRes = successEnvelope(FriendsResponseSchema);
const FriendReqRes = successEnvelope(FriendRequestResponseSchema);
const FriendDelRes = successEnvelope(FriendRemoveResponseSchema);
const FriendlyRes = successEnvelope(PlayFriendlyResponseSchema);
const TeamProfileRes = successEnvelope(TeamProfileResponseSchema);

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
    // T-11-080 팀에 넣을 수 있는 건 카드다(은퇴 업로드가 만든다).
    if (retired)
      await ctx.db.insert(cards).values({
        careerId: id,
        ownerId: profileId,
        serviceSeason: over.serviceSeason ?? 0,
        pos: over.pos ?? 'FW',
        dpos: over.dpos ?? null,
        nation: over.nation ?? null,
        number: 9,
        peak: over.peak ?? 80,
        legendScore: 300,
        peakProfile: over.roles
          ? JSON.stringify({
              attrs: { pac: 80, sho: 70, pas: 70, dri: 75, def: 60, phy: 70 },
              roles: over.roles,
            })
          : null,
        retireValue: 0,
        createdAt: now,
        updatedAt: now,
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
  async function ownerWithTeam(
    n: number,
    peak = 80,
    publicName: string | null = null,
    serviceSeason = 0,
  ) {
    const who = await issueGoogleCookie(ctx, { nickname: `구단주${++seq}` });
    const ids: string[] = [];
    for (let i = 0; i < n; i++)
      ids.push(await addCareer(who.profileId, { peak, publicName, serviceSeason }));
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
    // T-11-080 카드 기준가는 cards에서 붙인다(소급 전이면 null).
    await ctx.db.update(cards).set({ cardValue: 123_000 }).where(eq(cards.careerId, original));
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
    // T-11-165 선발 선수 카드(확대 카드용). 구단주만의 값(기준가 · 직접 키움 · 매물)은 싣지 않는다.
    expect(profile.players).toHaveLength(1);
    expect(profile.players![0]).toMatchObject({
      careerId: cb,
      pos: 'DF',
      peak: 82,
      nation: 'BR',
      roles,
    });
    expect(profile.players![0]).not.toHaveProperty('cardValue');
    expect(profile.players![0]).not.toHaveProperty('raised');
    expect(profile.players![0]).not.toHaveProperty('listing');
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
    // T-11-106 ?lang=en이면 문구만 영어다(id·점수·판정은 같다).
    const preEn = AchRes.parse((await read('?lang=en')).body).data;
    expect(preEn).toMatchObject({ season: 0, score: 10, seasons: [{ id: 0, name: 'Preseason' }] });
    expect(preEn.groups.map((g) => g.id)).toEqual(pre.groups.map((g) => g.id));
    expect(preEn.groups.map((g) => g.stage).slice(3, 6)).toEqual(['Stage 3', 'Stage 4', 'Stage 5']);
    expect(item(preEn, 'retire-GK')).toMatchObject({ label: 'Retire a goalkeeper', done: true });
    expect(item(preEn, 'age-40')).toMatchObject({ label: 'Still playing at 40', done: false });
    expect(
      JSON.stringify(
        preEn.groups.flatMap((g) => [g.title, g.stage, ...g.items.map((i) => i.label)]),
      ),
    ).not.toMatch(/[가-힣]/);

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

  it('장기근속·원클럽은 직접 육성·은퇴·서비스 시즌·숨김 정책을 유지하며 저장된 id를 읽는다', async () => {
    const me = await issueGoogleCookie(ctx);
    const other = await issueGoogleCookie(ctx);
    const ids = [
      await addCareer(me.profileId, { status: 'active' }),
      await addCareer(me.profileId, { serviceSeason: 1 }),
      await addCareer(me.profileId),
      await addCareer(other.profileId),
    ];
    await ctx.db.update(careers).set({ hidden: 1 }).where(eq(careers.id, ids[2]!));
    // 이름 비공개는 hidden과 다르다. 구매 카드의 소유자는 육성자가 되지 않는다.
    await ctx.db.update(cards).set({ ownerId: me.profileId }).where(eq(cards.careerId, ids[3]!));
    const addSeasons = async (id: string, n: number, military = false) => {
      for (let i = 0; i < n; i++)
        await ctx.db.insert(careerSeasons).values({
          careerId: id,
          year: 2026 + i,
          age: 20 + i,
          club: i < 5 ? '옛 이름' : '새 이름',
          clubId: military && i >= 8 ? 'sangmu' : 'A',
          league: i < 5 ? 'K리그2' : 'K리그1',
          apps: 0,
          goals: 0,
          assists: 0,
          rating: 0,
          rank: '-',
          ovr: 70,
          honorsJson: '[]',
          mil: 0,
          eventsJson: '[]',
          createdAt: '2026-09-28T00:00:00.000Z',
        });
    };
    for (const id of ids) await addSeasons(id, 10);
    const read = async () =>
      AchRes.parse(
        await (await call('GET', '/v1/owner-team/achievements', { cookie: me.cookie })).json(),
      ).data;
    const feats = (d: Awaited<ReturnType<typeof read>>) =>
      d.groups.flatMap((g) => g.items).filter((i) => ['long-service', 'one-club'].includes(i.id));
    expect(feats(await read()).map((i) => i.done)).toEqual([false, false]);
    const military = await addCareer(me.profileId, { publicName: null });
    await addSeasons(military, 10, true);
    expect(feats(await read()).map((i) => i.done)).toEqual([true, false]);
    const ordinary = await addCareer(me.profileId, { publicName: null });
    await addSeasons(ordinary, 10);
    const after = await read();
    expect(feats(after).map((i) => i.done)).toEqual([true, true]);
    expect(feats(after).map((i) => i.points)).toEqual([50, 50]);
    // 판매해도 원 육성자의 선수 업적은 기존처럼 남는다.
    await ctx.db
      .update(cards)
      .set({ ownerId: other.profileId })
      .where(eq(cards.careerId, ordinary));
    expect(feats(await read()).map((i) => i.done)).toEqual([true, true]);
  });

  it('T-11-147 현역 복무 시즌(mil)은 원클럽맨의 구단 수에서 빠지고 장기근속 재적에도 들지 않는다', async () => {
    const me = await issueGoogleCookie(ctx);
    const id = await addCareer(me.profileId);
    for (let i = 0; i < 10; i++) {
      const army = i === 4 || i === 5;
      await ctx.db.insert(careerSeasons).values({
        careerId: id,
        year: 2026 + i,
        age: 20 + i,
        club: army ? '현역 복무' : 'A',
        clubId: army ? null : 'A',
        league: army ? '병역' : 'K리그1',
        apps: 0,
        goals: 0,
        assists: 0,
        rating: 0,
        rank: '-',
        ovr: 70,
        honorsJson: '[]',
        mil: army ? 1 : 0,
        eventsJson: '[]',
        createdAt: '2026-09-28T00:00:00.000Z',
      });
    }
    const d = AchRes.parse(
      await (await call('GET', '/v1/owner-team/achievements', { cookie: me.cookie })).json(),
    ).data;
    const done = (k: string) => d.groups.flatMap((g) => g.items).find((i) => i.id === k)?.done;
    expect(done('one-club')).toBe(true);
    expect(done('long-service')).toBe(false);
  });

  it('T-11-103 영입한 선수도 팀 업적에 들고, 방출하려고 선발을 비워도 그 시즌 팀 업적은 남는다', async () => {
    const teamOne = async (cookie: string) =>
      AchRes.parse(await (await call('GET', '/v1/owner-team/achievements', { cookie })).json())
        .data.groups.flatMap((g) => g.items)
        .find((i) => i.id === 'team-one')?.done;
    // 다른 구단주가 키운 선수를 영입했다(카드 주인만 바뀐다).
    const seller = await issueGoogleCookie(ctx);
    const buyer = await issueGoogleCookie(ctx);
    const bought = await addCareer(seller.profileId, { peak: 75 });
    await ctx.db.update(cards).set({ ownerId: buyer.profileId }).where(eq(cards.careerId, bought));
    const slots: (string | null)[] = Array(11).fill(null);
    slots[9] = bought;
    expect((await putTeam(buyer.cookie, { slots })).status).toBe(200);
    expect(await teamOne(buyer.cookie)).toBe(true);

    // 직접 키운 선수로 달성한 뒤 선발에서 빼고 방출했다.
    const owner = await ownerWithTeam(1);
    expect(await teamOne(owner.cookie)).toBe(true);
    expect((await putTeam(owner.cookie, { slots: Array(11).fill(null) })).status).toBe(200);
    const res = await call('POST', '/v1/cards/release', {
      cookie: owner.cookie,
      headers: { 'Idempotency-Key': `ach-release-${seq}-key` },
      body: { careerIds: owner.ids },
    });
    expect(res.status).toBe(200);
    expect(await teamOne(owner.cookie)).toBe(true);
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

  it('시즌마다 새 팀 — 앞 시즌 선수는 와일드카드로 넣고(T-11-114), 지난 시즌 팀은 그대로 남는다', async () => {
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
    expect(fresh.players.map((p) => p.careerId)).toEqual([pre, s1]);
    // 지난 시즌 팀으로는 경기할 수 없다(이번 시즌 팀이 없다).
    const noTeam = await call('POST', '/v1/owner-team/matches', {
      cookie: me.cookie,
      headers: idem(),
      body: { opponentTeamId: rival.team.id },
    });
    expect(noTeam.status).toBe(409);
    const s1Team = PutRes.parse(
      await (await putTeam(me.cookie, { name: '시즌 FC', slots: slots(s1, pre) })).json(),
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
    // T-11-106 오류 안내도 ?lang=en이면 영어, code·reason은 그대로.
    const en = await call('GET', '/v1/owner-team/opponents?lang=en', { cookie: noTeam.cookie });
    expect(en.status).toBe(409);
    expect(await en.json()).toMatchObject({
      error: { message: "Create this season's team first.", details: { reason: 'TEAM_REQUIRED' } },
    });
    expect(
      await (await call('GET', '/v1/owner-team/opponents', { cookie: noTeam.cookie })).json(),
    ).toMatchObject({
      error: { message: '먼저 이번 시즌 팀을 만들어 주세요.' },
    });
  });

  it('시즌 1 개막 뒤 경기 결과와 상대 푸시가 함께 저장되고 재요청은 중복 발송하지 않는다', async () => {
    vi.setSystemTime(new Date('2026-10-06T00:01:00.000Z'));
    const me = await ownerWithTeam(3, 85, null, 1);
    const rival = await ownerWithTeam(3, 75, null, 1);
    await addAppPushDevice(ctx, rival.profileId);
    const options = { cookie: me.cookie, headers: idem(), body: { opponentTeamId: rival.team.id } };
    const first = await call('POST', '/v1/owner-team/matches', options);
    expect(first.status).toBe(201);
    const { match } = PlayRes.parse(await first.json()).data;
    expect(me.team.season).toBe(1);
    const stored = (await ctx.db.select().from(teamMatches))[0]!;
    expect(JSON.parse(stored.detailJson).home.synergy).toBeDefined();
    expect(match.home).not.toHaveProperty('synergy');
    const recent = await call('GET', '/v1/owner-team/matches', { cookie: rival.cookie });
    expect(recent.status).toBe(200);
    expect(MatchesRes.parse(await recent.json()).data.items[0]?.id).toBe(match.id);
    const notice = (await ctx.db.select().from(notifications))[0]!;
    expect(notice).toMatchObject({
      profileId: rival.profileId,
      kind: 'team',
      sourceKey: `team-match:${match.id}`,
    });
    expect(notice.body).toContain(`${match.away.goals} : ${match.home.goals}`);
    expect(await ctx.db.select().from(pushDeliveries)).toHaveLength(1);
    const again = await call('POST', '/v1/owner-team/matches', options);
    expect(again.status).toBe(201);
    expect(await ctx.db.select().from(notifications)).toHaveLength(1);
    expect(await ctx.db.select().from(pushDeliveries)).toHaveLength(1);
  });

  it('경기를 치르면 결과·전적이 남고, 상대 쪽 최근 경기에도 보인다', async () => {
    const me = await ownerWithTeam(5, 85);
    const rival = await ownerWithTeam(3, 70, '라이벌 에이스');
    await addAppPushDevice(ctx, rival.profileId);
    const res = await call('POST', '/v1/owner-team/matches', {
      cookie: me.cookie,
      headers: idem(),
      body: { opponentTeamId: rival.team.id },
    });
    expect(res.status).toBe(201);
    const { match, record, rating, matchesLeft } = PlayRes.parse(await res.json()).data;
    expect(await ctx.db.select().from(notifications)).toMatchObject([
      { profileId: rival.profileId, kind: 'team', sourceKey: `team-match:${match.id}` },
    ]);
    expect(await ctx.db.select().from(pushDeliveries)).toMatchObject([
      { profileId: rival.profileId, state: 'pending' },
    ]);
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
    expect(await ctx.db.select().from(notifications)).toMatchObject([
      { profileId: rival.profileId, kind: 'team' },
    ]);
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

  it('상대 후보는 내 레이팅에 가까운 팀부터(OVR이 아니라), 목록은 레이팅 높은 순', async () => {
    const me = await ownerWithTeam(1);
    const teams = await Promise.all([1, 1, 1].map(() => ownerWithTeam(1)));
    const setRating = (id: string, rating: number) =>
      ctx.db.update(ownerTeams).set({ rating }).where(eq(ownerTeams.id, id));
    await setRating(me.team.id, 1100);
    await setRating(teams[0]!.team.id, 1120);
    await setRating(teams[1]!.team.id, 1080);
    await setRating(teams[2]!.team.id, 900);
    const items = OppRes.parse(
      await (await call('GET', '/v1/owner-team/opponents', { cookie: me.cookie })).json(),
    ).data.items;
    expect(items.map((i) => i.rating)).toEqual([1120, 1080, 900]);
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
  // ───────── T-11-098 친구 · 친선전 ─────────
  describe('친구 · 친선전 (T-11-098)', () => {
    const friendsOf = async (cookie: string) =>
      FriendsRes.parse(await (await call('GET', '/v1/friends', { cookie })).json()).data;
    const request = (cookie: string, body: Record<string, unknown>) =>
      call('POST', '/v1/friends/requests', { cookie, body });
    const reason = async (res: Response) =>
      (ErrorEnvelopeSchema.parse(await res.json()).error.details as { reason?: string } | undefined)
        ?.reason;
    /** 두 구단주를 친구로 만든다(a가 코드로 신청 → b가 수락). */
    async function befriend(a: { cookie: string }, b: { cookie: string }) {
      const bCode = (await friendsOf(b.cookie)).code;
      expect((await request(a.cookie, { code: bCode })).status).toBe(201);
      const aCode = (await friendsOf(a.cookie)).code;
      expect((await call('POST', `/v1/friends/${aCode}/accept`, { cookie: b.cookie })).status).toBe(
        200,
      );
      return { aCode, bCode };
    }
    const friendly = (cookie: string, code: string) =>
      call('POST', `/v1/friends/${code}/matches`, { cookie, headers: idem() });

    it('세션이 없으면 401, 익명 프로필은 403 GOOGLE_LOGIN_REQUIRED', async () => {
      expect((await call('GET', '/v1/friends')).status).toBe(401);
      const anon = await issueCookie(ctx);
      for (const [method, path] of [
        ['GET', '/v1/friends'],
        ['POST', '/v1/friends/requests'],
        ['POST', '/v1/friends/ABCDEFGH/accept'],
        ['DELETE', '/v1/friends/ABCDEFGH'],
        ['POST', '/v1/friends/ABCDEFGH/matches'],
      ] as const) {
        const res = await call(method, path, {
          cookie: anon.cookie,
          headers: idem(),
          body: { code: 'ABCDEFGH' },
        });
        expect(res.status, `${method} ${path}`).toBe(403);
        expect(await reason(res)).toBe('GOOGLE_LOGIN_REQUIRED');
      }
    });

    it('T-11-142 받은 신청 수: 신청하면 받은 쪽만 1, 수락하면 0, 익명은 0', async () => {
      const pending = async (cookie: string) =>
        (
          (await (await call('GET', '/v1/friends/pending', { cookie })).json()) as {
            data: { received: number };
          }
        ).data.received;
      expect((await call('GET', '/v1/friends/pending')).status).toBe(401);
      expect(await pending((await issueCookie(ctx)).cookie)).toBe(0);
      const a = await issueGoogleCookie(ctx, { nickname: '받은수가' });
      const b = await issueGoogleCookie(ctx, { nickname: '받은수나' });
      const bCode = (await friendsOf(b.cookie)).code;
      await friendsOf(a.cookie);
      expect((await request(a.cookie, { code: bCode })).status).toBe(201);
      expect([await pending(a.cookie), await pending(b.cookie)]).toEqual([0, 1]);
      const aCode = (await friendsOf(a.cookie)).code;
      expect((await call('POST', `/v1/friends/${aCode}/accept`, { cookie: b.cookie })).status).toBe(
        200,
      );
      expect(await pending(b.cookie)).toBe(0);
    });

    it('코드는 한 번 만들면 그대로이고, 신청 → 수락으로 서로 친구가 된다', async () => {
      const a = await issueGoogleCookie(ctx, { nickname: '가나다' });
      const b = await issueGoogleCookie(ctx, { nickname: '라마바' });
      await addAppPushDevice(ctx, a.profileId);
      await addAppPushDevice(ctx, b.profileId);
      const first = await friendsOf(a.cookie);
      expect(first.code).toMatch(/^[A-Z2-9]{8}$/);
      expect((await friendsOf(a.cookie)).code).toBe(first.code);
      expect(first).toMatchObject({ friends: [], received: [], sent: [], recent: [] });
      expect(first.matchesLeft).toBe(FRIENDLY_MATCHES_PER_DAY);

      const bCode = (await friendsOf(b.cookie)).code;
      // 사람이 넣은 코드는 소문자·하이픈이 섞여도 받는다.
      const label = `${bCode.slice(0, 4)}-${bCode.slice(4)}`.toLowerCase();
      const sent = await request(a.cookie, { code: label });
      expect(sent.status).toBe(201);
      expect(FriendReqRes.parse(await sent.json()).data).toMatchObject({
        state: 'sent',
        friend: { code: bCode, name: '라마바', team: null },
      });
      // 다시 보내도 그대로(자연 멱등).
      expect(
        FriendReqRes.parse(await (await request(a.cookie, { code: bCode })).json()).data.state,
      ).toBe('sent');
      expect((await friendsOf(a.cookie)).sent.map((p) => p.name)).toEqual(['라마바']);
      const bView = await friendsOf(b.cookie);
      expect(bView.received.map((p) => [p.code, p.name])).toEqual([[first.code, '가나다']]);

      // 보낸 사람은 수락할 수 없다.
      expect((await call('POST', `/v1/friends/${bCode}/accept`, { cookie: a.cookie })).status).toBe(
        404,
      );
      const ok = await call('POST', `/v1/friends/${first.code}/accept`, { cookie: b.cookie });
      expect(ok.status).toBe(200);
      expect(FriendReqRes.parse(await ok.json()).data.state).toBe('accepted');
      expect((await friendsOf(a.cookie)).friends.map((p) => p.name)).toEqual(['라마바']);
      expect((await friendsOf(b.cookie)).friends.map((p) => p.name)).toEqual(['가나다']);
      expect(
        (await call('POST', `/v1/friends/${first.code}/accept`, { cookie: b.cookie })).status,
      ).toBe(200);
      const messages = await ctx.db.select().from(notifications);
      expect(messages).toHaveLength(2);
      expect(messages.map((n) => [n.profileId, n.title])).toEqual([
        [b.profileId, '새 친구 신청이 왔어요'],
        [a.profileId, '친구 신청이 수락됐어요'],
      ]);
      expect(await ctx.db.select().from(pushDeliveries)).toHaveLength(2);
    });

    it('상대가 먼저 신청했으면 내 신청이 곧 수락이고, 팀 프로필에서도 신청할 수 있다', async () => {
      const a = await ownerWithTeam(1);
      const b = await ownerWithTeam(1);
      const view = async (cookie: string | null, teamId: string) =>
        TeamProfileRes.parse(
          await (await call('GET', `/v1/teams/${teamId}`, cookie ? { cookie } : {})).json(),
        ).data.friend;
      expect(await view(a.cookie, b.team.id)).toBe('none');
      expect(await view(a.cookie, a.team.id)).toBeNull();
      expect(await view(null, b.team.id)).toBeNull();
      expect(await view((await issueCookie(ctx)).cookie, b.team.id)).toBeNull();

      const sent = await request(a.cookie, { teamId: b.team.id });
      expect(FriendReqRes.parse(await sent.json()).data).toMatchObject({
        state: 'sent',
        friend: { team: { id: b.team.id, name: b.team.name, filled: 1 } },
      });
      expect(await view(a.cookie, b.team.id)).toBe('sent');
      expect(await view(b.cookie, a.team.id)).toBe('received');
      // 친구 화면을 연 적 없는(코드가 없던) 신청자도 받은 쪽 목록에 보인다.
      expect((await friendsOf(b.cookie)).received.map((p) => p.team?.id)).toEqual([a.team.id]);
      const back = await request(b.cookie, { teamId: a.team.id });
      expect(FriendReqRes.parse(await back.json()).data.state).toBe('accepted');
      expect(await view(a.cookie, b.team.id)).toBe('accepted');
      expect(await ctx.db.select().from(notifications)).toHaveLength(2);
    });

    it('틀린 코드·내 코드·차단한 사이는 신청할 수 없다', async () => {
      const a = await issueGoogleCookie(ctx);
      const b = await issueGoogleCookie(ctx);
      const aCode = (await friendsOf(a.cookie)).code;
      const bCode = (await friendsOf(b.cookie)).code;
      const bad = await request(a.cookie, { code: 'ZZZZ-ZZZZ' });
      expect(bad.status).toBe(404);
      expect(await reason(bad)).toBe('FRIEND_NOT_FOUND');
      const self = await request(a.cookie, { code: aCode });
      expect(self.status).toBe(400);
      expect(await reason(self)).toBe('FRIEND_SELF');
      await ctx.db.insert(boardBlocks).values({
        id: `blk_${crypto.randomUUID()}`,
        profileId: b.profileId,
        blockedProfileId: a.profileId,
        nickname: '누군가',
        createdAt: new Date().toISOString(),
      });
      const blocked = await request(a.cookie, { code: bCode });
      expect(blocked.status).toBe(403);
      expect(await reason(blocked)).toBe('FRIEND_UNAVAILABLE');
      expect(await ctx.db.select().from(friends)).toEqual([]);
    });

    it.each([0, 1])(
      '친선전은 레이팅·전적·랭크 경기 수를 건드리지 않고 두 사람의 상대 전적만 남긴다 (시즌 %i)',
      async (season) => {
        if (season === 1) vi.setSystemTime(new Date('2026-10-06T00:01:00.000Z'));
        const a = await ownerWithTeam(5, 85, null, season);
        const b = await ownerWithTeam(3, 70, null, season);
        const { aCode, bCode } = await befriend(a, b);
        await addAppPushDevice(ctx, b.profileId);
        const res = await friendly(a.cookie, bCode);
        expect(res.status).toBe(201);
        const { match, h2h, matchesLeft } = FriendlyRes.parse(await res.json()).data;
        expect(match).toMatchObject({ friendly: true, mine: 'home' });
        expect([match.home.ratingChange, match.away.ratingChange]).toEqual([null, null]);
        expect(match.home.teamId).toBe(a.team.id);
        expect(match.away.teamId).toBe(b.team.id);
        expect(matchesLeft).toBe(FRIENDLY_MATCHES_PER_DAY - 1);
        const gf = match.home.goals;
        const ga = match.away.goals;
        expect(h2h).toEqual({ w: gf > ga ? 1 : 0, d: gf === ga ? 1 : 0, l: gf < ga ? 1 : 0 });

        for (const t of await ctx.db.select().from(ownerTeams)) {
          expect([t.rating, t.wins, t.draws, t.losses, t.goalsFor]).toEqual([1000, 0, 0, 0, 0]);
        }
        expect(await ctx.db.select().from(teamMatches)).toEqual([]);
        expect(await ctx.db.select().from(friendMatches)).toHaveLength(1);
        const message = (await ctx.db.select().from(notifications)).find(
          (n) => n.sourceKey === `friendly:${match.id}`,
        );
        expect(message).toMatchObject({
          profileId: b.profileId,
          kind: 'social',
          title: '친선전 결과가 도착했어요',
        });
        expect(message?.body).toContain(`${b.team.name} ${ga} : ${gf} ${a.team.name}`);
        const transport = vi
          .fn<typeof fetch>()
          .mockResolvedValue(Response.json({ data: [{ status: 'ok', id: 'friendly_ticket' }] }));
        await runPersonalPush(
          { ...ctx.env, ENVIRONMENT: 'production', PERSONAL_PUSH_ENABLED: '1' },
          Date.now(),
          transport,
        );
        expect(transport).toHaveBeenCalledTimes(1);
        expect(await ctx.db.select().from(pushDeliveries)).toMatchObject([
          { profileId: b.profileId, state: 'accepted' },
        ]);
        const owner = GetRes.parse(
          await (await call('GET', '/v1/owner-team', { cookie: a.cookie })).json(),
        ).data;
        expect(owner.matchesLeft).toBe(TEAM_MATCHES_PER_DAY);

        const aView = await friendsOf(a.cookie);
        expect(aView.friends[0]!.h2h).toEqual(h2h);
        expect(aView.recent.map((m) => [m.id, m.mine, m.friendly])).toEqual([
          [match.id, 'home', true],
        ]);
        expect(aView.matchesLeft).toBe(FRIENDLY_MATCHES_PER_DAY - 1);
        const bView = await friendsOf(b.cookie);
        expect(bView.friends[0]!.h2h).toEqual({ w: h2h.l, d: h2h.d, l: h2h.w });
        expect(bView.recent.map((m) => [m.id, m.mine])).toEqual([[match.id, 'away']]);
        // 받은 쪽의 친선전 수는 줄지 않는다.
        expect(bView.matchesLeft).toBe(FRIENDLY_MATCHES_PER_DAY);
        expect((await friendly(b.cookie, aCode)).status).toBe(201);
      },
    );

    it('친구가 아니거나 친구 팀이 없으면 친선전을 걸 수 없고, 하루 수를 넘으면 429', async () => {
      const a = await ownerWithTeam(1);
      const b = await ownerWithTeam(1);
      const bCode = (await friendsOf(b.cookie)).code;
      const notFriend = await friendly(a.cookie, bCode);
      expect(notFriend.status).toBe(404);
      expect(await reason(notFriend)).toBe('FRIEND_NOT_FOUND');

      const noTeam = await issueGoogleCookie(ctx);
      const { bCode: noTeamCode } = await befriend(a, noTeam);
      const r = await friendly(a.cookie, noTeamCode);
      expect(r.status).toBe(409);
      expect(await reason(r)).toBe('FRIEND_TEAM_REQUIRED');

      await befriend(a, b);
      for (let i = 0; i < FRIENDLY_MATCHES_PER_DAY; i++)
        expect((await friendly(a.cookie, bCode)).status).toBe(201);
      const over = await friendly(a.cookie, bCode);
      expect(over.status).toBe(429);
      expect(await reason(over)).toBe('FRIENDLY_DAILY_LIMIT');
    });

    it('T-11-113 개막 뒤 프리시즌 팀을 고쳐 프리시즌 친선전을 하고, 창단 멤버로 보인다 — 지난 랭킹·업적은 그대로', async () => {
      const a = await ownerWithTeam(1);
      const b = await issueGoogleCookie(ctx, { nickname: '창단' });
      const bPre = await addCareer(b.profileId, { peak: 85 });
      const { bCode } = await befriend(a, b);
      vi.setSystemTime(new Date('2026-10-10T00:00:00.000Z')); // 시즌 1
      const bS1 = await addCareer(b.profileId, { serviceSeason: 1 });
      const preFriendly = (cookie: string, code: string) =>
        call('POST', `/v1/friends/${code}/matches?season=0`, { cookie, headers: idem() });

      const view = await friendsOf(a.cookie);
      expect(view).toMatchObject({ canPlay: false, canPlayPreseason: true });
      expect(view.friends[0]).toMatchObject({ name: '창단', founder: true, preseasonTeam: null });
      const none = await preFriendly(a.cookie, bCode);
      expect(none.status).toBe(409);
      expect(await reason(none)).toBe('FRIEND_TEAM_REQUIRED');

      // 프리시즌 팀은 지금 가진 프리시즌 선수로만 고친다. 다른 지난 시즌·시즌 1 선수는 안 된다.
      expect((await putTeam(b.cookie, { season: 0, slots: slots(bS1) })).status).toBe(400);
      expect((await putTeam(b.cookie, { season: 2, slots: slots(bPre) })).status).toBe(409);
      const legacy = await putTeam(b.cookie, { season: 0, name: '레전드 FC', slots: slots(bPre) });
      expect(legacy.status).toBe(200);
      expect(PutRes.parse(await legacy.json()).data.team).toMatchObject({
        season: 0,
        name: '레전드 FC',
      });
      expect((await friendsOf(a.cookie)).friends[0]!.preseasonTeam).toMatchObject({
        name: '레전드 FC',
      });

      const played = await preFriendly(a.cookie, bCode);
      expect(played.status).toBe(201);
      // 이번 시즌 친선전은 여전히 이번 시즌 팀이 있어야 한다.
      expect(await reason(await friendly(a.cookie, bCode))).toBe('TEAM_REQUIRED');

      // 이미 있던 프리시즌 팀을 고쳐도 최종 기록(랭킹·팀 프로필)은 그대로이고, 친선전·내 팀 화면만 새 편성을 쓴다.
      const aNew = await addCareer(a.profileId, { peak: 95 });
      const edited = await putTeam(a.cookie, { season: 0, name: '새 이름', slots: slots(aNew) });
      expect(PutRes.parse(await edited.json()).data.team).toMatchObject({
        id: a.team.id,
        name: '새 이름',
      });
      const mineNow = GetRes.parse(
        await (await call('GET', '/v1/owner-team?season=0', { cookie: a.cookie })).json(),
      ).data.team!;
      expect(mineNow.slots[0]!.careerId).toBe(aNew);
      // 개막 뒤 만든 프리시즌 팀은 프리시즌 최종 랭킹·팀 업적에 들지 않는다.
      const ranking = successEnvelope(TeamRankResponseSchema).parse(
        await (await call('GET', '/v1/teams?season=0')).json(),
      ).data.items;
      expect(ranking.map((t) => [t.teamId, t.name, t.ovr])).toEqual([
        [a.team.id, a.team.name, a.team.ovr],
      ]);
      const ach = AchRes.parse(
        await (
          await call('GET', '/v1/owner-team/achievements?season=0', { cookie: b.cookie })
        ).json(),
      ).data;
      expect(ach.groups.some((g) => g.id === 'team')).toBe(false);
      const team = GetRes.parse(
        await (await call('GET', '/v1/owner-team?season=0', { cookie: b.cookie })).json(),
      ).data;
      expect(team).toMatchObject({ season: 0, current: 1, founder: true });
    });

    it('T-11-114 지난 시즌 선수는 와일드카드로 이번 시즌 선발에 3명까지 넣고, 카드 시즌이 보인다', async () => {
      const a = await issueGoogleCookie(ctx, { nickname: '와일드' });
      const pre = [];
      for (let i = 0; i < 4; i++) pre.push(await addCareer(a.profileId, { peak: 88 }));
      vi.setSystemTime(new Date('2026-10-10T00:00:00.000Z')); // 시즌 1
      const s1 = await addCareer(a.profileId, { serviceSeason: 1 });

      const view = GetRes.parse(
        await (await call('GET', '/v1/owner-team', { cookie: a.cookie })).json(),
      ).data;
      expect(view.season).toBe(1);
      expect(view.players.map((p) => [p.careerId, p.season]).sort()).toEqual(
        [...pre.map((id) => [id, 0]), [s1, 1]].sort(),
      );

      const over = await putTeam(a.cookie, { slots: slots(s1, ...pre) });
      expect(over.status).toBe(400);
      expect(await reason(over)).toBe('WILDCARD_LIMIT');
      const ok = await putTeam(a.cookie, { slots: slots(s1, ...pre.slice(0, 3)) });
      expect(ok.status).toBe(200);
      const team = PutRes.parse(await ok.json()).data.team;
      expect(team.season).toBe(1);
      expect(team.slots.slice(0, 4).map((s) => s.season)).toEqual([1, 0, 0, 0]);
      expect(team.slots[4]!.season).toBeUndefined();
    });

    it('친구를 끊으면 두 줄이 지워지고, 프로필을 지우면 친구 줄과 친선전이 사라진다', async () => {
      const a = await ownerWithTeam(1);
      const b = await ownerWithTeam(1);
      const c = await ownerWithTeam(1);
      const { bCode } = await befriend(a, b);
      const del = await call('DELETE', `/v1/friends/${bCode}`, { cookie: a.cookie });
      expect(FriendDelRes.parse(await del.json()).data.removed).toBe(true);
      expect(
        FriendDelRes.parse(
          await (await call('DELETE', `/v1/friends/${bCode}`, { cookie: a.cookie })).json(),
        ).data.removed,
      ).toBe(false);
      expect(await ctx.db.select().from(friends)).toEqual([]);

      const { bCode: cCode } = await befriend(a, c);
      expect((await friendly(a.cookie, cCode)).status).toBe(201);
      expect((await deleteProfile(ctx.env, c.cookie, 'friend-del')).status).toBe(204);
      expect(await ctx.db.select().from(friends)).toEqual([]);
      expect(await ctx.db.select().from(friendMatches)).toEqual([]);
      // 지운 사람의 코드로는 더 찾을 수 없다.
      expect((await request(a.cookie, { code: cCode })).status).toBe(404);
    });
  });
});
