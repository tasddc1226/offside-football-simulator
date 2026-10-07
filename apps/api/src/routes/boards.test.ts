import { ErrorEnvelopeSchema } from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  authAttempts,
  boardBlocks,
  boardCommentReports,
  boardComments,
  boardPostLikes,
  boardPosts,
  profiles,
} from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import {
  ADMIN_EMAIL,
  callJson,
  deleteProfile,
  issueAdminCookie,
  issueCookie,
  issueGoogleCookie,
} from '../test/http.js';
import { flushEdge, installFakeEdgeCache } from '../test/edgeCache.js';
import { STALE } from '../edgeKeys.js';

describe('게시판 /v1/boards', () => {
  let ctx: TestD1;
  let env: TestD1['env'];
  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(env, method, path, opts);

  // 관리자는 프로필 닉네임과 무관하게 '운영자'로 댓글을 쓴다(일부러 다른 닉네임을 넣어 둔다).
  const makeAdmin = () => issueAdminCookie(ctx, { nickname: '관리' });
  /** 구글로 로그인한 일반 프로필. nickname이 null이면 아직 닉네임을 정하지 않은 상태. */
  const googleUser = (nickname: string | null) => issueGoogleCookie(ctx, { nickname });
  async function writePost(cookie: string, board = 'notice', body: Record<string, unknown> = {}) {
    const res = await call('POST', `/v1/boards/${board}/posts`, {
      cookie,
      body: { title: '점검 안내', body: '오늘 밤 점검합니다.', ...body },
    });
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

  it('자동 릴리즈 노트의 날짜형 ID로 조회·조회수·댓글·좋아요·관리자 수정이 가능하고 권한을 유지한다', async () => {
    const admin = await makeAdmin();
    const original = await writePost(admin.cookie, 'release', { title: '261004 릴리즈노트' });
    const id = 'pst_release_20261004';
    await ctx.db.update(boardPosts).set({ id }).where(eq(boardPosts.id, original));

    const read = await call('GET', `/v1/boards/posts/${id}`);
    expect(read.status).toBe(200);
    expect(((await read.json()) as { data: { post: { id: string } } }).data.post.id).toBe(id);
    expect((await call('POST', `/v1/boards/posts/${id}/views`)).status).toBe(204);
    expect((await call('PUT', `/v1/boards/posts/${id}/like`)).status).toBe(401);

    const reader = await googleUser('독자');
    expect(
      (await call('PUT', `/v1/boards/posts/${id}/like`, { cookie: reader.cookie })).status,
    ).toBe(200);
    expect(
      (
        await call('POST', `/v1/boards/posts/${id}/comments`, {
          cookie: reader.cookie,
          body: { body: '업데이트 감사합니다.' },
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await call('PUT', `/v1/boards/posts/${id}`, {
          cookie: reader.cookie,
          body: { title: '수정', body: '수정' },
        })
      ).status,
    ).toBe(403);
    expect((await call('DELETE', `/v1/boards/posts/${id}`, { cookie: reader.cookie })).status).toBe(
      403,
    );
    expect(
      (
        await call('PUT', `/v1/boards/posts/${id}`, {
          cookie: admin.cookie,
          body: { title: '261004 릴리즈노트', body: '업데이트 안내' },
        })
      ).status,
    ).toBe(200);
  });

  it('날짜형 ID는 자동 릴리즈 글에만 허용하고 잘못된 형식은 거부한다', async () => {
    for (const id of [
      'pst_release_2026100',
      'pst_release_2026100a',
      'pst_release_20261004_extra',
      'cmt_release_20261004',
    ]) {
      expect((await call('GET', `/v1/boards/posts/${id}`)).status).toBe(400);
    }
    expect((await call('GET', '/v1/boards/posts/pst_release_20261005')).status).toBe(404);
    const reader = await googleUser('독자');
    expect(
      (await call('DELETE', '/v1/boards/comments/cmt_release_20261004', { cookie: reader.cookie }))
        .status,
    ).toBe(400);
  });

  it('관리자만 글을 쓴다 — 세션 없음 401, 일반 프로필 403, 관리자 201', async () => {
    expect(
      (await call('POST', '/v1/boards/notice/posts', { body: { title: 't', body: 'b' } })).status,
    ).toBe(401);
    const user = await issueCookie(ctx);
    const res = await call('POST', '/v1/boards/notice/posts', {
      cookie: user.cookie,
      body: { title: 't', body: 'b' },
    });
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
    expect(
      (
        await call('POST', '/v1/boards/notice/posts', {
          cookie: admin.cookie,
          body: { title: 't', body: 'b' },
        })
      ).status,
    ).toBe(403);
    env = { ...ctx.env, ADMIN_EMAILS: ADMIN_EMAIL };
    await ctx.db.update(profiles).set({ googleSub: null }).where(eq(profiles.id, admin.profileId));
    expect(
      (
        await call('POST', '/v1/boards/notice/posts', {
          cookie: admin.cookie,
          body: { title: 't', body: 'b' },
        })
      ).status,
    ).toBe(403);
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
    const next = (await (
      await call('GET', `/v1/boards/notice/posts?limit=1&before=${first.data.posts[1]!.createdAt}`)
    ).json()) as {
      data: { posts: { id: string }[]; hasMore: boolean };
    };
    expect(next.data.posts.map((p) => p.id)).toEqual([a]);
    expect(next.data.hasMore).toBe(false);

    const release = (await (await call('GET', '/v1/boards/release/posts')).json()) as {
      data: { posts: { version: string }[] };
    };
    expect(release.data.posts.map((p) => p.version)).toEqual(['v1.1.0']);
    expect((await call('GET', '/v1/boards/bug/posts')).status).toBe(400);
  });

  it('번역: 요청 언어의 제목·본문을 주고 없으면 한국어, 관리자만 원문을 받는다', async () => {
    const admin = await makeAdmin();
    const en = { title: 'Maintenance', body: 'Maintenance tonight.' };
    const id = await writePost(admin.cookie, 'notice', { i18n: { en } });
    type Detail = { data: { post: { title: string; body: string }; source: unknown } };
    const detail = async (lang: string, cookie?: string) =>
      (await (
        await call('GET', `/v1/boards/posts/${id}${lang}`, cookie ? { cookie } : {})
      ).json()) as Detail;
    const titles = async (lang: string) =>
      (
        (await (await call('GET', `/v1/boards/notice/posts${lang}`)).json()) as {
          data: { posts: { title: string }[] };
        }
      ).data.posts.map((p) => p.title);

    // 목록 캐시는 언어와 상관없이 키 하나 — 담긴 번역 제목에서 요청 언어를 고른다.
    const edge = installFakeEdgeCache();
    try {
      expect(await titles('')).toEqual(['점검 안내']);
      await flushEdge();
      expect(await titles('?lang=en')).toEqual(['Maintenance']);
      expect(await titles('?lang=ja')).toEqual(['점검 안내']);
      await flushEdge();
    } finally {
      edge.uninstall();
    }
    expect([...edge.store.keys()]).toEqual(['http://localhost/v1/boards/notice/posts?limit=20']);
    expect((await detail('?lang=en')).data).toMatchObject({ post: en, source: null });
    expect((await detail('?lang=ja')).data.post.body).toBe('오늘 밤 점검합니다.');
    expect((await detail('?lang=en', admin.cookie)).data.source).toEqual({
      title: '점검 안내',
      body: '오늘 밤 점검합니다.',
      i18n: { en },
    });

    // 번역을 보내지 않는 옛 운영 도구의 수정은 번역을 지우지 않는다. 빈 번역은 지운다.
    const put = (body: Record<string, unknown>) =>
      call('PUT', `/v1/boards/posts/${id}`, {
        cookie: admin.cookie,
        body: { title: '점검 안내', body: '바뀐 본문', ...body },
      });
    expect((await put({})).status).toBe(200);
    expect((await detail('?lang=en')).data.post).toEqual(expect.objectContaining(en));
    expect((await put({ i18n: {} })).status).toBe(200);
    expect((await detail('?lang=en')).data.post.body).toBe('바뀐 본문');
    expect((await put({ i18n: { ja: { title: '点検', body: '' } } })).status).toBe(400);
  });

  it('번역 초안: 관리자만, 키가 없으면 503', async () => {
    const input = { body: { title: '점검', body: '점검해요' } };
    expect((await call('POST', '/v1/boards/translate', input)).status).toBe(401);
    const user = await issueCookie(ctx);
    expect(
      (await call('POST', '/v1/boards/translate', { ...input, cookie: user.cookie })).status,
    ).toBe(403);
    const admin = await makeAdmin();
    expect(
      (await call('POST', '/v1/boards/translate', { ...input, cookie: admin.cookie })).status,
    ).toBe(503);
  });

  it('수정·삭제: 지운 글은 목록·상세에서 사라진다', async () => {
    const admin = await makeAdmin();
    const id = await writePost(admin.cookie);
    const put = await call('PUT', `/v1/boards/posts/${id}`, {
      cookie: admin.cookie,
      body: { title: '수정됨', body: '본문', pinned: true },
    });
    expect(put.status).toBe(200);
    expect(((await put.json()) as { data: { title: string; pinned: boolean } }).data).toMatchObject(
      { title: '수정됨', pinned: true },
    );
    expect((await call('DELETE', `/v1/boards/posts/${id}`, { cookie: admin.cookie })).status).toBe(
      204,
    );
    expect((await call('GET', `/v1/boards/posts/${id}`)).status).toBe(404);
    expect((await call('DELETE', `/v1/boards/posts/${id}`, { cookie: admin.cookie })).status).toBe(
      404,
    );
  });

  it('댓글: 구글 로그인한 사람이 프로필 닉네임으로 쓰고, 본인·관리자만 지운다. 관리자 댓글은 표시된다', async () => {
    const admin = await makeAdmin();
    const id = await writePost(admin.cookie);
    expect(
      (await call('POST', `/v1/boards/posts/${id}/comments`, { body: { body: '좋아요' } })).status,
    ).toBe(401);

    const alice = await googleUser('앨리스');
    const bob = await googleUser('밥');
    // 옛 클라이언트가 보내는 nickname은 무시하고 프로필 닉네임을 쓴다.
    const res = await call('POST', `/v1/boards/posts/${id}/comments`, {
      cookie: alice.cookie,
      body: { nickname: '가짜', body: '기대돼요' },
    });
    expect(res.status).toBe(201);
    const commentId = ((await res.json()) as { data: { id: string } }).data.id;
    await call('POST', `/v1/boards/posts/${id}/comments`, {
      cookie: admin.cookie,
      body: { body: '감사합니다' },
    });

    const asBob = (await (
      await call('GET', `/v1/boards/posts/${id}`, { cookie: bob.cookie })
    ).json()) as {
      data: {
        post: { commentCount: number };
        comments: { nickname: string; admin: boolean; deletable: boolean }[];
      };
    };
    expect(asBob.data.post.commentCount).toBe(2);
    expect(asBob.data.comments).toMatchObject([
      { nickname: '앨리스', admin: false, deletable: false },
      { nickname: '운영자', admin: true, deletable: false },
    ]);
    expect(
      (await call('DELETE', `/v1/boards/comments/${commentId}`, { cookie: bob.cookie })).status,
    ).toBe(403);
    expect(
      (await call('DELETE', `/v1/boards/comments/${commentId}`, { cookie: alice.cookie })).status,
    ).toBe(204);
    const after = (await (await call('GET', `/v1/boards/posts/${id}`)).json()) as {
      data: { comments: unknown[] };
    };
    expect(after.data.comments).toHaveLength(1);
  });

  it('댓글을 지우면 그 게시판 목록 캐시(댓글 수)도 비운다', async () => {
    const admin = await makeAdmin();
    const id = await writePost(admin.cookie, 'release');
    const alice = await googleUser('앨리스');
    const res = await call('POST', `/v1/boards/posts/${id}/comments`, {
      cookie: alice.cookie,
      body: { body: '기대돼요' },
    });
    const commentId = ((await res.json()) as { data: { id: string } }).data.id;
    const edge = installFakeEdgeCache();
    try {
      expect(
        (await call('DELETE', `/v1/boards/comments/${commentId}`, { cookie: alice.cookie })).status,
      ).toBe(204);
      await flushEdge();
    } finally {
      edge.uninstall();
    }
    expect(edge.purged).toEqual(
      STALE.boardChanged('release').map((path) => `http://localhost${path}`),
    );
  });

  it('댓글: 구글 로그인이 없으면 403, 닉네임이 없으면 403 — viewer가 그 상태를 알려 준다', async () => {
    const admin = await makeAdmin();
    const id = await writePost(admin.cookie);
    const reasonOf = async (res: Response) => {
      expect(res.status).toBe(403);
      return (
        ErrorEnvelopeSchema.parse(await res.json()).error.details as { reason?: string } | undefined
      )?.reason;
    };
    const viewerOf = async (cookie?: string) =>
      (
        (await (await call('GET', '/v1/boards/viewer', cookie ? { cookie } : {})).json()) as {
          data: { admin: boolean; google: boolean; nickname: string | null };
        }
      ).data;

    const anon = await issueCookie(ctx);
    expect(
      await reasonOf(
        await call('POST', `/v1/boards/posts/${id}/comments`, {
          cookie: anon.cookie,
          body: { body: '안녕' },
        }),
      ),
    ).toBe('GOOGLE_LOGIN_REQUIRED');
    expect(await viewerOf(anon.cookie)).toEqual({ admin: false, google: false, nickname: null });
    expect(await viewerOf()).toEqual({ admin: false, google: false, nickname: null });

    const fresh = await googleUser(null);
    expect(
      await reasonOf(
        await call('POST', `/v1/boards/posts/${id}/comments`, {
          cookie: fresh.cookie,
          body: { body: '안녕' },
        }),
      ),
    ).toBe('NICKNAME_REQUIRED');
    expect(await viewerOf(fresh.cookie)).toEqual({ admin: false, google: true, nickname: null });
    expect(await viewerOf(admin.cookie)).toEqual({ admin: true, google: true, nickname: '운영자' });
  });

  it('댓글 필터·횟수 제한·없는 글', async () => {
    const admin = await makeAdmin();
    const id = await writePost(admin.cookie);
    const user = await googleUser('팬');
    const blocked = await call('POST', `/v1/boards/posts/${id}/comments`, {
      cookie: user.cookie,
      body: { body: '씨 발 뭐야' },
    });
    expect(blocked.status).toBe(400);
    expect(
      (
        await call('POST', '/v1/boards/posts/pst_00000000-0000-0000-0000-000000000000/comments', {
          cookie: user.cookie,
          body: { body: 'b' },
        })
      ).status,
    ).toBe(404);

    await ctx.db.insert(authAttempts).values({
      id: 'att_x',
      kind: 'BOARD_COMMENT',
      subject: user.profileId,
      windowStart: new Date().toISOString(),
      count: 10,
    });
    const limited = await call('POST', `/v1/boards/posts/${id}/comments`, {
      cookie: user.cookie,
      body: { body: '또' },
    });
    expect(limited.status).toBe(429);
    // 관리자는 제한이 없다.
    for (let i = 0; i < 11; i++) {
      expect(
        (
          await call('POST', `/v1/boards/posts/${id}/comments`, {
            cookie: admin.cookie,
            body: { body: `${i}` },
          })
        ).status,
      ).toBe(201);
    }
  });

  type Detail = {
    data: {
      comments: { id: string; nickname: string; deletable: boolean }[];
      blocks: { id: string; nickname: string }[];
    };
  };
  const detailOf = async (id: string, cookie?: string) =>
    (await (
      await call('GET', `/v1/boards/posts/${id}`, cookie ? { cookie } : {})
    ).json()) as Detail;
  async function comment(postId: string, cookie: string, body: string) {
    const res = await call('POST', `/v1/boards/posts/${postId}/comments`, {
      cookie,
      body: { body },
    });
    expect(res.status).toBe(201);
    return ((await res.json()) as { data: { id: string } }).data.id;
  }

  it('신고: 남의 댓글만, 한 번만 남고 신고한 사람 화면에서 빠진다. 관리자 목록에 신고 수가 보인다', async () => {
    const admin = await makeAdmin();
    const id = await writePost(admin.cookie);
    const alice = await googleUser('앨리스');
    const bad = await comment(id, alice.cookie, '광고입니다');
    const anon = await issueCookie(ctx); // 구글 로그인 없이도 프로필만 있으면 신고한다.
    const report = (cookie: string | undefined, reason = 'spam', cid = bad) =>
      call('POST', `/v1/boards/comments/${cid}/report`, {
        ...(cookie ? { cookie } : {}),
        body: { reason },
      });

    expect((await report(undefined)).status).toBe(401);
    expect((await report(anon.cookie, 'nope')).status).toBe(400);
    expect((await report(alice.cookie)).status).toBe(403); // 내 댓글
    expect((await report(anon.cookie)).status).toBe(204);
    expect((await report(anon.cookie, 'abuse')).status).toBe(204); // 멱등(처음 사유 유지)
    expect(
      (await report(anon.cookie, 'spam', 'cmt_00000000-0000-0000-0000-000000000000')).status,
    ).toBe(404);
    expect(await ctx.db.select().from(boardCommentReports)).toMatchObject([
      { commentId: bad, profileId: anon.profileId, reason: 'spam' },
    ]);

    expect((await detailOf(id, anon.cookie)).data.comments).toHaveLength(0);
    expect((await detailOf(id, alice.cookie)).data.comments).toMatchObject([
      { id: bad, deletable: true },
    ]);
    const list = (await (
      await call('GET', '/v1/admin/comments?reported=1', { cookie: admin.cookie })
    ).json()) as { data: { comments: { id: string; reports: number }[] } };
    expect(list.data.comments).toMatchObject([{ id: bad, reports: 1 }]);
  });

  it('차단: 작성자의 댓글이 모두 빠지고, 차단 목록에서 풀 수 있다. 운영자·나는 차단하지 않는다', async () => {
    const admin = await makeAdmin();
    const id = await writePost(admin.cookie);
    const alice = await googleUser('앨리스');
    const bob = await googleUser('밥');
    const a1 = await comment(id, alice.cookie, '하나');
    await comment(id, alice.cookie, '둘');
    await comment(id, bob.cookie, '밥 댓글');
    const fromAdmin = await comment(id, admin.cookie, '공지 답변');
    const block = (cookie: string, cid: string) =>
      call('POST', `/v1/boards/comments/${cid}/block`, { cookie });

    expect((await block(bob.cookie, fromAdmin)).status).toBe(403);
    expect((await block(alice.cookie, a1)).status).toBe(403);
    const res = await block(bob.cookie, a1);
    expect(res.status).toBe(201);
    const blk = ((await res.json()) as { data: { id: string; nickname: string } }).data;
    expect(blk.nickname).toBe('앨리스');
    expect(((await (await block(bob.cookie, a1)).json()) as { data: { id: string } }).data.id).toBe(
      blk.id,
    ); // 멱등

    const asBob = await detailOf(id, bob.cookie);
    expect(asBob.data.comments.map((c) => c.nickname)).toEqual(['밥', '운영자']);
    expect(asBob.data.blocks).toMatchObject([{ id: blk.id, nickname: '앨리스' }]);
    expect((await detailOf(id)).data.comments).toHaveLength(4); // 다른 사람에겐 그대로

    expect(
      (await call('DELETE', `/v1/boards/blocks/${blk.id}`, { cookie: alice.cookie })).status,
    ).toBe(404); // 남의 차단은 못 푼다
    expect(
      (await call('DELETE', `/v1/boards/blocks/${blk.id}`, { cookie: bob.cookie })).status,
    ).toBe(204);
    expect((await detailOf(id, bob.cookie)).data.comments).toHaveLength(4);
  });

  it('프로필을 지우면 신고·차단 기록(차단당한 기록 포함)도 지워진다', async () => {
    const admin = await makeAdmin();
    const id = await writePost(admin.cookie);
    const alice = await googleUser('앨리스');
    const bob = await googleUser('밥');
    const a = await comment(id, alice.cookie, '앨리스');
    const b = await comment(id, bob.cookie, '밥');
    await call('POST', `/v1/boards/comments/${a}/report`, {
      cookie: bob.cookie,
      body: { reason: 'abuse' },
    });
    await call('POST', `/v1/boards/comments/${a}/block`, { cookie: bob.cookie });
    await call('POST', `/v1/boards/comments/${b}/block`, { cookie: alice.cookie });
    expect((await deleteProfile(env, bob.cookie, 'idem-board-block-del')).status).toBe(204);
    expect(await ctx.db.select().from(boardCommentReports)).toHaveLength(0);
    expect(await ctx.db.select().from(boardBlocks)).toHaveLength(0);
  });

  it('프로필을 지우면 그 사람의 댓글도 지워진다', async () => {
    const admin = await makeAdmin();
    const id = await writePost(admin.cookie);
    const user = await googleUser('팬');
    expect(
      (
        await call('POST', `/v1/boards/posts/${id}/comments`, {
          cookie: user.cookie,
          body: { body: '안녕' },
        })
      ).status,
    ).toBe(201);
    expect((await deleteProfile(env, user.cookie, 'idem-board-del')).status).toBe(204);
    expect(
      await ctx.db.select().from(boardComments).where(eq(boardComments.profileId, user.profileId)),
    ).toHaveLength(0);
  });

  it('조회수: 누구나 한 번 보낼 때마다 +1, 목록·상세에 보인다. 없는 글은 404', async () => {
    const admin = await makeAdmin();
    const id = await writePost(admin.cookie);
    expect((await call('POST', `/v1/boards/posts/${id}/views`)).status).toBe(204);
    expect((await call('POST', `/v1/boards/posts/${id}/views`)).status).toBe(204);
    expect(
      (await call('POST', '/v1/boards/posts/pst_00000000-0000-4000-8000-000000000000/views'))
        .status,
    ).toBe(404);
    const list = (await (await call('GET', '/v1/boards/notice/posts?limit=5')).json()) as {
      data: { posts: { viewCount: number; likeCount: number }[] };
    };
    expect(list.data.posts[0]).toMatchObject({ viewCount: 2, likeCount: 0 });
  });

  it('좋아요: 프로필이 있으면 누르고 거둔다(멱등). 상세는 내가 눌렀는지 알려 준다', async () => {
    const admin = await makeAdmin();
    const id = await writePost(admin.cookie);
    expect((await call('PUT', `/v1/boards/posts/${id}/like`)).status).toBe(401);
    const alice = await issueCookie(ctx);
    const bob = await issueCookie(ctx);
    const like = async (cookie: string, method = 'PUT') =>
      (
        (await (await call(method, `/v1/boards/posts/${id}/like`, { cookie })).json()) as {
          data: { liked: boolean; likeCount: number };
        }
      ).data;
    expect(await like(alice.cookie)).toEqual({ liked: true, likeCount: 1 });
    expect(await like(alice.cookie)).toEqual({ liked: true, likeCount: 1 });
    expect(await like(bob.cookie)).toEqual({ liked: true, likeCount: 2 });
    expect(await like(bob.cookie, 'DELETE')).toEqual({ liked: false, likeCount: 1 });
    expect(await like(bob.cookie, 'DELETE')).toEqual({ liked: false, likeCount: 1 });

    const detail = async (cookie?: string) =>
      (
        (await (await call('GET', `/v1/boards/posts/${id}`, cookie ? { cookie } : {})).json()) as {
          data: { liked: boolean; post: { likeCount: number } };
        }
      ).data;
    expect(await detail(alice.cookie)).toMatchObject({ liked: true, post: { likeCount: 1 } });
    expect(await detail(bob.cookie)).toMatchObject({ liked: false });
    expect(await detail()).toMatchObject({ liked: false });

    const nope = await call(
      'PUT',
      '/v1/boards/posts/pst_00000000-0000-4000-8000-000000000000/like',
      { cookie: bob.cookie },
    );
    expect(nope.status).toBe(404);
    const del = await call('DELETE', `/v1/boards/posts/${id}`, { cookie: admin.cookie });
    expect(del.status).toBe(204);
    const gone = await call('PUT', `/v1/boards/posts/${id}/like`, { cookie: bob.cookie });
    expect(gone.status).toBe(404);
  });

  it('프로필을 지우면 그 사람의 좋아요도 지워지고 좋아요 수가 줄어든다', async () => {
    const admin = await makeAdmin();
    const id = await writePost(admin.cookie);
    const fan = await googleUser('팬');
    const other = await issueCookie(ctx);
    await call('PUT', `/v1/boards/posts/${id}/like`, { cookie: fan.cookie });
    await call('PUT', `/v1/boards/posts/${id}/like`, { cookie: other.cookie });
    expect((await deleteProfile(env, fan.cookie, 'idem-like-del')).status).toBe(204);
    expect(
      await ctx.db.select().from(boardPostLikes).where(eq(boardPostLikes.profileId, fan.profileId)),
    ).toHaveLength(0);
    const d = (await (await call('GET', `/v1/boards/posts/${id}`)).json()) as {
      data: { post: { likeCount: number } };
    };
    expect(d.data.post.likeCount).toBe(1);
  });
});
