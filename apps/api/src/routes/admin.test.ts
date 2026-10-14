import {
  type AdminCommentList,
  type AdminRevenue,
  type AdminUser,
  type AdminStats,
  type AnomalyReport,
  type AutomationReport,
} from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { kstDays } from '../time.js';
import {
  auditLog,
  billingAlerts,
  careers,
  iapPurchases,
  notifications,
  ownerItems,
} from '../db/schema.js';
import { kstWindow } from '../db/repos/revenue.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import {
  ADMIN_EMAIL,
  callJson,
  issueAdminCookie,
  issueCookie,
  issueGoogleCookie,
  seasonBody,
} from '../test/http.js';

describe('운영 도구 /v1/admin (T-10-016)', () => {
  let ctx: TestD1;
  let env: TestD1['env'];
  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(env, method, path, opts);
  const data = async <T>(res: Response) => ((await res.json()) as { data: T }).data;

  const makeAdmin = () => issueAdminCookie(ctx);
  const googleUser = (nickname: string) => issueGoogleCookie(ctx, { nickname });
  async function writePost(cookie: string) {
    const res = await call('POST', '/v1/boards/notice/posts', {
      cookie,
      body: { title: '점검 안내', body: '오늘 밤 점검합니다.' },
    });
    return (await data<{ id: string }>(res)).id;
  }
  async function comment(cookie: string, postId: string, body: string) {
    const res = await call('POST', `/v1/boards/posts/${postId}/comments`, {
      cookie,
      body: { body },
    });
    expect(res.status).toBe(201);
    return (await data<{ id: string }>(res)).id;
  }

  beforeEach(async () => {
    ctx = await createTestD1();
    env = { ...ctx.env, ADMIN_EMAILS: ADMIN_EMAIL };
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('관리자만 볼 수 있다 — 세션 없음 401, 일반 프로필 403', async () => {
    const user = await issueCookie(ctx);
    for (const [method, path] of [
      ['GET', '/v1/admin/stats'],
      ['GET', '/v1/admin/comments'],
      ['POST', '/v1/admin/comments/purge'],
      ['GET', '/v1/admin/automation'],
      ['GET', '/v1/admin/anomalies'],
      ['POST', '/v1/admin/careers/hidden'],
      ['GET', '/v1/admin/users?q=x'],
      ['GET', '/v1/admin/revenue'],
    ] as const) {
      expect((await call(method, path)).status, path).toBe(401);
      expect(
        (await call(method, path, { cookie: user.cookie, body: { profileId: user.profileId } }))
          .status,
        path,
      ).toBe(403);
    }
  });

  it('T-11-263 아이템 지급·회수는 관리자만, 감사 기록·알림을 남기고 가진 것보다 많이는 못 뺀다', async () => {
    const user = await googleUser('구단주');
    const path = `/v1/admin/users/${user.profileId}/items`;
    const body = { item: 'reroll', delta: 5, reason: '점검 보상' };
    const key = (k: string) => ({ 'Idempotency-Key': `grant-${k}-0000` });
    expect(
      (await call('POST', path, { cookie: user.cookie, body, headers: key('u') })).status,
    ).toBe(403);
    const admin = await makeAdmin();
    const grant = async (b: object, k: string) =>
      call('POST', path, { cookie: admin.cookie, body: b, headers: key(k) });
    const r1 = await grant(body, 'a');
    expect(r1.status).toBe(200);
    expect(await data(r1)).toEqual({ item: 'reroll', qty: 5 });
    const r2 = await grant({ item: 'reroll', delta: -2, reason: '잘못 지급' }, 'b');
    expect(await data(r2)).toEqual({ item: 'reroll', qty: 3 });
    const r3 = await grant({ item: 'reroll', delta: -4, reason: '잘못 지급' }, 'c');
    expect(r3.status).toBe(409);
    expect((await grant({ item: 'scout', delta: -1, reason: '없는 것' }, 'd')).status).toBe(409);
    expect((await grant({ item: 'reroll', delta: 0, reason: '영' }, 'e')).status).toBe(400);
    const missing = `/v1/admin/users/prf_00000000-0000-0000-0000-000000000000/items`;
    expect(
      (await call('POST', missing, { cookie: admin.cookie, body, headers: key('f') })).status,
    ).toBe(404);
    const [held] = await ctx.db
      .select()
      .from(ownerItems)
      .where(eq(ownerItems.profileId, user.profileId));
    expect(held?.qty).toBe(3);
    const audits = await ctx.db.select().from(auditLog).where(eq(auditLog.kind, 'ITEM_GRANTED'));
    expect(audits.map((a) => JSON.parse(a.payloadJson).delta).sort()).toEqual([-2, 5]);
    expect(audits.every((a) => a.profileId === user.profileId)).toBe(true);
    // 지급만 알린다(회수·실패는 알리지 않는다).
    const sent = await ctx.db
      .select()
      .from(notifications)
      .where(eq(notifications.profileId, user.profileId));
    expect(sent.map((n) => n.body)).toEqual(['운영팀이 선수 후보 리롤권 5장을 보냈어요.']);
    // 영어 요청이면 알림함 문구가 영어로 나간다.
    const inbox = await call('GET', '/v1/notifications?lang=en', { cookie: user.cookie });
    expect(JSON.stringify(await inbox.json())).toContain(
      'The OFFSIDE team sent you 5 player reroll ticket(s).',
    );
  });

  it('T-11-263 유저 조회: 프로필 id·닉네임·친구 코드로 찾고 결제·아이템·지급 기록을 모은다', async () => {
    const admin = await makeAdmin();
    const user = await googleUser('Striker');
    const now = new Date().toISOString();
    await ctx.db.insert(iapPurchases).values({
      store: 'apple',
      transactionId: 't-1',
      profileId: user.profileId,
      productId: 'com.offsidelab.app.scout_5',
      item: 'scout',
      qty: 5,
      createdAt: now,
    });
    await call('POST', `/v1/admin/users/${user.profileId}/items`, {
      cookie: admin.cookie,
      body: { item: 'boost', delta: 2, reason: '문의 보상', notify: false },
      headers: { 'Idempotency-Key': 'grant-lookup-0000' },
    });
    for (const q of [user.profileId, 'striker']) {
      const res = await call('GET', `/v1/admin/users?q=${q}`, { cookie: admin.cookie });
      expect(res.status, q).toBe(200);
      const u = await data<AdminUser>(res);
      expect(u.profile).toMatchObject({ id: user.profileId, nickname: 'Striker', google: true });
      expect(u.items).toEqual({ boost: 2 });
      expect(u.purchases).toHaveLength(1);
      expect(u.purchases[0]).toMatchObject({
        productId: 'com.offsidelab.app.scout_5',
        test: false,
      });
      expect(u.grants).toEqual([
        expect.objectContaining({
          item: 'boost',
          delta: 2,
          reason: '문의 보상',
          by: admin.profileId,
        }),
      ]);
      expect(u.sessions.some((x) => x.active > 0)).toBe(true);
    }
    expect((await call('GET', '/v1/admin/users?q=nobody', { cookie: admin.cookie })).status).toBe(
      404,
    );
    // 알림을 끄고 준 지급은 알림을 남기지 않는다.
    const sent = await ctx.db
      .select()
      .from(notifications)
      .where(eq(notifications.profileId, user.profileId));
    expect(sent).toHaveLength(0);
  });

  it('T-11-263 매출: 기간 합·첫 구매자·환불·상품별·광고 제거(스토어 알림), 테스트 결제는 뺀다', async () => {
    const admin = await makeAdmin();
    const a = await googleUser('A');
    const b = await googleUser('B');
    const now = Date.now();
    const ago = (d: number) => new Date(now - d * 86_400_000).toISOString();
    const buy = (id: string, pid: string, productId: string, at: string, extra = {}) => ({
      store: 'google',
      transactionId: id,
      profileId: pid,
      productId,
      item: 'reroll',
      qty: 1,
      createdAt: at,
      ...extra,
    });
    await ctx.db
      .insert(iapPurchases)
      .values([
        buy('1', a.profileId, 'com.offsidelab.app.reroll_40', ago(0)),
        buy('2', a.profileId, 'com.offsidelab.app.boost_10', ago(20)),
        buy('3', b.profileId, 'com.offsidelab.app.reroll_5', ago(1)),
        buy('4', b.profileId, 'com.offsidelab.app.scout_5', ago(2), { refundedAt: ago(0) }),
        buy('5', b.profileId, 'com.offsidelab.app.reroll_40', ago(0), { test: true }),
      ]);
    await ctx.db.insert(billingAlerts).values([
      {
        id: 'b1',
        store: 'apple',
        kind: 'purchase',
        productId: 'com.offsidelab.app.remove_ads',
        test: false,
        createdAt: ago(1),
      },
      {
        id: 'b2',
        store: 'apple',
        kind: 'purchase',
        productId: 'com.offsidelab.app.reroll_5',
        test: false,
        createdAt: ago(1),
      },
    ]);
    const res = await call('GET', '/v1/admin/revenue?days=7', { cookie: admin.cookie });
    expect(res.status).toBe(200);
    const r = await data<AdminRevenue>(res);
    expect(r.total).toEqual({
      count: 2,
      krw: 5500 + 1100,
      buyers: 2,
      firstBuyers: 1,
      refunds: 1,
      refundKrw: 4400,
    });
    expect(r.allTime).toEqual({ count: 3, krw: 5500 + 2200 + 1100, buyers: 2 });
    expect(r.daily).toHaveLength(7);
    expect(r.daily.reduce((s, d) => s + d.krw, 0)).toBe(6600);
    expect(r.products.find((p) => p.productId === 'com.offsidelab.app.scout_5')).toEqual({
      productId: 'com.offsidelab.app.scout_5',
      count: 0,
      krw: 0,
      refunded: 1,
    });
    expect(r.removeAds).toMatchObject({ count: 1, refunds: 0, krw: 3300 });
    expect(r.recent.map((x) => x.productId)).not.toContain(undefined);
    expect(r.recent).toHaveLength(4);
    expect((await call('GET', '/v1/admin/revenue?days=5', { cookie: admin.cookie })).status).toBe(
      400,
    );
  });

  it('T-11-263 매출 기간은 KST 자정부터 센다', () => {
    const w = kstWindow(new Date('2026-10-14T16:00:00.000Z'), 2);
    expect(w).toEqual({ start: '2026-10-13T15:00:00.000Z', days: ['2026-10-14', '2026-10-15'] });
  });

  it('비정상 기록: 숨겨진 커리어를 보고 되돌리거나 다시 숨긴다', async () => {
    const admin = await makeAdmin();
    const user = await googleUser('팬');
    const now = new Date().toISOString();
    await ctx.db.insert(careers).values({
      id: 'car-x',
      profileId: user.profileId,
      pos: 'FW',
      foot: '오른발',
      type: 'poacher',
      trait: 'late',
      startYear: 2026,
      appVersion: 'test',
      status: 'retired',
      retiredAt: now,
      hidden: 1,
      legendScore: 4480,
      createdAt: now,
      updatedAt: now,
    });
    const report = async () =>
      data<AnomalyReport>(await call('GET', '/v1/admin/anomalies', { cookie: admin.cookie }));
    expect((await report()).hidden.map((c) => c.careerId)).toEqual(['car-x']);

    const toggle = (hidden: boolean, careerId = 'car-x') =>
      call('POST', '/v1/admin/careers/hidden', {
        cookie: admin.cookie,
        body: { careerId, hidden },
      });
    expect((await toggle(false)).status).toBe(204);
    expect((await report()).hidden).toEqual([]);
    expect((await toggle(true)).status).toBe(204);
    expect((await report()).hidden.map((c) => c.careerId)).toEqual(['car-x']);
    expect((await toggle(true, 'nope')).status).toBe(404);
  });

  it('대시보드: 가입·활동·커리어·댓글 수와 최근 14일(KST) 추이', async () => {
    const admin = await makeAdmin();
    const user = await googleUser('팬');
    const now = new Date().toISOString();
    const row = {
      profileId: user.profileId,
      pos: 'FW',
      foot: '오른발',
      type: 'poacher',
      trait: 'late',
      startYear: 2026,
      appVersion: 'test',
      createdAt: now,
      updatedAt: now,
    } as const;
    await ctx.db.insert(careers).values([
      { ...row, id: 'car-1', status: 'active' },
      { ...row, id: 'car-2', status: 'retired', retiredAt: now },
    ]);
    const postId = await writePost(admin.cookie);
    await comment(user.cookie, postId, '좋아요');

    const res = await call('GET', '/v1/admin/stats', { cookie: admin.cookie });
    expect(res.status).toBe(200);
    const s = await data<AdminStats>(res);
    expect(s.profiles).toEqual({
      total: 2,
      linked: 2,
      new24h: 2,
      new7d: 2,
      active24h: 2,
      active7d: 2,
    });
    expect(s.careers).toEqual({ total: 2, active: 1, retired: 1, new7d: 2, retired7d: 1 });
    expect(s.board).toEqual({ posts: 1, comments: 1, comments7d: 1 });
    expect(s.daily).toHaveLength(14);
    expect(s.daily.at(-1)).toMatchObject({ profiles: 2, careers: 2, retired: 1 });
    expect(s.daily.slice(0, -1).every((d) => d.profiles === 0)).toBe(true);
    expect(s.balance).toBeNull();
  });

  it('KST 날짜 경계: UTC 15:00 이후는 다음 날이다', () => {
    const { days, startIso } = kstDays(new Date('2026-09-25T15:30:00.000Z'), 3);
    expect(days).toEqual(['2026-09-24', '2026-09-25', '2026-09-26']);
    expect(startIso).toBe('2026-09-23T15:00:00.000Z');
  });

  it('댓글 관리: 전체 최근 댓글 · 작성자별 · 작성자 댓글 모두 지우기(감사 로그)', async () => {
    const admin = await makeAdmin();
    const spammer = await googleUser('광고맨');
    const fan = await googleUser('팬');
    const postId = await writePost(admin.cookie);
    await comment(spammer.cookie, postId, '광고1');
    await comment(fan.cookie, postId, '응원해요');
    await comment(spammer.cookie, postId, '광고2');

    const all = await data<AdminCommentList>(
      await call('GET', '/v1/admin/comments?limit=2', { cookie: admin.cookie }),
    );
    expect(all.comments.map((c) => c.body)).toEqual(['광고2', '응원해요']);
    expect(all.hasMore).toBe(true);
    expect(all.comments[0]).toMatchObject({
      postId,
      postTitle: '점검 안내',
      board: 'notice',
      profileId: spammer.profileId,
    });
    const next = await data<AdminCommentList>(
      await call('GET', `/v1/admin/comments?limit=2&before=${all.comments[1]!.createdAt}`, {
        cookie: admin.cookie,
      }),
    );
    expect(next.comments.map((c) => c.body)).toEqual(['광고1']);

    const mine = await data<AdminCommentList>(
      await call('GET', `/v1/admin/comments?profile=${spammer.profileId}`, {
        cookie: admin.cookie,
      }),
    );
    expect(mine.comments.map((c) => c.body)).toEqual(['광고2', '광고1']);

    const purge = await call('POST', '/v1/admin/comments/purge', {
      cookie: admin.cookie,
      body: { profileId: spammer.profileId },
    });
    expect(await data(purge)).toEqual({ deleted: 2 });
    const left = await data<AdminCommentList>(
      await call('GET', '/v1/admin/comments', { cookie: admin.cookie }),
    );
    expect(left.comments.map((c) => c.body)).toEqual(['응원해요']);
    const [log] = await ctx.db.select().from(auditLog).where(eq(auditLog.kind, 'COMMENTS_PURGED'));
    expect(JSON.parse(log!.payloadJson)).toEqual({ target: spammer.profileId, deleted: 2 });
    expect(log!.profileId).toBe(admin.profileId);

    expect(
      (await call('GET', '/v1/admin/comments?profile=nope', { cookie: admin.cookie })).status,
    ).toBe(400);
  });
  it('자동 플레이 탐지: 시즌 업로드의 조작 요약·헤드리스 UA를 남기고, 의심 프로필을 모아 보여 준다', async () => {
    const admin = await makeAdmin();
    const bot = await issueCookie(ctx);
    const human = await issueCookie(ctx);
    const signals = {
      ms: 50_000,
      clicks: 0,
      keys: 0,
      touches: 0,
      moves: 0,
      synthetic: 12,
      hiddenMs: 0,
      webdriver: true,
    };
    const id = (n: number) => `0e000000-0000-4000-8000-00000000000${n}`;
    for (const y of [2026, 2027, 2028]) {
      const res = await call('PUT', `/v1/careers/${id(1)}/seasons/${y}`, {
        cookie: bot.cookie,
        headers: { 'User-Agent': 'Mozilla/5.0 HeadlessChrome/140.0' },
        body: { ...seasonBody(), signals },
      });
      expect(res.status).toBe(200);
      await call('PUT', `/v1/careers/${id(2)}/seasons/${y}`, {
        cookie: human.cookie,
        body: seasonBody(),
      });
    }
    // 조작 요약이 없는 재전송은 남긴 요약을 지우지 않는다.
    await call('PUT', `/v1/careers/${id(1)}/seasons/2028`, {
      cookie: bot.cookie,
      body: seasonBody(),
    });
    // 모양이 틀린 요약은 버리고 시즌은 받는다(요약도 지우지 않는다).
    expect(
      (
        await call('PUT', `/v1/careers/${id(1)}/seasons/2028`, {
          cookie: bot.cookie,
          body: { ...seasonBody(), signals: { ...signals, clicks: -1, extra: 1 } },
        })
      ).status,
    ).toBe(200);

    const res = await call('GET', '/v1/admin/automation?hours=2', { cookie: admin.cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const report = await data<AutomationReport>(res);
    expect(report).toMatchObject({ hours: 2, profiles: 2 });
    expect(report.suspects).toHaveLength(1);
    expect(report.suspects[0]).toMatchObject({
      profile: bot.profileId.slice(0, 8),
      level: 'high',
      seasons: 3,
      careers: [{ careerId: id(1), seasons: 3 }],
    });
    expect(report.suspects[0]!.reasons).toEqual(
      expect.arrayContaining(['webdriver', 'headless', 'synthetic', 'noInput']),
    );
    expect(
      (await call('GET', '/v1/admin/automation?hours=48', { cookie: admin.cookie })).status,
    ).toBe(400);
  });
});
