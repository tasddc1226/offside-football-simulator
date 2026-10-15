import {
  BoardBlockSchema,
  CommentReportInputSchema,
  CommentInputSchema,
  CommentSchema,
  TeamCommentsResponseSchema,
  TeamIdSchema,
} from '@offside/contracts';
import type { Context, Hono } from 'hono';
import { getViewer } from '../auth/admin.js';
import {
  createTeamComment,
  deleteTeamComment,
  getTeamCommentAuthor,
  hiddenTeamCommentsFor,
  listTeamComments,
  reportTeamComment,
} from '../db/repos/teamComments.js';
import { blockAuthor } from '../db/repos/boards.js';
import { ownerTierOfProfile, ownerTiersOf } from '../db/repos/ownerTiers.js';
import { liveTeam } from '../db/repos/ownerTeams.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { resolveSession } from '../middleware/session.js';
import { NO_STORE, nowIso, ok, readBody, teamNotFound, notFoundError } from './shared.js';
import { assertCanComment } from './commentGuard.js';

// T-11-290 팀 프로필의 스쿼드 댓글. 읽기는 누구나(보는 사람이 신고·차단한 것은 빠져 사람마다 달라 엣지에 담지 않는다),
// 쓰기는 게시판 댓글과 같은 문턱(commentGuard). 댓글 하나 지우기·신고·차단은 게시판 댓글 라우트(/v1/boards/comments/:id)가
// tcm_ 접두사로 알아보고 이 표로 돌린다 — 웹·앱이 같은 클라이언트 함수를 쓴다.
const teamParam = (c: Context<AppEnv>) => parseWithAppError(TeamIdSchema, c.req.param('teamId'));
const notFoundComment = () => notFoundError('댓글 항목을 찾을 수 없어요.', 'BOARD_NOT_FOUND');

export function registerTeamCommentRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/teams/:teamId/comments', async (c) => {
    const teamId = teamParam(c);
    const db = getDb(c);
    const session = resolveSession(c);
    const [[found], rows, viewer, hidden] = await Promise.all([
      liveTeam(db, teamId),
      listTeamComments(db, teamId),
      getViewer(c),
      session.then((s) => (s ? hiddenTeamCommentsFor(db, s.profileId, teamId) : undefined)),
    ]);
    if (!found) throw teamNotFound();
    const shown = rows.filter(
      (r) => !hidden?.blockedAuthors.has(r.profileId) && !hidden?.reportedComments.has(r.id),
    );
    const tiers = await ownerTiersOf(
      db,
      shown.map((r) => r.profileId),
      nowIso(),
    );
    const comments = shown.map(({ profileId, ...r }) => ({
      ...r,
      tier: tiers.get(profileId) ?? null,
      deletable: viewer.admin || profileId === viewer.profileId,
    }));
    return ok(
      c,
      TeamCommentsResponseSchema,
      { comments, blocks: hidden?.blocks ?? [] },
      200,
      NO_STORE,
    );
  });

  app.post('/v1/teams/:teamId/comments', requireProfile, async (c) => {
    const teamId = teamParam(c);
    const db = getDb(c);
    const { body } = readBody(c, CommentInputSchema);
    const now = nowIso();
    const [{ viewer, nickname, profileId }, [found]] = await Promise.all([
      assertCanComment(c, body, now),
      liveTeam(db, teamId),
    ]);
    if (!found) throw teamNotFound();
    const id = await createTeamComment(
      db,
      { teamId, profileId, nickname, body, admin: viewer.admin },
      now,
    );
    const comment = {
      id,
      nickname,
      body,
      admin: viewer.admin,
      tier: await ownerTierOfProfile(db, profileId, now),
      title: viewer.title,
      avatarId: viewer.avatarId ?? null,
      deletable: true,
      createdAt: now,
    };
    return ok(c, CommentSchema, comment, 201);
  });
}

/** 게시판 댓글 라우트가 tcm_ id를 받았을 때 — 본인·관리자만 지운다. */
export async function deleteTeamCommentById(c: Context<AppEnv>, id: string): Promise<void> {
  const db = getDb(c);
  const [author, viewer] = await Promise.all([getTeamCommentAuthor(db, id), getViewer(c)]);
  if (!author) throw notFoundComment();
  if (author.profileId !== viewer.profileId && !viewer.admin)
    throw new AppError({ code: 'FORBIDDEN', message: '내 댓글만 지울 수 있어요.' });
  await deleteTeamComment(db, id, nowIso());
}

/** 남의 팀 댓글만 신고·차단한다. 운영자 댓글은 차단하지 않는다. */
async function othersTeamComment(c: Context<AppEnv>, commentId: string) {
  const db = getDb(c);
  const author = await getTeamCommentAuthor(db, commentId);
  if (!author) throw notFoundComment();
  const { profileId } = getSessionOrThrow(c);
  if (author.profileId === profileId)
    throw new AppError({ code: 'FORBIDDEN', message: '내 댓글은 신고하거나 차단할 수 없어요.' });
  return { db, author, profileId };
}

export async function reportTeamCommentById(c: Context<AppEnv>, commentId: string) {
  const { reason } = readBody(c, CommentReportInputSchema);
  const { db, profileId } = await othersTeamComment(c, commentId);
  await reportTeamComment(db, { commentId, profileId, reason }, nowIso());
  return c.body(null, 204);
}

export async function blockTeamCommentAuthor(c: Context<AppEnv>, commentId: string) {
  const { db, author, profileId } = await othersTeamComment(c, commentId);
  if (author.admin)
    throw new AppError({ code: 'FORBIDDEN', message: '운영자는 차단할 수 없어요.' });
  const block = await blockAuthor(
    db,
    { profileId, blockedProfileId: author.profileId, nickname: author.nickname },
    nowIso(),
  );
  return ok(c, BoardBlockSchema, block, 201);
}
