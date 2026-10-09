import {
  AdminInviteReportSchema,
  FriendRequestResponseSchema,
  FriendsResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { INVITE_REROLLS, INVITE_REWARD_MAX } from '@offside/contracts/owner-team';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { notifications, ownerItems, referrals } from '../db/schema.js';
import { localizeNotification } from '../push/text.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import {
  ADMIN_EMAIL,
  RETIREMENT,
  callJson,
  issueAdminCookie,
  issueGoogleCookie,
  putSeasonsFor,
} from '../test/http.js';

const FriendsRes = successEnvelope(FriendsResponseSchema);
const RequestRes = successEnvelope(FriendRequestResponseSchema);

describe('T-11-171 친구 초대', () => {
  let ctx: TestD1;
  let seq = 0;
  beforeEach(async () => {
    ctx = await createTestD1();
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const friendsOf = async (cookie: string) =>
    FriendsRes.parse(await (await call('GET', '/v1/friends', { cookie })).json()).data;
  const requestByCode = async (cookie: string, code: string) => {
    const res = await call('POST', '/v1/friends/requests', { cookie, body: { code } });
    expect(res.status).toBe(201);
    return RequestRes.parse(await res.json()).data;
  };
  /** 시즌을 올리고 은퇴시킨다(새 커리어 id). */
  async function retire(cookie: string) {
    const careerId = `9f2c9b1a-6f0f-4a4b-9c3a-${String(++seq).padStart(12, '0')}`;
    await putSeasonsFor(ctx.env, cookie, careerId);
    const res = await call('PUT', `/v1/careers/${careerId}/retirement`, {
      cookie,
      body: RETIREMENT,
    });
    expect(res.status).toBe(200);
    return careerId;
  }
  const rerollsOf = async (profileId: string) =>
    (await ctx.db.select().from(ownerItems).where(eq(ownerItems.profileId, profileId)))[0]?.qty ??
    0;

  it('새 구단주가 초대 코드로 신청하고 커리어를 마치면 두 사람이 리롤권을 받는다(한 번만)', async () => {
    const inviter = await issueGoogleCookie(ctx, { nickname: '초대왕' });
    const invitee = await issueGoogleCookie(ctx);
    const code = (await friendsOf(inviter.cookie)).code;

    expect((await requestByCode(invitee.cookie, code)).invited).toBe(true);
    expect((await friendsOf(inviter.cookie)).invite).toMatchObject({
      pending: 1,
      done: 0,
      rewarded: 0,
      invitedBy: null,
    });
    expect((await friendsOf(invitee.cookie)).invite?.invitedBy).toEqual({
      name: '초대왕',
      done: false,
    });

    const careerId = await retire(invitee.cookie);
    expect(await rerollsOf(invitee.profileId)).toBe(INVITE_REROLLS);
    expect(await rerollsOf(inviter.profileId)).toBe(INVITE_REROLLS);
    expect(await ctx.db.select().from(referrals)).toMatchObject([
      { inviteeId: invitee.profileId, careerId, inviterRewarded: true },
    ]);
    expect((await friendsOf(inviter.cookie)).invite).toMatchObject({
      pending: 0,
      done: 1,
      rewarded: 1,
    });
    expect((await friendsOf(invitee.cookie)).invite?.invitedBy?.done).toBe(true);
    const kinds = await ctx.db
      .select({
        profileId: notifications.profileId,
        kind: notifications.kind,
        title: notifications.title,
        body: notifications.body,
      })
      .from(notifications)
      .where(eq(notifications.sourceKey, `invite:${invitee.profileId}:${inviter.profileId}`));
    expect(kinds).toMatchObject([{ profileId: inviter.profileId, kind: 'social' }]);
    // 알림함은 요청 언어로 바꿔 보인다.
    for (const lang of ['en', 'ja'] as const) {
      const n = localizeNotification(kinds[0]!, lang);
      expect([n.title, n.body].join(' ')).not.toMatch(/[가-힣]/);
    }

    // 두 번째 커리어는 다시 주지 않는다.
    await retire(invitee.cookie);
    expect(await rerollsOf(invitee.profileId)).toBe(INVITE_REROLLS);
    expect(await rerollsOf(inviter.profileId)).toBe(INVITE_REROLLS);
  });

  it('이미 은퇴 선수가 있거나 다른 초대를 받은 구단주는 초대로 적지 않는다', async () => {
    const a = await issueGoogleCookie(ctx);
    const b = await issueGoogleCookie(ctx);
    const veteran = await issueGoogleCookie(ctx);
    const newbie = await issueGoogleCookie(ctx);
    const [aCode, bCode] = [(await friendsOf(a.cookie)).code, (await friendsOf(b.cookie)).code];

    await retire(veteran.cookie);
    expect((await requestByCode(veteran.cookie, aCode)).invited).toBe(false);

    expect((await requestByCode(newbie.cookie, aCode)).invited).toBe(true);
    expect((await requestByCode(newbie.cookie, bCode)).invited).toBe(false);
    // 상대가 먼저 보낸 신청을 코드로 수락하는 것은 초대가 아니다.
    const [x, y] = [await issueGoogleCookie(ctx), await issueGoogleCookie(ctx)];
    expect((await requestByCode(x.cookie, (await friendsOf(y.cookie)).code)).invited).toBe(true);
    const accepted = await requestByCode(y.cookie, (await friendsOf(x.cookie)).code);
    expect(accepted).toMatchObject({ state: 'accepted', invited: false });
    expect(await ctx.db.select().from(referrals)).toMatchObject([
      { inviteeId: newbie.profileId, inviterId: a.profileId },
      { inviteeId: x.profileId, inviterId: y.profileId },
    ]);
  });

  it(`초대한 쪽은 ${INVITE_REWARD_MAX}명까지만 받고, 초대받은 쪽은 늘 받는다`, async () => {
    const inviter = await issueGoogleCookie(ctx);
    const code = (await friendsOf(inviter.cookie)).code;
    // 이미 보상받은 초대가 상한만큼 있다.
    for (let i = 0; i < INVITE_REWARD_MAX; i++) {
      const done = await issueGoogleCookie(ctx);
      await ctx.db.insert(referrals).values({
        inviteeId: done.profileId,
        inviterId: inviter.profileId,
        claimedAt: '2026-10-01T00:00:00.000Z',
        doneAt: '2026-10-02T00:00:00.000Z',
        careerId: `c-${i}`,
        inviterRewarded: true,
      });
    }
    const invitee = await issueGoogleCookie(ctx);
    expect((await requestByCode(invitee.cookie, code)).invited).toBe(true);
    await retire(invitee.cookie);
    expect(await rerollsOf(invitee.profileId)).toBe(INVITE_REROLLS);
    expect(await rerollsOf(inviter.profileId)).toBe(0);
    expect((await friendsOf(inviter.cookie)).invite).toMatchObject({
      done: INVITE_REWARD_MAX + 1,
      rewarded: INVITE_REWARD_MAX,
    });
  });

  it('T-11-177 운영 도구는 초대 합 · 많이 한 구단주 · 최근 초대를 보여 준다(운영자만)', async () => {
    const env = { ...ctx.env, ADMIN_EMAILS: ADMIN_EMAIL };
    const admin = await issueAdminCookie(ctx);
    const inviter = await issueGoogleCookie(ctx, { nickname: '초대왕' });
    const code = (await friendsOf(inviter.cookie)).code;
    const [a, b] = [await issueGoogleCookie(ctx), await issueGoogleCookie(ctx)];
    await requestByCode(a.cookie, code);
    await requestByCode(b.cookie, code);
    await retire(a.cookie);

    expect(
      (await callJson(env, 'GET', '/v1/admin/invites', { cookie: inviter.cookie })).status,
    ).toBe(403);
    const res = await callJson(env, 'GET', '/v1/admin/invites', { cookie: admin.cookie });
    const data = successEnvelope(AdminInviteReportSchema).parse(await res.json()).data;
    expect(data).toMatchObject({
      invites: 2,
      done: 1,
      inviterRewarded: 1,
      inviters: 1,
      rerolls: 2 * INVITE_REROLLS,
      top: [{ profileId: inviter.profileId, nickname: '초대왕', invited: 2, done: 1, rewarded: 1 }],
    });
    // 최근 것부터.
    expect(data.recent.map((r) => [r.inviteeId, r.doneAt !== null, r.inviterRewarded])).toEqual([
      [b.profileId, false, false],
      [a.profileId, true, true],
    ]);
  });
});
