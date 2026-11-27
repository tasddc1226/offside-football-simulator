import {
  FriendsResponseSchema,
  OwnerTitlesResponseSchema,
  OwnerHallVisitResponseSchema,
  successEnvelope,
  XmasClaimResponseSchema,
  XmasEventSchema,
} from '@offside/contracts';
import { INVITE_REROLLS, INVITE_SCOUTS } from '@offside/contracts/owner-team';
import { XMAS_EVENT, XMAS_INVITE_MULT, XMAS_TITLE } from '@offside/contracts/xmas';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appMeta, giftClaims, notifications, ownerItems, ownerTeams } from '../db/schema.js';
import { completeReferralStatements } from '../db/repos/referrals.js';
import { localizeNotification } from '../push/text.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import {
  ADMIN_EMAIL,
  RETIREMENT,
  callJson,
  issueAdminCookie,
  issueCookie,
  issueGoogleCookie,
  putSeasonsFor,
} from '../test/http.js';

const EventRes = successEnvelope(XmasEventSchema);
const ClaimRes = successEnvelope(XmasClaimResponseSchema);
const TitlesRes = successEnvelope(OwnerTitlesResponseSchema);
const FriendsRes = successEnvelope(FriendsResponseSchema);

/** 이벤트 첫날 정오(KST). */
const OPEN = new Date('2026-12-19T03:00:00Z');
/** 짧은 커리어(18~19세 2시즌, 20세 은퇴). */
const SHORT = {
  ...RETIREMENT,
  retireAge: 20,
  peak: 60,
  apps: 20,
  goals: 4,
  assists: 2,
  trophies: 0,
  awards: 0,
  caps: 0,
  ballon: 0,
  legendScore: 10,
};

