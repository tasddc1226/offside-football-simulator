import { readFileSync } from 'node:fs';
import {
  ErrorEnvelopeSchema,
  PlayTeamMatchResponseSchema,
  PutOwnerTeamResponseSchema,
  TeamLikeResponseSchema,
  TeamProfileResponseSchema,
  AchRankResponseSchema,
  TeamRankResponseSchema,
  TeamStatsResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { createApp } from '../app.js';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cards,
  careers,
  ownerAchievements,
  ownerTeams,
  profiles,
  teamLikes,
  teamMatches,
} from '../db/schema.js';
import { createTestD1, spyDb, syncCards, type TestD1 } from '../test/d1.js';
import { flushEdge, installFakeEdgeCache } from '../test/edgeCache.js';
import {
  ADMIN_EMAIL,
  callJson,
  deleteProfile,
  issueCookie,
  issueGoogleCookie,
} from '../test/http.js';

const PutRes = successEnvelope(PutOwnerTeamResponseSchema);
const PlayRes = successEnvelope(PlayTeamMatchResponseSchema);
const RankRes = successEnvelope(TeamRankResponseSchema);
const AchRes = successEnvelope(AchRankResponseSchema);
const ProfileRes = successEnvelope(TeamProfileResponseSchema);
const LikeRes = successEnvelope(TeamLikeResponseSchema);
const StatsRes = successEnvelope(TeamStatsResponseSchema);

let seq = 0;

