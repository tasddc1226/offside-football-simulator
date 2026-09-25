import type { BoardKey, Post, PostSummary } from '@offside/contracts';
import { and, asc, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { newId } from '../ids.js';
import { boardComments, boardPosts } from '../schema.js';

const COMMENTS_MAX = 200;

const summaryColumns = {
  id: boardPosts.id,
  board: boardPosts.board,
  title: boardPosts.title,
  version: boardPosts.version,
  pinned: boardPosts.pinned,
  createdAt: boardPosts.createdAt,
  updatedAt: boardPosts.updatedAt,
  // 단일 테이블 select에서 drizzle은 컬럼을 테이블명 없이 쓰므로 상관 서브쿼리는 이름을 직접 적는다.
  commentCount: sql<number>`(SELECT COUNT(*) FROM board_comments c WHERE c.post_id = board_posts.id AND c.deleted_at IS NULL)`,
};
const live = (id: string) => and(eq(boardPosts.id, id), isNull(boardPosts.deletedAt));

/** 첫 페이지(before 없음)는 고정 글 전부 + 최신 글, 다음 페이지부터는 고정 안 된 글만 createdAt 역순. */
export async function listPosts(db: Db, board: BoardKey, limit: number, before?: string) {
  const inBoard = and(eq(boardPosts.board, board), isNull(boardPosts.deletedAt));
  const [pinned, rest] = await Promise.all([
    before
      ? Promise.resolve([])
      : db.select(summaryColumns).from(boardPosts).where(and(inBoard, eq(boardPosts.pinned, true))).orderBy(desc(boardPosts.createdAt)),
    db
      .select(summaryColumns)
      .from(boardPosts)
      .where(and(inBoard, eq(boardPosts.pinned, false), before ? lt(boardPosts.createdAt, before) : undefined))
      .orderBy(desc(boardPosts.createdAt))
      .limit(limit + 1),
  ]);
  return { posts: [...pinned, ...rest.slice(0, limit)] as PostSummary[], hasMore: rest.length > limit };
}

export async function getPost(db: Db, id: string): Promise<Post | undefined> {
  const [row] = await db
    .select({ ...summaryColumns, body: boardPosts.body })
    .from(boardPosts)
    .where(live(id));
  return row as Post | undefined;
}

export type PostFields = { title: string; body: string; version?: string | undefined; pinned: boolean };

export async function createPost(db: Db, board: BoardKey, fields: PostFields, authorProfileId: string, now: string) {
  const id = newId('pst');
  await db.insert(boardPosts).values({ id, board, ...fields, version: fields.version || null, authorProfileId, createdAt: now, updatedAt: now });
  return id;
}

/** 지운 글이거나 없으면 false. */
export async function updatePost(db: Db, id: string, fields: PostFields, now: string): Promise<boolean> {
  const res = await db
    .update(boardPosts)
    .set({ ...fields, version: fields.version || null, updatedAt: now })
    .where(live(id));
  return res.meta.changes > 0;
}

export async function deletePost(db: Db, id: string, now: string): Promise<boolean> {
  const res = await db.update(boardPosts).set({ deletedAt: now }).where(live(id));
  return res.meta.changes > 0;
}

export async function listComments(db: Db, postId: string) {
  return db
    .select({
      id: boardComments.id,
      profileId: boardComments.profileId,
      nickname: boardComments.nickname,
      body: boardComments.body,
      admin: boardComments.admin,
      createdAt: boardComments.createdAt,
    })
    .from(boardComments)
    .where(and(eq(boardComments.postId, postId), isNull(boardComments.deletedAt)))
    .orderBy(asc(boardComments.createdAt))
    .limit(COMMENTS_MAX);
}

export async function createComment(
  db: Db,
  input: { postId: string; profileId: string; nickname: string; body: string; admin: boolean },
  now: string,
) {
  const id = newId('cmt');
  await db.insert(boardComments).values({ id, ...input, createdAt: now });
  return id;
}

export async function getCommentOwner(db: Db, id: string): Promise<string | undefined> {
  const [row] = await db
    .select({ profileId: boardComments.profileId })
    .from(boardComments)
    .where(and(eq(boardComments.id, id), isNull(boardComments.deletedAt)));
  return row?.profileId;
}

export async function deleteComment(db: Db, id: string, now: string): Promise<void> {
  await db.update(boardComments).set({ deletedAt: now }).where(eq(boardComments.id, id));
}

/** 프로필 삭제 batch용 — 그 사람이 쓴 댓글을 지운다(글은 관리자 운영 기록이라 남긴다). */
export const deleteBoardCommentsStatement = (db: Db, profileId: string) =>
  db.delete(boardComments).where(eq(boardComments.profileId, profileId));
