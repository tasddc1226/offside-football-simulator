// T-11-290 팀 프로필의 스쿼드 댓글. 게시판 댓글(boards.ts)과 같은 규칙 — 구글 로그인·닉네임, 본인·관리자만 지움,
// 신고한 댓글·차단한 작성자의 댓글은 보는 사람 화면에서 빠진다. 차단 목록(board_blocks)은 게시판·채팅과 함께 쓴다.
import type { CommentReportReason } from '@offside/contracts';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../client.js';
import { newId } from '../ids.js';
import { ownerTeams, profiles, teamCommentReports, teamComments } from '../schema.js';
import { listBlocks } from './boards.js';

const COMMENTS_MAX = 200;

/** 팀 댓글 id인가(게시판 댓글 라우트가 지우기·신고·차단을 이 표로 돌린다). */
export const isTeamCommentId = (id: string) => id.startsWith('tcm_');

export async function listTeamComments(db: Db, teamId: string) {
  return db
    .select({
      id: teamComments.id,
      profileId: teamComments.profileId,
      nickname: teamComments.nickname,
      body: teamComments.body,
      admin: teamComments.admin,
      createdAt: teamComments.createdAt,
      title: profiles.title,
      avatarId: profiles.avatarId,
    })
    .from(teamComments)
    .leftJoin(profiles, eq(profiles.id, teamComments.profileId))
    .where(and(eq(teamComments.teamId, teamId), isNull(teamComments.deletedAt)))
    .orderBy(asc(teamComments.createdAt))
    .limit(COMMENTS_MAX);
}

export async function createTeamComment(
  db: Db,
  input: { teamId: string; profileId: string; nickname: string; body: string; admin: boolean },
  now: string,
): Promise<string> {
  const id = newId('tcm');
  await db.insert(teamComments).values({ id, ...input, createdAt: now });
  return id;
}

/** 살아 있는 댓글의 작성자(지우기 권한 · 차단 대상)와 그때의 닉네임·관리자 여부. 없거나 지운 댓글이면 undefined. */
export async function getTeamCommentAuthor(db: Db, id: string) {
  const [row] = await db
    .select({
      profileId: teamComments.profileId,
      nickname: teamComments.nickname,
      admin: teamComments.admin,
      teamId: teamComments.teamId,
    })
    .from(teamComments)
    .where(and(eq(teamComments.id, id), isNull(teamComments.deletedAt)));
  return row;
}

export async function deleteTeamComment(db: Db, id: string, now: string): Promise<void> {
  await db.update(teamComments).set({ deletedAt: now }).where(eq(teamComments.id, id));
}

/** 신고를 남긴다(같은 사람이 같은 댓글을 다시 신고하면 처음 기록 그대로). */
export async function reportTeamComment(
  db: Db,
  input: { commentId: string; profileId: string; reason: CommentReportReason },
  now: string,
): Promise<void> {
  await db
    .insert(teamCommentReports)
    .values({ ...input, createdAt: now })
    .onConflictDoNothing();
}

/** 이 프로필이 팀 하나에서 뺄 댓글 — 차단한 작성자와 (이 팀에서) 신고한 댓글 — 과 차단 목록. */
export async function hiddenTeamCommentsFor(db: Db, profileId: string, teamId: string) {
  const [blocks, reported] = await Promise.all([
    listBlocks(db, profileId),
    db
      .select({ commentId: teamCommentReports.commentId })
      .from(teamCommentReports)
      .innerJoin(teamComments, eq(teamComments.id, teamCommentReports.commentId))
      .where(and(eq(teamCommentReports.profileId, profileId), eq(teamComments.teamId, teamId))),
  ]);
  return {
    blocks: blocks.map(({ blockedProfileId: _, ...b }) => b),
    blockedAuthors: new Set(blocks.map((b) => b.blockedProfileId)),
    reportedComments: new Set(reported.map((r) => r.commentId)),
  };
}

/** 운영 도구의 최근 댓글 목록에 섞어 보일 팀 댓글(팀 이름을 글 제목 자리에). */
export const adminTeamCommentColumns = {
  id: teamComments.id,
  postId: teamComments.teamId,
  postTitle: ownerTeams.name,
  profileId: teamComments.profileId,
  nickname: teamComments.nickname,
  body: teamComments.body,
  admin: teamComments.admin,
  createdAt: teamComments.createdAt,
};

/** 프로필 삭제 batch용 — 그 사람이 쓴 팀 댓글과 신고 기록을 지운다. */
export const deleteTeamCommentActivityStatements = (db: Db, profileId: string) =>
  [
    db.delete(teamComments).where(eq(teamComments.profileId, profileId)),
    db.delete(teamCommentReports).where(eq(teamCommentReports.profileId, profileId)),
  ] as const;