describe('/v1/teams (T-10-092 라이브 랭킹 · 팀 프로필)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T00:00:00.000Z')); // 프리시즌(팀 시즌 0)
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);

  /** 구단주 + 은퇴 선수 n명(공격수, 공개 이름)으로 만든 프리시즌 팀. */
  async function team(n: number, peak: number, manager = `감독${++seq}`) {
    const who = await issueGoogleCookie(ctx);
    const s: (string | null)[] = Array(11).fill(null);
    for (let i = 0; i < n; i++) {
      const id = crypto.randomUUID();
      await ctx.db.insert(careers).values({
        id,
        profileId: who.profileId,
        pos: 'FW',
        foot: '오른발',
        type: 'poacher',
        trait: 'late',
        startYear: 2026,
        status: 'retired',
        appVersion: '1.0.0',
        createdAt: '2026-09-28T00:00:00.000Z',
        updatedAt: '2026-09-28T00:00:00.000Z',
        retiredAt: '2026-09-28T00:00:00.000Z',
        retireAge: 34,
        peak,
        legendScore: 300,
        shirtNumber: 9,
        publicName: i === 0 ? `${manager} 에이스` : null,
        serviceSeason: 0,
      });
      s[[9, 8, 10][i]!] = id;
    }
    await syncCards(ctx);
    const res = await call('PUT', '/v1/owner-team', {
      cookie: who.cookie,
      body: { name: `팀${++seq}`, manager, formation: '4-3-3', slots: s },
    });
    expect(res.status).toBe(200);
    return { ...who, team: PutRes.parse(await res.json()).data.team };
  }

  const rank = async (q = '') => {
    const res = await call('GET', `/v1/teams${q}`);
    expect(res.status).toBe(200);
    return { res, data: RankRes.parse(await res.json()).data };
  };
  const profile = async (id: string, cookie?: string) =>
    ProfileRes.parse(await (await call('GET', `/v1/teams/${id}`, cookie ? { cookie } : {})).json())
      .data;

  it('선수가 있는 팀만 레이팅 순으로 오르고, OVR 순으로도 본다', async () => {
    const strong = await team(3, 90, '강감독');
    const weak = await team(1, 70);
    const empty = await issueGoogleCookie(ctx);
    await call('PUT', '/v1/owner-team', {
      cookie: empty.cookie,
      body: { name: '빈 팀', manager: '빈감독', formation: '4-4-2', slots: Array(11).fill(null) },
    });
    // 약한 팀이 이기도록 레이팅을 직접 둔다(경기 결과는 무작위).
    await ctx.db.update(ownerTeams).set({ rating: 1040 }).where(eq(ownerTeams.id, weak.team.id));

    const { res, data } = await rank();
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=60');
    expect(data).toMatchObject({ season: 0, sort: 'rating', page: 1, total: 2 });
    expect(data.seasons).toEqual([{ id: 0, name: '프리시즌' }]);
    expect(data.items.map((i) => [i.rank, i.teamId])).toEqual([
      [1, weak.team.id],
      [2, strong.team.id],
    ]);
    expect(data.items[1]).toMatchObject({ manager: '강감독', rating: 1000, likes: 0 });
    const byOvr = (await rank('?sort=ovr')).data;
    expect(byOvr.items.map((i) => i.teamId)).toEqual([strong.team.id, weak.team.id]);
    expect((await call('GET', '/v1/teams?season=1')).status).toBe(400);
    expect((await call('GET', '/v1/teams?sort=goals')).status).toBe(400);
  });

  it('T-11-129: 구단 가치는 선발 11명 카드 기준가 합이고, 지금 주인이 아닌 카드·숨긴 카드는 세지 않는다', async () => {
    const deep = await team(3, 90, '셋감독');
    const star = await team(1, 70, '한감독');
    const slotIds = (t: typeof deep) =>
      t.team.slots.flatMap((x) => (x.careerId ? [x.careerId] : []));
    const [a, b, c] = slotIds(deep);
    const [s1] = slotIds(star);
    for (const [id, v] of [
      [a, 500],
      [b, 400],
      [c, 300],
      [s1, 1_000],
    ] as const)
      await ctx.db.update(cards).set({ cardValue: v }).where(eq(cards.careerId, id!));

    // Exercise the migration backfill against existing teams, including both eligibility rules.
    const migration = readFileSync(
      new URL('../../migrations/0138_fancy_scarlet_witch.sql', import.meta.url),
      'utf8',
    );
    const statements = migration.split('--> statement-breakpoint').map((x) => x.trim());
    const populate = statements.find((x) => x.startsWith('INSERT INTO team_lineup_cards'))!;
    const calculate = statements.find((x) =>
      x.startsWith('UPDATE owner_teams SET lineup_value_open'),
    )!;
    await ctx.env.DB.prepare('DELETE FROM team_lineup_cards').run();
    await ctx.env.DB.prepare(
      'UPDATE owner_teams SET lineup_value_open = 0, lineup_value_closed = 0',
    ).run();
    await ctx.env.DB.prepare(populate).run();
    await ctx.env.DB.prepare(calculate).run();

    const data = (await rank('?sort=value')).data;
    expect(data.sort).toBe('value');
    expect(data.items.map((i) => [i.teamId, i.value])).toEqual([
      [deep.team.id, 1_200],
      [star.team.id, 1_000],
    ]);
    // 다른 정렬에도 구단 가치가 실린다.
    expect((await rank()).data.items.find((i) => i.teamId === star.team.id)?.value).toBe(1_000);

    // 팔려 나간 카드(주인이 바뀐 카드)와 숨긴 선수는 선발에서 빠진다.
    await ctx.db.update(cards).set({ ownerId: star.profileId }).where(eq(cards.careerId, a!));
    await ctx.db.update(careers).set({ hidden: 1 }).where(eq(careers.id, b!));
    const after = (await rank('?sort=value&page=1')).data;
    expect(after.items.map((i) => [i.teamId, i.value])).toEqual([
      [star.team.id, 1_000],
      [deep.team.id, 300],
    ]);
    const stored = async () =>
      (await ctx.db.select().from(ownerTeams).where(eq(ownerTeams.id, deep.team.id)))[0]!;
    expect(await stored()).toMatchObject({ lineupValueOpen: 300, lineupValueClosed: 800 });
    await ctx.db.update(cards).set({ manager: true }).where(eq(cards.careerId, c!));
    expect(await stored()).toMatchObject({ lineupValueOpen: 0, lineupValueClosed: 800 });
    await ctx.db.update(careers).set({ hidden: 0 }).where(eq(careers.id, b!));
    expect(await stored()).toMatchObject({ lineupValueOpen: 400, lineupValueClosed: 1200 });
    await ctx.db
      .update(ownerTeams)
      .set({ slotsJson: JSON.stringify([c]) })
      .where(eq(ownerTeams.id, deep.team.id));
    expect(await stored()).toMatchObject({ lineupValueOpen: 0, lineupValueClosed: 300 });
    await ctx.db.delete(cards).where(eq(cards.careerId, c!));
    expect(await stored()).toMatchObject({ lineupValueOpen: 0, lineupValueClosed: 0 });
  });

  it('최근 5경기는 홈·원정을 합쳐 최신순으로 읽고 상대 결과는 뒤집는다', async () => {
    const a = await team(1, 80);
    const b = await team(1, 75);
    const idle = await team(1, 70);
    const results = ['W', 'D', 'L', 'W', 'D', 'L', 'W'] as const;
    await ctx.db.insert(teamMatches).values(
      results.map((result, i) => {
        const homeA = i % 2 === 0;
        const ownGoals = result === 'W' ? 2 : result === 'D' ? 1 : 0;
        return {
          id: `form-${i}`,
          profileId: homeA ? a.profileId : b.profileId,
          homeTeamId: homeA ? a.team.id : b.team.id,
          awayTeamId: homeA ? b.team.id : a.team.id,
          homeGoals: homeA ? ownGoals : 1,
          awayGoals: homeA ? 1 : ownGoals,
          detailJson: '{}',
          // Last two matches share a timestamp: ID breaks the tie deterministically.
          createdAt: `2026-09-29T00:00:0${Math.min(i, 5)}.000Z`,
        };
      }),
    );
    const { DB, seen } = spyDb(ctx.env.DB);
    const res = await callJson({ ...ctx.env, DB }, 'GET', '/v1/teams');
    expect(res.status).toBe(200);
    const { data } = RankRes.parse(await res.json());
    expect(data.items.find((x) => x.teamId === a.team.id)?.recentForm).toEqual([
      'W',
      'L',
      'D',
      'W',
      'L',
    ]);
    expect(data.items.find((x) => x.teamId === b.team.id)?.recentForm).toEqual([
      'L',
      'W',
      'D',
      'L',
      'W',
    ]);
    expect(data.items.find((x) => x.teamId === idle.team.id)?.recentForm).toEqual([]);
    expect(seen.filter((query) => query.includes('WITH requested'))).toHaveLength(1);
    expect(seen.filter((query) => query.includes('sessions'))).toEqual([]);
  });

  it('팀 프로필은 누구나 보고, 순위·선수 공개 이름·배지를 보인다', async () => {
    const a = await team(3, 88, '홍감독');
    const b = await team(1, 60);
    const play = await call('POST', '/v1/owner-team/matches', {
      cookie: a.cookie,
      headers: { 'Idempotency-Key': `teams-play-${++seq}-key` },
      body: { opponentTeamId: b.team.id },
    });
    const { match } = PlayRes.parse(await play.json()).data;

    const p = await profile(a.team.id);
    expect(p).toMatchObject({ liked: false, mine: false });
    expect(p.team).toMatchObject({
      id: a.team.id,
      season: 0,
      seasonName: '프리시즌',
      manager: '홍감독',
      record: { w: match.home.goals > match.away.goals ? 1 : 0 },
      goals: { for: match.home.goals, against: match.away.goals },
    });
    expect(p.team.rank).toBe(p.team.rating >= 1000 ? 1 : 2);
    expect(p.team.slots[9]).toMatchObject({ slot: 'ST', name: '홍감독 에이스' });
    expect(p.team.slots[8]!.name).toBe('익명의 공격수 No.9');
    expect(p.team.badges.map((x) => x.id)).toContain('debut');
    // T-11-290 선발 시너지 — 내 팀 화면과 같은 표(서버가 경기 계산과 같은 입력으로 센다).
    expect(p.team.synergy).toMatchObject({
      lines: { atk: expect.any(Number), gk: expect.any(Number) },
    });
    expect(p.team.synergy!.foot).toHaveLength(11);
    expect(Array.isArray(p.team.synergy!.active)).toBe(true);
    expect(p.team.badges.some((x) => x.id.startsWith('final-'))).toBe(false); // 아직 진행 중인 시즌
    expect((await profile(a.team.id, a.cookie)).mine).toBe(true);
    // T-11-167 구단주 닉네임(닉네임 신고 대상). 정하지 않았으면 null.
    expect(p.team.ownerNickname).toBeNull();
    await ctx.db.update(profiles).set({ nickname: '홍구단주' }).where(eq(profiles.id, a.profileId));
    expect((await profile(a.team.id)).team.ownerNickname).toBe('홍구단주');
    expect((await call('GET', `/v1/teams/tem_${crypto.randomUUID()}`)).status).toBe(404);

    // 시즌 1이 열리면 프리시즌은 끝난 시즌 — 최종 순위 배지가 붙는다.
    vi.setSystemTime(new Date('2026-10-10T00:00:00.000Z'));
    const top = p.team.rank === 1 ? a : b;
    const final = await profile(top.team.id);
    expect(final.team.badges[0]).toMatchObject({ id: 'final-1', desc: '프리시즌 최종 1위' });
    expect((await rank('?season=0')).data.total).toBe(2);
    expect((await rank()).data).toMatchObject({ season: 1, total: 0 });
  });

  it('T-11-290: 스쿼드 댓글 — 누구나 읽고, 구글 로그인·닉네임이 있어야 쓰고, 지우기·신고·차단은 게시판 댓글 라우트로 한다', async () => {
    const a = await team(3, 88, '홍감독');
    const anon = await issueCookie(ctx);
    const noNick = await issueGoogleCookie(ctx);
    const bob = await issueGoogleCookie(ctx, { nickname: '밥' });
    const carol = await issueGoogleCookie(ctx, { nickname: '캐롤' });
    const path = `/v1/teams/${a.team.id}/comments`;
    const read = async (cookie?: string) =>
      (await (await call('GET', path, cookie ? { cookie } : {})).json()) as {
        data: {
          comments: { id: string; nickname: string; body: string; deletable: boolean }[];
          blocks: { id: string; nickname: string }[];
        };
      };

    expect((await read()).data).toEqual({ comments: [], blocks: [] });
    expect((await call('GET', `/v1/teams/tem_${crypto.randomUUID()}/comments`)).status).toBe(404);
    // 익명 프로필·닉네임 없는 구글 프로필은 쓸 수 없다.
    expect(
      (await call('POST', path, { cookie: anon.cookie, body: { body: '좋네요' } })).status,
    ).toBe(403);
    expect(
      (await call('POST', path, { cookie: noNick.cookie, body: { body: '좋네요' } })).status,
    ).toBe(403);
    expect(
      (await call('POST', path, { cookie: bob.cookie, body: { body: '시발 뭐냐' } })).status,
    ).toBe(400);
    expect(
      (await call('POST', path, { cookie: bob.cookie, body: { body: '좋네요' } })).status,
    ).toBe(201);
    const res = await call('POST', path, { cookie: carol.cookie, body: { body: '수비가 약해요' } });
    expect(res.status).toBe(201);
    const carolId = ((await res.json()) as { data: { id: string } }).data.id;
    expect(carolId.startsWith('tcm_')).toBe(true);
    expect(
      (
        await call('POST', `/v1/teams/tem_${crypto.randomUUID()}/comments`, {
          cookie: bob.cookie,
          body: { body: '좋네요' },
        })
      ).status,
    ).toBe(404);

    const asBob = (await read(bob.cookie)).data;
    expect(asBob.comments.map((c) => [c.nickname, c.body, c.deletable])).toEqual([
      ['밥', '좋네요', true],
      ['캐롤', '수비가 약해요', false],
    ]);
    expect((await read()).data.comments.every((c) => !c.deletable)).toBe(true);
    // 남의 댓글은 못 지우고(403), 신고하면 내 화면에서만 빠진다.
    expect(
      (await call('DELETE', `/v1/boards/comments/${carolId}`, { cookie: bob.cookie })).status,
    ).toBe(403);
    expect(
      (
        await call('POST', `/v1/boards/comments/${carolId}/report`, {
          cookie: bob.cookie,
          body: { reason: 'abuse' },
        })
      ).status,
    ).toBe(204);
    expect((await read(bob.cookie)).data.comments.map((c) => c.nickname)).toEqual(['밥']);
    expect((await read(carol.cookie)).data.comments.map((c) => c.nickname)).toEqual(['밥', '캐롤']);
    // 차단하면 그 사람의 댓글이 모두 빠지고 차단 목록에 남는다. 풀면 돌아온다.
    const bobId = asBob.comments[0]!.id;
    const blocked = await call('POST', `/v1/boards/comments/${bobId}/block`, {
      cookie: carol.cookie,
    });
    expect(blocked.status).toBe(201);
    const asCarol = (await read(carol.cookie)).data;
    expect(asCarol.comments.map((c) => c.nickname)).toEqual(['캐롤']);
    expect(asCarol.blocks.map((b) => b.nickname)).toEqual(['밥']);
    expect(
      (await call('DELETE', `/v1/boards/blocks/${asCarol.blocks[0]!.id}`, { cookie: carol.cookie }))
        .status,
    ).toBe(204);
    expect((await read(carol.cookie)).data.comments).toHaveLength(2);
    // 본인은 지운다. 지운 댓글은 다시 지우거나 신고할 수 없다.
    expect(
      (await call('DELETE', `/v1/boards/comments/${carolId}`, { cookie: carol.cookie })).status,
    ).toBe(204);
    expect((await read()).data.comments.map((c) => c.nickname)).toEqual(['밥']);
    expect(
      (await call('DELETE', `/v1/boards/comments/${carolId}`, { cookie: carol.cookie })).status,
    ).toBe(404);
    // 운영 도구 최근 댓글 목록에 팀 이름과 함께 섞여 보인다.
    const admin = await issueGoogleCookie(ctx, { email: ADMIN_EMAIL, nickname: '관리' });
    const list = (await (
      await callJson(
        { ...ctx.env, ADMIN_EMAILS: ADMIN_EMAIL },
        'GET',
        '/v1/admin/comments?limit=5',
        {
          cookie: admin.cookie,
        },
      )
    ).json()) as {
      data: { comments: { id: string; board: string; postTitle: string; postId: string }[] };
    };
    expect(list.data.comments).toMatchObject([
      { id: bobId, board: 'team', postTitle: a.team.name, postId: a.team.id },
    ]);
    // 프로필을 지우면 그 사람의 팀 댓글도 사라진다.
    expect((await deleteProfile(ctx.env, bob.cookie, 'team-comment-del')).status).toBe(204);
    expect((await read()).data.comments).toEqual([]);
  });

  it('T-11-106: lang=en이면 시즌 이름·익명 선수·배지 문구가 영어, lang이 없거나 모르는 값이면 한국어', async () => {
    const a = await team(3, 88, '홍감독');
    const p = ProfileRes.parse(
      await (await call('GET', `/v1/teams/${a.team.id}?lang=en`)).json(),
    ).data;
    expect(p.team).toMatchObject({ seasonName: 'Preseason' });
    expect(p.team.slots[9]!.name).toBe('홍감독 에이스'); // 공개 이름은 그대로
    expect(p.team.slots[8]!.name).toBe('Anonymous forward No.9');
    expect(p.team.slots[0]!.name).toBe('Youth player');
    const ja = ProfileRes.parse(
      await (await call('GET', `/v1/teams/${a.team.id}?lang=ja`)).json(),
    ).data;
    expect(ja.team.slots[8]!.name).toBe('匿名のフォワード No.9');
    expect(ja.team.slots[0]!.name).toBe('ユース選手');
    const unknown = ProfileRes.parse(
      await (await call('GET', `/v1/teams/${a.team.id}?lang=fr`)).json(),
    ).data;
    expect(unknown.team).toMatchObject({ seasonName: '프리시즌' });
    expect(unknown.team.slots[8]!.name).toBe('익명의 공격수 No.9');
    expect(unknown.team.slots[0]!.name).toBe('유스 선수');

    // 끝난 시즌의 최종 순위 배지 문장
    vi.setSystemTime(new Date('2026-10-10T00:00:00.000Z'));
    const final = ProfileRes.parse(
      await (await call('GET', `/v1/teams/${a.team.id}?lang=en`)).json(),
    ).data;
    expect(final.team.badges[0]).toEqual({
      id: 'final-1',
      label: 'Season champions',
      desc: 'Finished 1st in Preseason',
    });
  });

  it('T-11-106: 랭킹은 lang=en을 받고(엄격한 쿼리), 엣지에는 한국어 응답 하나만 담아 시즌 이름만 언어별로 바꾼다', async () => {
    await team(1, 80);
    const edge = installFakeEdgeCache();
    try {
      const ko = (await rank()).data;
      const en = (await rank('?lang=en')).data;
      const odd = (await rank('?lang=zz')).data; // 모르는 값은 한국어
      await flushEdge();
      expect(ko.seasons).toEqual([{ id: 0, name: '프리시즌' }]);
      expect(en.seasons).toEqual([{ id: 0, name: 'Preseason' }]);
      expect(odd.seasons).toEqual(ko.seasons);
      expect(en.items).toEqual(ko.items);
      const base = 'http://localhost/v1/teams?season=0&sort=rating&page=1&form=5&logo=1';
      expect([...edge.store.keys()].sort()).toEqual([base]);
      const ach = await call('GET', '/v1/achievements/ranking?lang=en');
      expect(ach.status).toBe(200);
      await flushEdge();
      expect([...edge.store.keys()].filter((k) => k.includes('achievements'))).toEqual([
        'http://localhost/v1/achievements/ranking?season=0&page=1&logo=1',
      ]);
      // 팀을 저장하면 그 키 하나를 지운다.
      edge.purged.length = 0;
      await team(1, 70);
      await flushEdge();
      expect(edge.purged).toEqual(expect.arrayContaining([base]));
      expect(edge.store.has(base)).toBe(false);
    } finally {
      edge.uninstall();
    }
  });

  it('T-11-441: me=1이면 세션의 팀 순위와 그 페이지를 돌려주고, 사람마다 달라 담지 않는다', async () => {
    const strong = await team(3, 90);
    const weak = await team(1, 70);
    await ctx.db.update(ownerTeams).set({ rating: 1040 }).where(eq(ownerTeams.id, weak.team.id));
    const edge = installFakeEdgeCache();
    try {
      const me = async (q: string, cookie?: string) => {
        const res = await call('GET', `/v1/teams?me=1${q}`, cookie ? { cookie } : {});
        expect(res.status).toBe(200);
        expect(res.headers.get('Cache-Control')).toBe('private, no-store');
        return RankRes.parse(await res.json()).data;
      };
      const byRating = await me('', strong.cookie);
      expect(byRating.me).toEqual({ teamId: strong.team.id, rank: 2 });
      expect(byRating.page).toBe(1);
      expect(byRating.items.map((i) => i.teamId)).toEqual([weak.team.id, strong.team.id]);
      expect((await me('&sort=ovr', strong.cookie)).me).toEqual({
        teamId: strong.team.id,
        rank: 1,
      });
      // 로그인하지 않았으면 null.
      expect((await me('')).me).toBeNull();
      expect((await me('&sort=value', strong.cookie)).me).toEqual({
        teamId: strong.team.id,
        rank: 1,
      });
      await flushEdge();
      // 엣지에는 공개 페이지만 담긴다(me 키 없음).
      expect([...edge.store.keys()].some((k) => k.includes('me'))).toBe(false);
    } finally {
      edge.uninstall();
    }
  });

  it('모든 정렬에서 동점인 팀의 내 순위는 목록의 ID 순서와 같다', async () => {
    const teams = [await team(1, 80), await team(1, 80)];
    for (const { team: t } of teams) {
      const careerId = t.slots.find((slot) => slot.careerId)?.careerId;
      await ctx.db.update(cards).set({ cardValue: 1000 }).where(eq(cards.careerId, careerId!));
    }
    await ctx.db
      .update(ownerTeams)
      .set({ rating: 1000, ovr: 80, createdAt: '2026-09-01T00:00:00Z' });
    const ordered = [...teams].sort((a, b) => a.team.id.localeCompare(b.team.id));
    for (const sort of ['rating', 'ovr', 'value'] as const) {
      const list = (await rank(`?sort=${sort}`)).data;
      expect(list.items.map((item) => item.teamId)).toEqual(ordered.map((t) => t.team.id));
      for (const [index, owner] of ordered.entries()) {
        const res = await call('GET', `/v1/teams?sort=${sort}&me=1`, { cookie: owner.cookie });
        const result = RankRes.parse(await res.json()).data;
        expect(result.me).toEqual({ teamId: owner.team.id, rank: index + 1 });
        expect(result.items[result.me!.rank - 1]?.teamId).toBe(owner.team.id);
      }
    }
  });

  it('가치순 내 순위는 동점 순서와 캐시된 옛 페이지를 처리한다', async () => {
    const a = await team(1, 80);
    const b = await team(1, 80);
    const first = a.team.slots.find((x) => x.careerId)?.careerId;
    const second = b.team.slots.find((x) => x.careerId)?.careerId;
    await ctx.db.update(cards).set({ cardValue: 1000 }).where(eq(cards.careerId, first!));
    await ctx.db.update(cards).set({ cardValue: 1000 }).where(eq(cards.careerId, second!));
    await ctx.db.update(ownerTeams).set({ rating: 1000, createdAt: '2026-09-01T00:00:00Z' });
    const edge = installFakeEdgeCache();
    try {
      const cached = (await rank('?sort=value')).data;
      await flushEdge();
      const lower = cached.items[1]!;
      const mine = lower.teamId === a.team.id ? a : b;
      const card = lower.teamId === a.team.id ? first : second;
      const callMine = async () =>
        RankRes.parse(
          await (await call('GET', '/v1/teams?sort=value&me=1', { cookie: mine.cookie })).json(),
        ).data;
      expect((await callMine()).me).toEqual({ teamId: lower.teamId, rank: 2 });
      await ctx.db.update(cards).set({ cardValue: 2000 }).where(eq(cards.careerId, card!));
      const moved = await callMine();
      expect(moved.me).toEqual({ teamId: lower.teamId, rank: 1 });
      expect(moved.items[0]?.teamId).toBe(lower.teamId);
      expect(moved.items[0]?.value).toBe(2000);
    } finally {
      edge.uninstall();
    }
  });

  it('T-11-441: 업적 랭킹 me=1은 내 업적 순위를 돌려주고, 기록이 없으면 null', async () => {
    const a = await issueGoogleCookie(ctx);
    const b = await issueGoogleCookie(ctx);
    const none = await issueGoogleCookie(ctx);
    const at = '2026-09-29T00:00:00.000Z';
    await ctx.db.insert(ownerAchievements).values([
      {
        profileId: a.profileId,
        season: 0,
        score: 50,
        done: 2,
        players: 1,
        reachedAt: at,
        updatedAt: at,
      },
      {
        profileId: b.profileId,
        season: 0,
        score: 80,
        done: 3,
        players: 2,
        reachedAt: at,
        updatedAt: at,
      },
    ]);
    const me = async (cookie: string) => {
      const res = await call('GET', '/v1/achievements/ranking?me=1', { cookie });
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('private, no-store');
      return AchRes.parse(await res.json()).data;
    };
    const mine = await me(a.cookie);
    expect(mine.me).toEqual({ rank: 2 });
    expect(mine.items.map((i) => i.rank)).toEqual([1, 2]);
    expect((await me(none.cookie)).me).toBeNull();
  });

  it('팀 랭킹은 모든 정렬을 엣지에 5분 담는다', async () => {
    await team(1, 80);
    const edge = installFakeEdgeCache();
    try {
      for (const sort of ['rating', 'ovr', 'value']) await rank(`?sort=${sort}`);
      await flushEdge();
      const ttl = (sort: string) =>
        edge.controls.get(
          `http://localhost/v1/teams?season=0&sort=${sort}&page=1&form=5&logo=1${sort === 'value' ? '&value-cache=2' : ''}`,
        );
      expect(ttl('rating')).toBe('public, max-age=300');
      expect(ttl('ovr')).toBe('public, max-age=300');
      expect(ttl('value')).toBe('public, max-age=300');
    } finally {
      edge.uninstall();
    }
  });

  it('좋아요는 한 사람이 한 번(익명 프로필도), 내 팀은 누를 수 없고, 조회수는 부를 때마다 오른다', async () => {
    const a = await team(1, 80);
    const fan = await issueCookie(ctx);
    const like = (cookie: string, method = 'PUT') =>
      call(method, `/v1/teams/${a.team.id}/like`, { cookie });
    expect((await call('PUT', `/v1/teams/${a.team.id}/like`)).status).toBe(401);
    expect(LikeRes.parse(await (await like(fan.cookie)).json()).data).toEqual({
      liked: true,
      likes: 1,
    });
    expect(LikeRes.parse(await (await like(fan.cookie)).json()).data.likes).toBe(1);
    const own = await like(a.cookie);
    expect(own.status).toBe(409);
    expect(ErrorEnvelopeSchema.parse(await own.json()).error.details).toEqual({
      reason: 'OWN_TEAM',
    });
    expect((await profile(a.team.id, fan.cookie)).liked).toBe(true);

    expect((await call('POST', `/v1/teams/${a.team.id}/views`)).status).toBe(204);
    expect((await call('POST', `/v1/teams/${a.team.id}/views`)).status).toBe(204);
    expect((await profile(a.team.id)).team).toMatchObject({ likes: 1, views: 2 });
    expect((await call('POST', `/v1/teams/tem_${crypto.randomUUID()}/views`)).status).toBe(404);

    expect(LikeRes.parse(await (await like(fan.cookie, 'DELETE')).json()).data).toEqual({
      liked: false,
      likes: 0,
    });

    // 좋아요를 누른 사람이 프로필을 지우면 좋아요도 빠진다.
    const google = await issueGoogleCookie(ctx);
    await like(google.cookie);
    expect((await profile(a.team.id)).team.likes).toBe(1);
    expect((await deleteProfile(ctx.env, google.cookie, 'teams-like-del')).status).toBe(204);
    expect((await profile(a.team.id)).team.likes).toBe(0);
    expect(await ctx.db.select().from(teamLikes)).toEqual([]);
  });

  it('T-11-029: 끝난 시즌(프리시즌은 시즌 1 개막에 끝난다) 팀의 좋아요는 누르기도 거두기도 409로 거절한다', async () => {
    const a = await team(1, 80);
    const fan = await issueCookie(ctx);
    const like = (method: string) =>
      call(method, `/v1/teams/${a.team.id}/like`, { cookie: fan.cookie });
    expect((await like('PUT')).status).toBe(200); // 진행 중인 시즌에는 누를 수 있다.

    vi.setSystemTime(new Date('2026-10-10T00:00:00.000Z')); // 시즌 1 — 프리시즌 팀은 닫혔다.
    for (const method of ['PUT', 'DELETE']) {
      const res = await like(method);
      expect(res.status).toBe(409);
      expect(ErrorEnvelopeSchema.parse(await res.json()).error.details).toEqual({
        reason: 'SEASON_CLOSED',
      });
    }
    // 좋아요는 굳은 채 그대로다.
    expect((await profile(a.team.id, fan.cookie)).team.likes).toBe(1);
    expect((await profile(a.team.id, fan.cookie)).liked).toBe(true);
  });
  it('T-11-358: 팀 경기 통계는 누구나 보고(세션 · 프로필 조회 없이), 엣지에 한 벌 담고, 경기를 치르면 두 팀 키를 지운다', async () => {
    const a = await team(2, 85, '통계감독');
    const b = await team(1, 70);
    const c = await team(1, 70);
    // 경기 전: 빈 통계.
    const empty = StatsRes.parse(
      await (await call('GET', `/v1/teams/${c.team.id}/stats`)).json(),
    ).data;
    expect(empty).toMatchObject({
      season: 0,
      matches: 0,
      capped: false,
      players: [],
      opponents: [],
    });
    expect(empty.summary).toMatchObject({
      form: [],
      streak: null,
      bestWinStreak: 0,
      biggestWin: null,
    });
    // 없는 팀은 404.
    const missing = await call('GET', `/v1/teams/tem_${crypto.randomUUID()}/stats`);
    expect(missing.status).toBe(404);

    const play = await call('POST', '/v1/owner-team/matches', {
      cookie: a.cookie,
      headers: { 'Idempotency-Key': `teams-stats-${++seq}-key` },
      body: { opponentTeamId: b.team.id },
    });
    const { match } = PlayRes.parse(await play.json()).data;
    const { DB, seen } = spyDb(ctx.env.DB);
    const res = await createApp().request(
      `/v1/teams/${a.team.id}/stats`,
      { headers: { Cookie: b.cookie } },
      { ...ctx.env, DB },
    );
    expect(res.status).toBe(200);
    expect(seen.filter((q) => /"sessions"|from "profiles"|"profiles"\."id" = \?/.test(q))).toEqual(
      [],
    );
    const data = StatsRes.parse(await res.json()).data;
    const gf = match.home.goals;
    const ga = match.away.goals;
    expect(data).toMatchObject({ season: 0, matches: 1 });
    expect(data.total).toEqual({
      w: gf > ga ? 1 : 0,
      d: gf === ga ? 1 : 0,
      l: gf < ga ? 1 : 0,
      gf,
      ga,
    });
    expect(data.summary?.form).toEqual([gf > ga ? 'w' : gf === ga ? 'd' : 'l']);
    expect(data.opponents.map((o) => o.teamId)).toEqual([b.team.id]);
    // 상대 쪽에서는 거꾸로 센다.
    const theirs = StatsRes.parse(
      await (await call('GET', `/v1/teams/${b.team.id}/stats`)).json(),
    ).data;
    expect(theirs.total).toMatchObject({ gf: ga, ga: gf });

    const edge = installFakeEdgeCache();
    try {
      const key = `http://localhost/v1/teams/${a.team.id}/stats`;
      await call('GET', `/v1/teams/${a.team.id}/stats`);
      await call('GET', `/v1/teams/${a.team.id}/stats?lang=en`);
      await flushEdge();
      expect([...edge.store.keys()]).toEqual([key]);
      expect(edge.controls.get(key)).toBe('public, max-age=300');
      // 없는 팀은 담지 않는다.
      await call('GET', `/v1/teams/tem_${crypto.randomUUID()}/stats`);
      await flushEdge();
      expect(edge.store.size).toBe(1);
      // 경기를 치르면 두 팀 통계 키를 지운다.
      await call('POST', '/v1/owner-team/matches', {
        cookie: a.cookie,
        headers: { 'Idempotency-Key': `teams-stats-${++seq}-key` },
        body: { opponentTeamId: c.team.id },
      });
      await flushEdge();
      expect(edge.purged).toEqual(
        expect.arrayContaining([key, `http://localhost/v1/teams/${c.team.id}/stats`]),
      );
      expect(edge.store.has(key)).toBe(false);
    } finally {
      edge.uninstall();
    }
  });
});
