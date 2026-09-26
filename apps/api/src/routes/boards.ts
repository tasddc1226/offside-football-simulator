import {
  BoardIdParamSchema,
  BoardKeySchema,
  BoardListQuerySchema,
  BoardListResponseSchema,
  BoardViewerResponseSchema,
  CommentInputSchema,
  CommentSchema,
  PostDetailResponseSchema,
  PostInputSchema,
  PostSchema,
  successEnvelope,
} from '@offside/contracts';
import type { Context, Hono } from 'hono';
import { getViewer, requireAdmin } from '../auth/admin.js';
import { getAttemptCount, recordAttempt } from '../db/repos/authAttempts.js';
import {
  createComment,
  createPost,
  deleteComment,
  deletePost,
  getCommentOwner,
  getPost,
  listComments,
  listPosts,
  updatePost,
} from '../db/repos/boards.js';
import { getDb, type AppEnv } from '../env.js';
import { envelope, nowIso } from './shared.js';
import { AppError, parseJsonBody, parseWithAppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { edgeCached, purgeEdge } from '../edgeCache.js';
import { hasProfanity } from '@offside/contracts/content-filter';

// T-10-011 게시판(공지·릴리즈 노트). 읽기는 누구나, 글은 관리자만, 댓글은 프로필이 있는 누구나.
// 댓글은 프로필당 시간당 COMMENT_LIMIT개까지(관리자 제외).
const COMMENT_LIMIT = 10;

const notFound = (what: string) =>
  new AppError({ code: 'VALIDATION_FAILED', status: 404, message: `${what}을(를) 찾을 수 없습니다.`, details: { reason: 'BOARD_NOT_FOUND' } });

const idParam = (c: Context<AppEnv>, name: string) => parseWithAppError(BoardIdParamSchema, c.req.param(name));
/** 목록 엣지 캐시는 첫 페이지(웹 기본 limit)만 — 글·댓글을 쓰고 지울 때 지우는 키와 정확히 같다.
 * '더 보기'(before)나 다른 limit은 드물어 그냥 읽는다. */
const LIST_TTL = 60;
const DEFAULT_LIMIT = 20;
export const firstPagePath = (board: string) => `/v1/boards/${board}/posts?limit=${DEFAULT_LIMIT}`;
const purgeList = (c: Context<AppEnv>, board: string) => purgeEdge(c, [firstPagePath(board)]);

async function postOr404(c: Context<AppEnv>, id: string) {
  const post = await getPost(getDb(c), id);
  if (!post) throw notFound('글');
  return post;
}

export function registerBoardRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/boards/viewer', async (c) => {
    const { admin, google, nickname } = await getViewer(c);
    return c.json(successEnvelope(BoardViewerResponseSchema).parse(envelope(c, { admin, google, nickname })), 200);
  });

  app.get('/v1/boards/:board/posts', async (c) => {
    const board = parseWithAppError(BoardKeySchema, c.req.param('board'));
    const q = parseWithAppError(BoardListQuerySchema, c.req.query());
    const load = () => listPosts(getDb(c), board, q.limit, q.before);
    const data = q.limit === DEFAULT_LIMIT && !q.before ? await edgeCached(c, firstPagePath(board), LIST_TTL, load) : await load();
    return c.json(successEnvelope(BoardListResponseSchema).parse(envelope(c, data)), 200);
  });

  app.get('/v1/boards/posts/:postId', async (c) => {
    const id = idParam(c, 'postId');
    const [post, rows, viewer] = await Promise.all([postOr404(c, id), listComments(getDb(c), id), getViewer(c)]);
    const comments = rows.map(({ profileId, ...r }) => ({ ...r, deletable: viewer.admin || profileId === viewer.profileId }));
    return c.json(successEnvelope(PostDetailResponseSchema).parse(envelope(c, { post, comments })), 200);
  });

  app.post('/v1/boards/:board/posts', async (c) => {
    const board = parseWithAppError(BoardKeySchema, c.req.param('board'));
    const viewer = await requireAdmin(c);
    const input = parseWithAppError(PostInputSchema, parseJsonBody(c.get('rawBody') ?? ''));
    const id = await createPost(getDb(c), board, input, viewer.profileId!, nowIso());
    purgeList(c, board);
    return c.json(successEnvelope(PostSchema).parse(envelope(c, await postOr404(c, id))), 201);
  });

  app.put('/v1/boards/posts/:postId', async (c) => {
    const id = idParam(c, 'postId');
    await requireAdmin(c);
    const input = parseWithAppError(PostInputSchema, parseJsonBody(c.get('rawBody') ?? ''));
    if (!(await updatePost(getDb(c), id, input, nowIso()))) throw notFound('글');
    const post = await postOr404(c, id);
    purgeList(c, post.board);
    return c.json(successEnvelope(PostSchema).parse(envelope(c, post)), 200);
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
    const { body } = parseWithAppError(CommentInputSchema, parseJsonBody(c.get('rawBody') ?? ''));
    if (hasProfanity(body)) {
      throw new AppError({ code: 'VALIDATION_FAILED', message: '쓸 수 없는 표현이 들어 있습니다.', details: { reason: 'BLOCKED_WORD' } });
    }
    const [viewer, post] = await Promise.all([getViewer(c), postOr404(c, postId)]);
    // T-10-028: 댓글은 구글 로그인한 프로필만, 그 프로필의 닉네임으로.
    if (!viewer.google) throw new AppError({ code: 'FORBIDDEN', message: '구글로 로그인하면 댓글을 쓸 수 있어요.', details: { reason: 'GOOGLE_LOGIN_REQUIRED' } });
    const nickname = viewer.nickname;
    if (!nickname) throw new AppError({ code: 'FORBIDDEN', message: '댓글에 쓸 닉네임을 먼저 정해 주세요.', details: { reason: 'NICKNAME_REQUIRED' } });
    const profileId = getSessionOrThrow(c).profileId;
    const now = nowIso();
    if (!viewer.admin) {
      if ((await getAttemptCount(db, 'BOARD_COMMENT', profileId, now)) >= COMMENT_LIMIT) {
        throw new AppError({ code: 'RATE_LIMITED', message: '댓글을 너무 자주 쓰고 있어요. 잠시 뒤에 다시 시도해 주세요.' });
      }
      await recordAttempt(db, 'BOARD_COMMENT', profileId, now);
    }
    const id = await createComment(db, { postId, profileId, nickname, body, admin: viewer.admin }, now);
    purgeList(c, post.board); // 댓글 수가 바뀐다.
    const comment = { id, nickname, body, admin: viewer.admin, deletable: true, createdAt: now };
    return c.json(successEnvelope(CommentSchema).parse(envelope(c, comment)), 201);
  });

  app.delete('/v1/boards/comments/:commentId', requireProfile, async (c) => {
    const id = idParam(c, 'commentId');
    const db = getDb(c);
    const [owner, viewer] = await Promise.all([getCommentOwner(db, id), getViewer(c)]);
    if (!owner) throw notFound('댓글');
    if (owner.profileId !== viewer.profileId && !viewer.admin) throw new AppError({ code: 'FORBIDDEN', message: '내 댓글만 지울 수 있습니다.' });
    await deleteComment(db, id, nowIso());
    purgeList(c, owner.board); // 댓글 수가 바뀐다.
    return c.body(null, 204);
  });
}