describe('T-11-834 크리스마스 이벤트', () => {
  let ctx: TestD1;
  let seq = 0;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(OPEN);
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const key = () => ({ 'Idempotency-Key': crypto.randomUUID() });
  const state = async (cookie: string, q = '') =>
    EventRes.parse(await (await call('GET', `/v1/events/xmas${q}`, { cookie })).json()).data;
  const claim = (cookie: string, target: string, query = '') =>
    call('POST', `/v1/events/xmas/claim${query}`, { cookie, body: { target }, headers: key() });
  const itemOf = async (profileId: string, item: 'reroll' | 'boost' | 'scout') =>
    (await ctx.db.select().from(ownerItems).where(eq(ownerItems.profileId, profileId))).find(
      (r) => r.item === item,
    )?.qty ?? 0;
  async function retire(cookie: string) {
    const careerId = `7a2c9b1a-6f0f-4a4b-9c3a-${String(++seq).padStart(12, '0')}`;
    await putSeasonsFor(ctx.env, cookie, careerId, SHORT);
    const res = await call('PUT', `/v1/careers/${careerId}/retirement`, { cookie, body: SHORT });
    expect(res.status).toBe(200);
    return careerId;
  }
  const addTeam = (profileId: string) =>
    ctx.db.insert(ownerTeams).values({
      id: `tem_${crypto.randomUUID()}`,
      profileId,
      season: 3,
      name: '북쪽 별 FC',
      formation: '4-3-3',
      slotsJson: '[]',
      filled: 0,
      ovr: 0,
      createdAt: OPEN.toISOString(),
      updatedAt: OPEN.toISOString(),
    });

  it('기간 전 · 뒤에는 DB를 읽지 않고 닫혀 있고, 받을 수 없다', async () => {
    const me = await issueGoogleCookie(ctx);
    vi.setSystemTime(new Date('2026-12-18T14:59:00Z'));
    expect(await state(me.cookie)).toMatchObject({ phase: 'before', owner: false });
    const early = await claim(me.cookie, 'sock:team');
    expect(early.status).toBe(409);
    expect(await early.json()).toMatchObject({ error: { details: { reason: 'XMAS_CLOSED' } } });
    vi.setSystemTime(new Date(XMAS_EVENT.endAt));
    expect((await state(me.cookie)).phase).toBe('ended');
  });

  it('운영자는 ?preview=1로 기간 전에도 열린 화면을 본다(일반 구단주는 무시)', async () => {
    vi.setSystemTime(new Date('2026-12-01T03:00:00Z'));
    ctx.env.ADMIN_EMAILS = ADMIN_EMAIL;
    const admin = await issueAdminCookie(ctx);
    const user = await issueGoogleCookie(ctx);
    expect((await state(admin.cookie, '?preview=1')).phase).toBe('open');
    expect((await state(user.cookie, '?preview=1')).phase).toBe('before');
    await addTeam(admin.profileId);
    expect((await claim(admin.cookie, 'sock:team', '?preview=1')).status).toBe(200);
    expect((await claim(user.cookie, 'sock:team', '?preview=1')).status).toBe(409);
  });

  it('세 양말: 조건을 채우면 받고, 다시 받으면 409 · 로그인하지 않으면 403', async () => {
    const guest = await issueCookie(ctx);
    const g = await state(guest.cookie);
    expect(g).toMatchObject({ phase: 'open', owner: false, title: false });
    expect(g.socks.map((s) => [s.key, s.done, s.claimed])).toEqual([
      ['start', false, false],
      ['retire', false, false],
      ['team', false, false],
    ]);
    expect((await claim(guest.cookie, 'sock:start')).status).toBe(403);

    const me = await issueGoogleCookie(ctx);
    const notYet = await claim(me.cookie, 'sock:start');
    expect(notYet.status).toBe(409);
    expect(await notYet.json()).toMatchObject({ error: { details: { reason: 'XMAS_NOT_READY' } } });

    await retire(me.cookie);
    await addTeam(me.profileId);
    const s = await state(me.cookie);
    expect(s.socks.map((x) => [x.key, x.done])).toEqual([
      ['start', true],
      ['retire', true],
      ['team', true],
    ]);
    expect(s.tree.mine).toBe(1);

    const got = ClaimRes.parse(await (await claim(me.cookie, 'sock:retire')).json()).data;
    expect(got.granted).toEqual({ reroll: 3, boost: 2, scout: 0, rename: 0 });
    expect(got.event.socks.find((x) => x.key === 'retire')?.claimed).toBe(true);
    const again = await claim(me.cookie, 'sock:retire');
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: { details: { reason: 'XMAS_CLAIMED' } } });

    await claim(me.cookie, 'sock:start');
    const team = ClaimRes.parse(await (await claim(me.cookie, 'sock:team')).json()).data;
    expect(team.title).toBe(true);
    expect(await itemOf(me.profileId, 'reroll')).toBe(6);
    expect(await itemOf(me.profileId, 'boost')).toBe(4);
    expect(await itemOf(me.profileId, 'scout')).toBe(1);
    expect((await state(me.cookie)).title).toBe(true);
  });

  it('기간 전에 은퇴한 커리어 · 만든 커리어는 양말 조건이 아니다', async () => {
    const me = await issueGoogleCookie(ctx);
    vi.setSystemTime(new Date('2026-12-10T03:00:00Z'));
    await retire(me.cookie);
    vi.setSystemTime(OPEN);
    const s = await state(me.cookie);
    expect(s.socks.map((x) => x.done)).toEqual([false, false, false]);
    expect(s.tree.mine).toBe(0);
  });

  it('트리는 기간 7일의 하루 은퇴 수를 더하고, 단계에 닿으면 받는다', async () => {
    const me = await issueGoogleCookie(ctx);
    await ctx.db.insert(appMeta).values([
      { key: 'retired:2026-12-18', value: '9999' }, // 기간 전날은 세지 않는다
      { key: 'retired:2026-12-19', value: '2000' },
      { key: 'retired:2026-12-20', value: '1500' },
    ]);
    const s = await state(me.cookie);
    expect(s.tree).toMatchObject({ count: 3500, goal: XMAS_EVENT.treeGoal, counting: true });
    expect(s.tree.steps.map((x) => x.reached)).toEqual([true, false, false, false]);
    const ok = ClaimRes.parse(await (await claim(me.cookie, 'tree:1')).json()).data;
    expect(ok.granted).toMatchObject({ reroll: 2 });
    expect((await claim(me.cookie, 'tree:2')).status).toBe(409);
    // 트리 마감(12/26) 뒤에도 받기는 이벤트 끝까지 된다.
    vi.setSystemTime(new Date('2026-12-28T03:00:00Z'));
    expect((await state(me.cookie)).tree.counting).toBe(false);
  });

  it('큰 양말을 받으면 한정 칭호를 명예관에서 고를 수 있다', async () => {
    const me = await issueGoogleCookie(ctx);
    expect(
      (await call('PUT', '/v1/owner/title', { cookie: me.cookie, body: { title: XMAS_TITLE } }))
        .status,
    ).toBe(409);
    await addTeam(me.profileId);
    expect((await claim(me.cookie, 'sock:team')).status).toBe(200);
    const hall = TitlesRes.parse(
      await (await call('GET', '/v1/owner/title', { cookie: me.cookie })).json(),
    ).data;
    expect(hall.titles).toContain(XMAS_TITLE);
    const visit = await call('GET', `/v1/owners/by-team/${hall.teamId}/hall`);
    expect(
      successEnvelope(OwnerHallVisitResponseSchema).parse(await visit.json()).data.titles,
    ).toContain(XMAS_TITLE);
    const put = await call('PUT', '/v1/owner/title', {
      cookie: me.cookie,
      body: { title: XMAS_TITLE },
    });
    expect(put.status).toBe(200);
    expect(await ctx.db.select().from(giftClaims)).toHaveLength(1);
  });

  it('밸런스 xmasEvent 0이면 기간이어도 닫는다', async () => {
    const me = await issueGoogleCookie(ctx);
    await ctx.env.DB.prepare(
      `INSERT INTO balance_versions (status, values_json, note, created_at, updated_at, created_by, activated_at)
       VALUES ('active', '{"xmasEvent":0}', '', ?1, ?1, 'test', ?1)`,
    )
      .bind(OPEN.toISOString())
      .run();
    expect((await state(me.cookie)).phase).toBe('ended');
  });

  it('기간 중 끝난 친구 초대는 두 사람 모두 2배로 받고, 알림도 번역된다', async () => {
    const inviter = await issueGoogleCookie(ctx, { nickname: '산타' });
    const invitee = await issueGoogleCookie(ctx);
    const code = FriendsRes.parse(
      await (await call('GET', '/v1/friends', { cookie: inviter.cookie })).json(),
    ).data.code;
    expect(
      (await call('POST', '/v1/friends/requests', { cookie: invitee.cookie, body: { code } }))
        .status,
    ).toBe(201);
    const careerId = await retire(invitee.cookie);
    // 같은 시각에 pending을 읽었던 두 번째 요청의 batch.
    await ctx.env.DB.batch(
      completeReferralStatements(
        ctx.env.DB,
        { inviteeId: invitee.profileId, inviterId: inviter.profileId, careerId },
        OPEN.toISOString(),
      ),
    );
    for (const p of [invitee.profileId, inviter.profileId]) {
      expect(await itemOf(p, 'reroll')).toBe(INVITE_REROLLS * XMAS_INVITE_MULT);
      expect(await itemOf(p, 'scout')).toBe(INVITE_SCOUTS * XMAS_INVITE_MULT);
    }
    const rows = await ctx.db
      .select({ kind: notifications.kind, title: notifications.title, body: notifications.body })
      .from(notifications)
      .where(eq(notifications.profileId, inviter.profileId));
    const invite = rows.find((r) => r.body.includes('친구 초대 보상'));
    expect(invite).toBeTruthy();
    for (const lang of ['en', 'ja', 'zh'] as const) {
      const n = localizeNotification(invite!, lang);
      expect([n.title, n.body].join(' ')).not.toMatch(/[가-힣]/);
    }
  });
});
