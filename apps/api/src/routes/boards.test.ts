import { ErrorEnvelopeSchema } from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authAttempts, boardComments, profiles } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { ADMIN_EMAIL, callJson, issueAdminCookie, issueCookie, issueGoogleCookie } from '../test/http.js';
import { flushEdge, installFakeEdgeCache } from '../test/edgeCache.js';
import { STALE } from '../edgeKeys.js';

describe('게시판 /v1/boards', () => {
  let ctx: TestD1;
  let env: TestD1['env'];
  const call = (method: string, path: string, opts: { cookie?: string; body?: unknown } = {}) => callJson(env, method, path, opts);

  // 관리자는 프로필 닉네임과 무관하게 '운영자'로 댓글을 쓴다(일부러 다른 닉네임을 넣어 둔다).
  const makeAdmin = () => issueAdminCookie(ctx, { nickname: '관리' });
  /** 구글로 로그인한 일반 프로필. nickname이 null이면 아직 닉네임을 정하지 않은 상태. */
  const googleUser = (nickname: string | null) => issueGoogleCookie(ctx, { nickname });
  async function writePost(cookie: string, board = 'notice', body: Record<string, unknown> = {}) {
    const res = await call('POST', `/v1/boards/${board}/posts`, { cookie, body: { title: '점검 안내', body: '오늘 밤 점검합니다.', ...body } });
    expect(res.status).toBe(201);
    return ((await res.json()) as { data: { id: string } }).data.id;
  }

  beforeEach(async () => {
    ctx = await createTestD1();
    env = { ...ctx.env, ADMIN_EMAILS: ` other@example.com, ${ADMIN_EMAIL.toUpperCase()} ` };
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('관리자만 글을 쓴다 — 세션 없음 401, 일반 프로필 403, 관리자 201', async () => {
    expect((await call('POST', '/v1/boards/notice/posts', { body: { title: 't', body: 'b' } })).status).toBe(401);
    const user = await issueCookie(ctx);
    const res = await call('POST', '/v1/boards/notice/posts', { cookie: user.cookie, body: { title: 't', body: 'b' } });
    expect(res.status).toBe(403);
    expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('FORBIDDEN');
    const admin = await makeAdmin();
    await writePost(admin.cookie);
    const viewer = await call('GET', '/v1/boards/viewer', { cookie: admin.cookie });
    expect(((await viewer.json()) as { data: { admin: boolean } }).data.admin).toBe(true);
  });

  it('구글 연결이 없거나 ADMIN_EMAILS가 비면 관리자가 아니다', async () => {
    const admin = await makeAdmin();
    env = { ...ctx.env };
    expect((await call('POST', '/v1/boards/notice/posts', { cookie: admin.cookie, body: { title: 't', body: 'b' } })).status).toBe(403);
    env = { ...ctx.env, ADMIN_EMAILS: ADMIN_EMAIL };
    await ctx.db.update(profiles).set({ googleSub: null }).where(eq(profiles.id, admin.profileId));
    expect((await call('POST', '/v1/boards/notice/posts', { cookie: admin.cookie, body: { title: 't', body: 'b' } })).status).toBe(403);
  });

  it('목록: 보드별로 나뉘고, 고정 글이 먼저, 페이지를 넘긴다', async () => {
    const admin = await makeAdmin();
    const a = await writePost(admin.cookie, 'notice', { title: '첫 공지' });
    const pinned = await writePost(admin.cookie, 'notice', { title: '고정 공지', pinned: true });
    const b = await writePost(admin.cookie, 'notice', { title: '둘째 공지' });
    await writePost(admin.cookie, 'release', { title: 'v1.1.0', version: 'v1.1.0' });

    const first = (await (await call('GET', '/v1/boards/notice/posts?limit=1')).json()) as {
      data: { posts: { id: string; createdAt: string; pinned: boolean }[]; hasMore: boolean };
    };
    expect(first.data.posts.map((p) => p.id)).toEqual([pinned, b]);
    expect(first.data.hasMore).toBe(true);
    const next = (await (await call('GET', `/v1/boards/notice/posts?limit=1&before=${first.data.posts[1]!.createdAt}`)).json()) as {
      data: { posts: { id: string }[]; hasMore: boolean };
    };
    expect(next.data.posts.map((p) => p.id)).toEqual([a]);
    expect(next.data.hasMore).toBe(false);

    const release = (await (await call('GET', '/v1/boards/release/posts')).json()) as { data: { posts: { version: string }[] } };
    expect(release.data.posts.map((p) => p.version)).toEqual(['v1.1.0']);
    expect((await call('GET', '/v1/boards/bug/posts')).status).toBe(400);
  });

  it('수정·삭제: 지운 글은 목록·상세에서 사라진다', async () => {
    const admin = await makeAdmin();
    const id = await writePost(admin.cookie);
    const put = await call('PUT', `/v1/boards/posts/${id}`, { cookie: admin.cookie, body: { title: '수정됨', body: '본문', pinned: true } });
    expect(put.status).toBe(200);
    expect(((await put.json()) as { data: { title: string; pinned: boolean } }).data).toMatchObject({ title: '수정됨', pinned: true });
    expect((await call('DELETE', `/v1/boards/posts/${id}`, { cookie: admin.cookie })).status).toBe(204);
    expect((await call('GET', `/v1/boards/posts/${id}`)).status).toBe(404);
    expect((await call('DELETE', `/v1/boards/posts/${id}`, { cookie: admin.cookie })).status).toBe(404);
  });

  it('댓글: 구글 로그인한 사람이 프로필 닉네임으로 쓰고, 본인·관리자만 지운다. 관리자 댓글은 표시된다', async () => {
    const admin = await makeAdmin();
    const id = await writePost(admin.cookie);
    expect((await call('POST', `/v1/boards/posts/${id}/comments`, { body: { body: '좋아요' } })).status).toBe(401);

    const alice = await googleUser('앨리스');
    const bob = await googleUser('밥');
    // 옛 클라이언트가 보내는 nickname은 무시하고 프로필 닉네임을 쓴다.
    const res = await call('POST', `/v1/boards/posts/${id}/comments`, { cookie: alice.cookie, body: { nickname: '가짜', body: '기대돼요' } });
    expect(res.status).toBe(201);
    const commentId = ((await res.json()) as { data: { id: string } }).data.id;
    await call('POST', `/v1/boards/posts/${id}/comments`, { cookie: admin.cookie, body: { body: '감사합니다' } });

    const asBob = (await (await call('GET', `/v1/boards/posts/${id}`, { cookie: bob.cookie })).json()) as {
      data: { post: { commentCount: number }; comments: { nickname: string; admin: boolean; deletable: boolean }[] };
    };
    expect(asBob.data.post.commentCount).toBe(2);
    expect(asBob.data.comments).toMatchObject([
      { nickname: '앨리스', admin: false, deletable: false },
      { nickname: '운영자', admin: true, deletable: false },
    ]);
    expect((await call('DELETE', `/v1/boards/comments/${commentId}`, { cookie: bob.cookie })).status).toBe(403);
    expect((await call('DELETE', `/v1/boards/comments/${commentId}`, { cookie: alice.cookie })).status).toBe(204);
    const after = (await (await call('GET', `/v1/boards/posts/${id}`)).json()) as { data: { comments: unknown[] } };
    expect(after.data.comments).toHaveLength(1);
  });

  it('댓글을 지우면 그 게시판 목록 캐시(댓글 수)도 비운다', async () => {
    const admin = await makeAdmin();
    const id = await writePost(admin.cookie, 'release');
    const alice = await googleUser('앨리스');
    const res = await call('POST', `/v1/boards/posts/${id}/comments`, { cookie: alice.cookie, body: { body: '기대돼요' } });
    const commentId = ((await res.json()) as { data: { id: string } }).data.id;
    const edge = installFakeEdgeCache();
    try {
      expect((await call('DELETE', `/v1/boards/comments/${commentId}`, { cookie: alice.cookie })).status).toBe(204);
      await flushEdge();
    } finally {
      edge.uninstall();
    }
    expect(edge.purged).toEqual(STALE.boardChanged('release').map((path) => `http://localhost${path}`));
  });

  it('댓글: 구글 로그인이 없으면 403, 닉네임이 없으면 403 — viewer가 그 상태를 알려 준다', async () => {
    const admin = await makeAdmin();
    const id = await writePost(admin.cookie);
    const reasonOf = async (res: Response) => {
      expect(res.status).toBe(403);
      return (ErrorEnvelopeSchema.parse(await res.json()).error.details as { reason?: string } | undefined)?.reason;
    };
    const viewerOf = async (cookie?: string) =>
      ((await (await call('GET', '/v1/boards/viewer', cookie ? { cookie } : {})).json()) as { data: { admin: boolean; google: boolean; nickname: string | null } }).data;

    const anon = await issueCookie(ctx);
    expect(await reasonOf(await call('POST', `/v1/boards/posts/${id}/comments`, { cookie: anon.cookie, body: { body: '안녕' } }))).toBe('GOOGLE_LOGIN_REQUIRED');
    expect(await viewerOf(anon.cookie)).toEqual({ admin: false, google: false, nickname: null });
    expect(await viewerOf()).toEqual({ admin: false, google: false, nickname: null });

    const fresh = await googleUser(null);
    expect(await reasonOf(await call('POST', `/v1/boards/posts/${id}/comments`, { cookie: fresh.cookie, body: { body: '안녕' } }))).toBe('NICKNAME_REQUIRED');
    expect(await viewerOf(fresh.cookie)).toEqual({ admin: false, google: true, nickname: null });
    expect(await viewerOf(admin.cookie)).toEqual({ admin: true, google: true, nickname: '운영자' });
  });

  it('댓글 필터·횟수 제한·없는 글', async () => {
    const admin = await makeAdmin();
    const id = await writePost(admin.cookie);
    const user = await googleUser('팬');
    const blocked = await call('POST', `/v1/boards/posts/${id}/comments`, { cookie: user.cookie, body: { body: '씨 발 뭐야' } });
    expect(blocked.status).toBe(400);
    expect((await call('POST', '/v1/boards/posts/pst_00000000-0000-0000-0000-000000000000/comments', { cookie: user.cookie, body: { body: 'b' } })).status).toBe(404);

    await ctx.db.insert(authAttempts).values({ id: 'att_x', kind: 'BOARD_COMMENT', subject: user.profileId, windowStart: new Date().toISOString(), count: 10 });
    const limited = await call('POST', `/v1/boards/posts/${id}/comments`, { cookie: user.cookie, body: { body: '또' } });
    expect(limited.status).toBe(429);
    // 관리자는 제한이 없다.
    for (let i = 0; i < 11; i++) {
      expect((await call('POST', `/v1/boards/posts/${id}/comments`, { cookie: admin.cookie, body: { body: `${i}` } })).status).toBe(201);
    }
  });

  it('프로필을 지우면 그 사람의 댓글도 지워진다', async () => {
    const admin = await makeAdmin();
    const id = await writePost(admin.cookie);
    const user = await googleUser('팬');
    expect((await call('POST', `/v1/boards/posts/${id}/comments`, { cookie: user.cookie, body: { body: '안녕' } })).status).toBe(201);
    const withKey = (key: string) => ({ cookie: user.cookie, headers: { 'Idempotency-Key': key } });
    const tokenRes = await call('POST', '/v1/profile/delete', withKey('idem-board-del-token'));
    const { confirmToken } = ((await tokenRes.json()) as { data: { confirmToken: string } }).data;
    const del = await call('POST', '/v1/profile/delete', { ...withKey('idem-board-del-confirm'), body: { confirmToken } });
    expect(del.status).toBe(204);
    expect(await ctx.db.select().from(boardComments).where(eq(boardComments.profileId, user.profileId))).toHaveLength(0);
  });
});
