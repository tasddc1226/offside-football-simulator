import {
  BoardIdParamSchema,
  BoardKeySchema,
  BoardListQuerySchema,
  BoardListResponseSchema,
  BoardBlockSchema,
  BoardViewerResponseSchema,
  CommentInputSchema,
  CommentReportInputSchema,
  CommentSchema,
  PostDetailResponseSchema,
  PostInputSchema,
  PostLikeResponseSchema,
  PostSchema,
} from '@offside/contracts';
import type { Context, Hono } from 'hono';
import { getViewer, requireAdmin } from '../auth/admin.js';
import {
  addView,
  blockAuthor,
  createComment,
  createPost,
  deleteComment,
  deletePost,
  getCommentAuthor,
  getCommentOwner,
  getHiddenFor,
  getPost,
  isLiked,
  listComments,
  listPosts,
  reportComment,
  setLike,
  unblock,
  updatePost,
} from '../db/repos/boards.js';
import { getDb, type AppEnv } from '../env.js';
import { notFoundError, ok, readBody, nowIso, enforceLimit } from './shared.js';
import { AppError, parseWithAppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { resolveSession } from '../middleware/session.js';
import { edgeCached, purgeEdge } from '../edgeCache.js';
import { BOARD_PAGE_LIMIT } from '@offside/contracts/board-limits';
import { EDGE, STALE } from '../edgeKeys.js';
import { hasProfanity } from '@offside/contracts/content-filter';
import { kickNewsPush } from '../push/dispatch.js';

// T-10-011 게시판(공지·릴리즈 노트). 읽기는 누구나, 글은 관리자만, 댓글은 프로필이 있는 누구나.
// T-10-058 조회수는 웹이 기기마다 글 하나에 한 번 보내고, 좋아요는 프로필이 있는 누구나(구글 로그인 없이도).
// 댓글은 프로필당 시간당 COMMENT_LIMIT개까지(관리자 제외).
// 앱스토어 UGC 정책: 프로필이 있는 누구나 남의 댓글을 신고하고 작성자를 차단한다. 신고한 댓글과 차단한 작성자의
// 댓글은 그 사람의 글 화면에서 빠진다(글 상세는 보는 사람마다 달라 엣지에 담지 않는다).
const COMMENT_LIMIT = 10;

const notFound = (what: string) =>
  notFoundError(`${what}을(를) 찾을 수 없습니다.`, 'BOARD_NOT_FOUND');

// 자동 릴리즈 노트는 KST 날짜로 고정된 ID를 쓴다. 기존 글·댓글·차단의 UUID 검증은 유지한다.
const idParam = (c: Context<AppEnv>, name: string) => {
  const value = c.req.param(name);
  if (name === 'postId' && typeof value === 'string' && /^pst_release_\d{8}$/.test(value)) {
    return value;
  }
  return parseWithAppError(BoardIdParamSchema, value);
};
/** 목록은 첫 페이지만 엣지에 담는다 — 키와 지우는 규칙은 edgeKeys.ts. '더 보기'(before)나 다른 limit은 드물어 그냥 읽는다. */
const LIST_TTL = 60;
const purgeList = (c: Context<AppEnv>, board: string) => purgeEdge(c, STALE.boardChanged(board));

async function postOr404(c: Context<AppEnv>, id: string) {
  const post = await getPost(getDb(c), id);
  if (!post) throw notFound('글');
  return post;
}

export function registerBoardRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/boards/viewer', async (c) => {
    const { admin, google, nickname } = await getViewer(c);
    return ok(c, BoardViewerResponseSchema, { admin, google, nickname });
  });

  app.get('/v1/boards/:board/posts', async (c) => {
    const board = parseWithAppError(BoardKeySchema, c.req.param('board'));
    const q = parseWithAppError(BoardListQuerySchema, c.req.query());
    const load = () => listPosts(getDb(c), board, q.limit, q.before);
    const data =
      q.limit === BOARD_PAGE_LIMIT && !q.before
        ? await edgeCached(c, EDGE.boardFirstPage(board), LIST_TTL, load)
        : await load();
    return ok(c, BoardListResponseSchema, data);
  });

  app.get('/v1/boards/posts/:postId', async (c) => {
    const id = idParam(c, 'postId');
    const db = getDb(c);
    const session = resolveSession(c);
    const [post, rows, viewer, liked, hidden] = await Promise.all([
      postOr404(c, id),
      listComments(db, id),
      getViewer(c),
      session.then((s) => (s ? isLiked(db, id, s.profileId) : false)),
      session.then((s) => (s ? getHiddenFor(db, s.profileId, id) : undefined)),
    ]);
    const comments = rows
      .filter(
        (r) => !hidden?.blockedAuthors.has(r.profileId) && !hidden?.reportedComments.has(r.id),
      )
      .map(({ profileId, ...r }) => ({
        ...r,
        deletable: viewer.admin || profileId === viewer.profileId,
      }));
    return ok(c, PostDetailResponseSchema, {
      post,
      comments,
      liked,
      blocks: hidden?.blocks ?? [],
    });
  });

  app.post('/v1/boards/posts/:postId/views', async (c) => {
    if (!(await addView(getDb(c), idParam(c, 'postId')))) throw notFound('글');
    return c.body(null, 204);
  });

  for (const [method, like] of [
    ['put', true],
    ['delete', false],
  ] as const) {
    app[method]('/v1/boards/posts/:postId/like', requireProfile, async (c) => {
      const postId = idParam(c, 'postId');
      const { profileId } = getSessionOrThrow(c);
      const likeCount = await setLike(getDb(c), postId, profileId, like, nowIso());
      if (likeCount === undefined) throw notFound('글');
      return ok(c, PostLikeResponseSchema, { liked: like, likeCount });
    });
  }

  app.post('/v1/boards/:board/posts', async (c) => {
    const board = parseWithAppError(BoardKeySchema, c.req.param('board'));
    const viewer = await requireAdmin(c);
    const input = readBody(c, PostInputSchema);
    const id = await createPost(getDb(c), board, input, viewer.profileId!, nowIso());
    purgeList(c, board);
    kickNewsPush(c);
    return ok(c, PostSchema, await postOr404(c, id), 201);
  });

  app.put('/v1/boards/posts/:postId', async (c) => {
    const id = idParam(c, 'postId');
    await requireAdmin(c);
    const input = readBody(c, PostInputSchema);
    if (!(await updatePost(getDb(c), id, input, nowIso()))) throw notFound('글');
    const post = await postOr404(c, id);
    purgeList(c, post.board);
    return ok(c, PostSchema, post);
  });

  app.delete('/v1/boards/posts/:postId', async (c) => {
    const id = idParam(c, 'postId');
    await requireAdmin(c);
    const { board } = await postOr404(c, id);
    if (!(await deletePost(getDb(c), id, nowIso()))) throw notFound('글');
    purgeList(c, board);
    return c.body(null, 204);
  });

  app.post('/v1/boards/posts/:postId/comments', requireProfile, async (c) => {
    const postId = idParam(c, 'postId');
    const db = getDb(c);
    const { body } = readBody(c, CommentInputSchema);
    if (hasProfanity(body)) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '쓸 수 없는 표현이 들어 있습니다.',
        details: { reason: 'BLOCKED_WORD' },
      });
    }
    const [viewer, post] = await Promise.all([getViewer(c), postOr404(c, postId)]);
    // T-10-028: 댓글은 구글 로그인한 프로필만, 그 프로필의 닉네임으로.
    if (!viewer.google)
      throw new AppError({
        code: 'FORBIDDEN',
        message: '구글로 로그인하면 댓글을 쓸 수 있어요.',
        details: { reason: 'GOOGLE_LOGIN_REQUIRED' },
      });
    const nickname = viewer.nickname;
    if (!nickname)
      throw new AppError({
        code: 'FORBIDDEN',
        message: '댓글에 쓸 닉네임을 먼저 정해 주세요.',
        details: { reason: 'NICKNAME_REQUIRED' },
      });
    const profileId = getSessionOrThrow(c).profileId;
    const now = nowIso();
    if (!viewer.admin) {
      await enforceLimit(
        db,
        'BOARD_COMMENT',
        profileId,
        COMMENT_LIMIT,
        now,
        '댓글을 너무 자주 쓰고 있어요. 잠시 뒤에 다시 시도해 주세요.',
      );
    }
    const id = await createComment(
      db,
      { postId, profileId, nickname, body, admin: viewer.admin },
      now,
    );
    purgeList(c, post.board); // 댓글 수가 바뀐다.
    const comment = {
      id,
      nickname,
      body,
      admin: viewer.admin,
      deletable: true,
      createdAt: now,
    };
    return ok(c, CommentSchema, comment, 201);
  });

  app.delete('/v1/boards/comments/:commentId', requireProfile, async (c) => {
    const id = idParam(c, 'commentId');
    const db = getDb(c);
    const [owner, viewer] = await Promise.all([getCommentOwner(db, id), getViewer(c)]);
    if (!owner) throw notFound('댓글');
    if (owner.profileId !== viewer.profileId && !viewer.admin)
      throw new AppError({ code: 'FORBIDDEN', message: '내 댓글만 지울 수 있습니다.' });
    await deleteComment(db, id, nowIso());
    purgeList(c, owner.board); // 댓글 수가 바뀐다.
    return c.body(null, 204);
  });

  /** 남의 댓글만 신고·차단한다. 운영자 댓글은 차단하지 않는다(공지 답변이 사라지면 안 된다). */
  async function othersComment(c: Context<AppEnv>) {
    const commentId = idParam(c, 'commentId');
    const db = getDb(c);
    const author = await getCommentAuthor(db, commentId);
    if (!author) throw notFound('댓글');
    const { profileId } = getSessionOrThrow(c);
    if (author.profileId === profileId)
      throw new AppError({ code: 'FORBIDDEN', message: '내 댓글은 신고하거나 차단할 수 없어요.' });
    return { db, commentId, author, profileId };
  }

  app.post('/v1/boards/comments/:commentId/report', requireProfile, async (c) => {
    const { reason } = readBody(c, CommentReportInputSchema);
    const { db, commentId, profileId } = await othersComment(c);
    await reportComment(db, { commentId, profileId, reason }, nowIso());
    return c.body(null, 204);
  });

  app.post('/v1/boards/comments/:commentId/block', requireProfile, async (c) => {
    const { db, author, profileId } = await othersComment(c);
    if (author.admin)
      throw new AppError({ code: 'FORBIDDEN', message: '운영자는 차단할 수 없어요.' });
    const block = await blockAuthor(
      db,
      { profileId, blockedProfileId: author.profileId, nickname: author.nickname },
      nowIso(),
    );
    return ok(c, BoardBlockSchema, block, 201);
  });

  app.delete('/v1/boards/blocks/:blockId', requireProfile, async (c) => {
    const id = idParam(c, 'blockId');
    if (!(await unblock(getDb(c), id, getSessionOrThrow(c).profileId))) throw notFound('차단');
    return c.body(null, 204);
  });
}
