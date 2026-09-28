import {
  ErrorEnvelopeSchema,
  OwnerTeamResponseSchema,
  PlayTeamMatchResponseSchema,
  PutOwnerTeamResponseSchema,
  TeamMatchesResponseSchema,
  TeamOpponentsResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { TEAM_MATCHES_PER_DAY, YOUTH_OVR } from '@offside/contracts/owner-team';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { careers, ownerTeams, teamMatches } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, deleteProfile, issueCookie, issueGoogleCookie } from '../test/http.js';

const GetRes = successEnvelope(OwnerTeamResponseSchema);
const PutRes = successEnvelope(PutOwnerTeamResponseSchema);
const OppRes = successEnvelope(TeamOpponentsResponseSchema);
const PlayRes = successEnvelope(PlayTeamMatchResponseSchema);
const MatchesRes = successEnvelope(TeamMatchesResponseSchema);

type Pos = 'FW' | 'MF' | 'DF' | 'GK';
let seq = 0;

describe('/v1/owner-team (T-10-092 구단주 팀)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
  });
  afterEach(async () => {
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
      peak?: number;
      status?: 'active' | 'retired';
      publicName?: string | null;
    } = {},
  ) {
    const id = crypto.randomUUID();
    const now = '2026-09-28T00:00:00.000Z';
    const retired = (over.status ?? 'retired') === 'retired';
    await ctx.db.insert(careers).values({
      id,
      profileId,
      pos: over.pos ?? 'FW',
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
    });
    return id;
  }

  const slots = (...ids: (string | null)[]) => [...ids, ...Array(11 - ids.length).fill(null)];
  const putTeam = (cookie: string, body: Record<string, unknown>) =>
    call('PUT', '/v1/owner-team', {
      cookie,
      body: { name: '우리 FC', formation: '4-3-3', ...body },
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
    expect(data.teams).toEqual([]);
    expect(data.slotsMax).toBe(1);
    expect(data.matchesLeft).toBe(TEAM_MATCHES_PER_DAY);
    expect(data.players.map((p) => p.careerId)).toEqual([a, b]);
    expect(data.players[0]).toMatchObject({
      pos: 'FW',
      dpos: null,
      peak: 88,
      publicName: '공개 선수',
    });
  });

  it('팀을 만들고 고친다 — 빈 자리는 유스 선수, 팀 슬롯은 1개', async () => {
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

    // 두 번째 팀은 만들 수 없다.
    const second = await putTeam(me.cookie, { slots: slots() });
    expect(second.status).toBe(409);
    expect(ErrorEnvelopeSchema.parse(await second.json()).error.details).toEqual({
      reason: 'TEAM_SLOTS_FULL',
    });

    // teamId로 고치면 같은 팀이 바뀐다(포메이션·자리).
    const updated = await putTeam(me.cookie, {
      teamId: team.id,
      formation: '3-5-2',
      slots: slots(null, null, null, null, null, null, null, null, null, st),
    });
    expect(updated.status).toBe(200);
    const after = PutRes.parse(await updated.json()).data.team;
    expect(after.id).toBe(team.id);
    expect(after.formation).toBe('3-5-2');
    const got = GetRes.parse(
      await (await call('GET', '/v1/owner-team', { cookie: me.cookie })).json(),
    );
    expect(got.data.teams).toHaveLength(1);
    expect(got.data.teams[0]!.slots[9]!.careerId).toBe(st);
    expect(got.data.teams[0]!.slots[0]!.careerId).toBeNull();
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
    expect(items[0]).toMatchObject({
      owner: expect.stringMatching(/^구단주/),
      record: { w: 0, d: 0, l: 0 },
    });

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
    const { match, record, matchesLeft } = PlayRes.parse(await res.json()).data;
    expect(matchesLeft).toBe(TEAM_MATCHES_PER_DAY - 1);
    expect(match.home.teamId).toBe(me.team.id);
    expect(match.away).toMatchObject({ teamId: rival.team.id, name: rival.team.name });
    expect(match.mine).toBe('home');
    expect(match.events).toHaveLength(match.home.goals + match.away.goals);
    const won = match.home.goals > match.away.goals;
    const drew = match.home.goals === match.away.goals;
    expect(record).toEqual({ w: won ? 1 : 0, d: drew ? 1 : 0, l: !won && !drew ? 1 : 0 });
    // 상대 득점자 이름은 공개 이름이거나 익명·유스 표기다(비공개 이름은 서버에 없다).
    for (const e of match.events.filter((x) => x.side === 'away'))
      expect(e.scorer).toMatch(/^(라이벌 에이스|유스 선수|익명의 .+)$/);

    const [homeRow] = await ctx.db.select().from(ownerTeams).where(eq(ownerTeams.id, me.team.id));
    const [awayRow] = await ctx.db
      .select()
      .from(ownerTeams)
      .where(eq(ownerTeams.id, rival.team.id));
    expect(homeRow!.wins + homeRow!.draws + homeRow!.losses).toBe(1);
    expect(awayRow!.wins).toBe(homeRow!.losses);
    expect(awayRow!.losses).toBe(homeRow!.wins);

    const theirs = MatchesRes.parse(
      await (await call('GET', '/v1/owner-team/matches', { cookie: rival.cookie })).json(),
    ).data.items;
    expect(theirs).toHaveLength(1);
    expect(theirs[0]).toMatchObject({ id: match.id, mine: 'away' });
    expect(theirs[0]!.events).toEqual(match.events);
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
