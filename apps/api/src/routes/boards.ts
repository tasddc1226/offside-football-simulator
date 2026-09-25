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
import { AppError, parseJsonBody, parseWithAppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { hasProfanity, isAcceptablePublicName } from './hof.js';

// T-10-011 게시판(공지·릴리즈 노트). 읽기는 누구나, 글은 관리자만, 댓글은 프로필이 있는 누구나.
// 댓글은 프로필당 시간당 COMMENT_LIMIT개까지(관리자 제외).
const COMMENT_LIMIT = 10;

const notFound = (what: string) =>
  new AppError({ code: 'VALIDATION_FAILED', status: 404, message: `${what}을(를) 찾을 수 없습니다.`, details: { reason: 'BOARD_NOT_FOUND' } });

const envelope = (c: Context<AppEnv>, data: unknown) => ({ data, meta: { requestId: c.get('requestId') } });
const idParam = (c: Context<AppEnv>, name: string) => parseWithAppError(BoardIdParamSchema, c.req.param(name));
const nowIso = () => new Date().toISOString();

async function postOr404(c: Context<AppEnv>, id: string) {
  const post = await getPost(getDb(c), id);
  if (!post) throw notFound('글');
  return post;
}

export function registerBoardRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/boards/viewer', async (c) => {
    const { admin } = await getViewer(c);
    return c.json(successEnvelope(BoardViewerResponseSchema).parse(envelope(c, { admin })), 200);
  });

  app.get('/v1/boards/:board/posts', async (c) => {
    const board = parseWithAppError(BoardKeySchema, c.req.param('board'));
    const q = parseWithAppError(BoardListQuerySchema, c.req.query());
    const data = await listPosts(getDb(c), board, q.limit, q.before);
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
    return c.json(successEnvelope(PostSchema).parse(envelope(c, await postOr404(c, id))), 201);
  });

  app.put('/v1/boards/posts/:postId', async (c) => {
    const id = idParam(c, 'postId');
    await requireAdmin(c);
    const input = parseWithAppError(PostInputSchema, parseJsonBody(c.get('rawBody') ?? ''));
    if (!(await updatePost(getDb(c), id, input, nowIso()))) throw notFound('글');
    return c.json(successEnvelope(PostSchema).parse(envelope(c, await postOr404(c, id))), 200);
  });

  app.delete('/v1/boards/posts/:postId', async (c) => {
    const id = idParam(c, 'postId');
    await requireAdmin(c);
    if (!(await deletePost(getDb(c), id, nowIso()))) throw notFound('글');
    return c.body(null, 204);
  });

  app.post('/v1/boards/posts/:postId/comments', requireProfile, async (c) => {
    const postId = idParam(c, 'postId');
    const db = getDb(c);
    const input = parseWithAppError(CommentInputSchema, parseJsonBody(c.get('rawBody') ?? ''));
    if (!isAcceptablePublicName(input.nickname) || hasProfanity(input.body)) {
      throw new AppError({ code: 'VALIDATION_FAILED', message: '쓸 수 없는 표현이 들어 있습니다.', details: { reason: 'BLOCKED_WORD' } });
    }
    const [viewer] = await Promise.all([getViewer(c), postOr404(c, postId)]);
    const profileId = getSessionOrThrow(c).profileId;
    const now = nowIso();
    if (!viewer.admin) {
      if ((await getAttemptCount(db, 'BOARD_COMMENT', profileId, now)) >= COMMENT_LIMIT) {
        throw new AppError({ code: 'RATE_LIMITED', message: '댓글을 너무 자주 쓰고 있어요. 잠시 뒤에 다시 시도해 주세요.' });
      }
      await recordAttempt(db, 'BOARD_COMMENT', profileId, now);
    }
    const id = await createComment(db, { postId, profileId, ...input, admin: viewer.admin }, now);
    const comment = { id, nickname: input.nickname, body: input.body, admin: viewer.admin, deletable: true, createdAt: now };
    return c.json(successEnvelope(CommentSchema).parse(envelope(c, comment)), 201);
  });

  app.delete('/v1/boards/comments/:commentId', requireProfile, async (c) => {
    const id = idParam(c, 'commentId');
    const db = getDb(c);
    const [owner, viewer] = await Promise.all([getCommentOwner(db, id), getViewer(c)]);
    if (!owner) throw notFound('댓글');
    if (owner !== viewer.profileId && !viewer.admin) throw new AppError({ code: 'FORBIDDEN', message: '내 댓글만 지울 수 있습니다.' });
    await deleteComment(db, id, nowIso());
    return c.body(null, 204);
  });
}
