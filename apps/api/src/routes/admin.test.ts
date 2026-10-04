import {
  type AdminCommentList,
  type AdminStats,
  type AnomalyReport,
  type AutomationReport,
} from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { kstDays } from '../time.js';
import { auditLog, careers } from '../db/schema.js';
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
    ] as const) {
      expect((await call(method, path)).status, path).toBe(401);
      expect(
        (await call(method, path, { cookie: user.cookie, body: { profileId: user.profileId } }))
          .status,
        path,
      ).toBe(403);
    }
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
