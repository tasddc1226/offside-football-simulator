import {
  communityOwnerEmail,
  communityRecipients,
  communityStatements,
  type CommunityEvent,
} from '../../push/community.js';
import type { Bindings } from '../../env.js';
import type {
  BoardBlock,
  BoardKey,
  BoardListResponse,
  CommentReportReason,
  Post,
  PostSummary,
  PostTranslations,
} from '@offside/contracts';
import { TRANSLATED_LOCALES } from '@offside/contracts/i18n';
import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { newId } from '../ids.js';
import {
  boardBlocks,
  boardCommentReports,
  boardComments,
  boardPostLikes,
  boardPosts,
} from '../schema.js';
import { runBatch } from './batch.js';
import { newsPushStatements } from '../../push/enqueue.js';
import type { Lang } from '../../lang.js';

const COMMENTS_MAX = 200;

const summaryColumns = {
  id: boardPosts.id,
  board: boardPosts.board,
  title: boardPosts.title,
  version: boardPosts.version,
  pinned: boardPosts.pinned,
  viewCount: boardPosts.viewCount,
  likeCount: boardPosts.likeCount,
  createdAt: boardPosts.createdAt,
  updatedAt: boardPosts.updatedAt,
  // 단일 테이블 select에서 drizzle은 컬럼을 테이블명 없이 쓰므로 상관 서브쿼리는 이름을 직접 적는다.
  commentCount: sql<number>`(SELECT COUNT(*) FROM board_comments c WHERE c.post_id = board_posts.id AND c.deleted_at IS NULL)`,
};
/**
 * T-11-146 저장된 번역 칸. 쓸 때는 `PostTranslationsSchema`로 한도까지 검사하고, 읽을 때는 언어별로 모양만 본다
 * (T-11-148) — 한 언어가 어긋나도(손으로 고친 행, 한도가 바뀌기 전 값) 다른 언어를 버리지 않고, 릴리즈 노트가
 * 번역 본문 대신 한국어 본문에 이어 쓰지 않게 한다.
 */
export function parseI18n(json: string | null): PostTranslations {
  let raw: unknown;
  try {
    raw = json ? JSON.parse(json) : null;
  } catch {
    return {};
  }
  const out: PostTranslations = {};
  for (const lang of TRANSLATED_LOCALES) {
    const t = (raw as Record<string, { title?: unknown; body?: unknown }> | null)?.[lang];
    if (
      typeof t?.title === 'string' &&
      typeof t.body === 'string' &&
      t.title.trim() &&
      t.body.trim()
    )
      out[lang] = { title: t.title, body: t.body };
  }
  return out;
}
/** 목록은 엣지에 한국어 키 하나로 담는다 — 번역 제목을 함께 담고(본문은 읽지 않는다) 꺼낸 뒤 `localizeList`로 고른다. */
const listColumns = {
  ...summaryColumns,
  titles: sql<
    string | null
  >`json_object('en', json_extract(${boardPosts.i18nJson}, '$.en.title'), 'ja', json_extract(${boardPosts.i18nJson}, '$.ja.title'))`,
};
type ListedPost = PostSummary & { titles: string | null };

export function localizeList(
  data: { posts: ListedPost[]; hasMore: boolean },
  lang: Lang,
): BoardListResponse {
  return {
    hasMore: data.hasMore,
    posts: data.posts.map(({ titles, ...p }) => {
      if (lang === 'ko' || !titles) return p;
      const title = (JSON.parse(titles) as Partial<Record<Lang, string | null>>)[lang];
      return title ? { ...p, title } : p;
    }),
  };
}
const live = (id: string) => and(eq(boardPosts.id, id), isNull(boardPosts.deletedAt));
const likeOf = (postId: string, profileId: string) =>
  and(eq(boardPostLikes.postId, postId), eq(boardPostLikes.profileId, profileId));

/** 첫 페이지(before 없음)는 고정 글 전부 + 최신 글, 다음 페이지부터는 고정 안 된 글만 createdAt 역순. */
export async function listPosts(db: Db, board: BoardKey, limit: number, before?: string) {
  const inBoard = and(eq(boardPosts.board, board), isNull(boardPosts.deletedAt));
  const [pinned, rest] = await Promise.all([
    before
      ? Promise.resolve([])
      : db
          .select(listColumns)
          .from(boardPosts)
          .where(and(inBoard, eq(boardPosts.pinned, true)))
          .orderBy(desc(boardPosts.createdAt)),
    db
      .select(listColumns)
      .from(boardPosts)
      .where(
        and(
          inBoard,
          eq(boardPosts.pinned, false),
          before ? lt(boardPosts.createdAt, before) : undefined,
        ),
      )
      .orderBy(desc(boardPosts.createdAt))
      .limit(limit + 1),
  ]);
  return {
    posts: [...pinned, ...rest.slice(0, limit)] as ListedPost[],
    hasMore: rest.length > limit,
  };
}

export type PostRow = Post & { i18nJson: string | null };

/** 한국어 원문과 저장된 번역을 한 번에 읽는다 — 요청 언어로 고르기·관리자 원문은 `localizePost`·`parseI18n`. */
export async function getPost(db: Db, id: string): Promise<PostRow | undefined> {
  const [row] = await db
    .select({ ...summaryColumns, body: boardPosts.body, i18nJson: boardPosts.i18nJson })
    .from(boardPosts)
    .where(live(id));
  return row as PostRow | undefined;
}

/** 운영자가 쓴 번역이 있으면 그 언어로, 없으면 한국어 원문. */
export function localizePost({ i18nJson, ...post }: PostRow, lang: Lang): Post {
  const text = lang === 'ko' ? undefined : parseI18n(i18nJson)[lang];
  return text ? { ...post, ...text } : post;
}

export type PostFields = {
  title: string;
  body: string;
  version?: string | undefined;
  pinned: boolean;
  i18n?: PostTranslations | undefined;
};

/** 빈 번역은 NULL로 둔다. undefined는 "보내지 않음"이라 저장된 번역을 건드리지 않는다. */
const i18nColumn = (i18n: PostTranslations) => (i18n.en || i18n.ja ? JSON.stringify(i18n) : null);

export async function createPost(
  db: Db,
  board: BoardKey,
  fields: PostFields,
  authorProfileId: string,
  now: string,
) {
  const id = newId('pst');
  const d1 = db.$client;
  await d1.batch([
    d1
      .prepare(
        `INSERT INTO board_posts
      (id, board, title, body, i18n_json, version, pinned, author_profile_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        board,
        fields.title,
        fields.body,
        fields.i18n ? i18nColumn(fields.i18n) : null,
        fields.version || null,
        fields.pinned ? 1 : 0,
        authorProfileId,
        now,
        now,
      ),
    ...newsPushStatements(d1, id, board, now),
  ]);
  return id;
}

/** 지운 글이거나 없으면 false. */
export async function updatePost(
  db: Db,
  id: string,
  fields: PostFields,
  now: string,
): Promise<boolean> {
  const res = await db
    .update(boardPosts)
    .set({
      title: fields.title,
      body: fields.body,
      pinned: fields.pinned,
      version: fields.version || null,
      ...(fields.i18n ? { i18nJson: i18nColumn(fields.i18n) } : {}),
      updatedAt: now,
    })
    .where(live(id));
  return res.meta.changes > 0;
}

export async function deletePost(db: Db, id: string, now: string): Promise<boolean> {
  const res = await db.update(boardPosts).set({ deletedAt: now }).where(live(id));
  return res.meta.changes > 0;
}

/** T-10-058 조회수 +1. 지운 글이거나 없으면 false. */
export async function addView(db: Db, id: string): Promise<boolean> {
  const res = await db
    .update(boardPosts)
    .set({ viewCount: sql`${boardPosts.viewCount} + 1` })
    .where(live(id));
  return res.meta.changes > 0;
}

export async function isLiked(db: Db, postId: string, profileId: string): Promise<boolean> {
  const [row] = await db
    .select({ postId: boardPostLikes.postId })
    .from(boardPostLikes)
    .where(likeOf(postId, profileId));
  return !!row;
}

/** 좋아요를 누르거나(like) 거둔다. 같은 batch에서 like_count를 다시 세어 늘 실제 행 수와 같다.
 *  이미 그 상태면 행은 그대로(멱등). 새 좋아요 수를, 지운 글이거나 없으면 undefined를 돌려준다
 *  (좋아요 행은 살아 있는 글에만 넣는다). */
export async function setLike(
  db: Db,
  postId: string,
  profileId: string,
  like: boolean,
  now: string,
): Promise<number | undefined> {
  const [, rows] = (await runBatch(db, [
    like
      ? db
          .insert(boardPostLikes)
          .select(
            db
              .select({
                postId: boardPosts.id,
                profileId: sql`${profileId}`.as('profile_id'),
                createdAt: sql`${now}`.as('created_at'),
              })
              .from(boardPosts)
              .where(live(postId)),
          )
          .onConflictDoNothing()
      : db.delete(boardPostLikes).where(likeOf(postId, profileId)),
    db
      .update(boardPosts)
      .set({
        likeCount: sql`(SELECT COUNT(*) FROM board_post_likes l WHERE l.post_id = board_posts.id)`,
      })
      .where(live(postId))
      .returning({ likeCount: boardPosts.likeCount }),
  ])) as [unknown, { likeCount: number }[]];
  return rows[0]?.likeCount;
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
  notify?: { env: Bindings; board: 'notice' | 'release' },
) {
  const id = newId('cmt');
  const mutation = db.insert(boardComments).values({ id, ...input, createdAt: now });
  if (notify && !input.admin && communityOwnerEmail(notify.env)) {
    const recipients = await communityRecipients(notify.env);
    const { sql, params } = mutation.toSQL();
    const event: CommunityEvent = { ...input, id, now, type: 'comment', board: notify.board };
    await db.$client.batch([
      db.$client.prepare(sql).bind(...params),
      ...communityStatements(notify.env, recipients, event),
    ]);
  } else await mutation;
  return id;
}

/** 지울 댓글의 작성자와 게시판(목록 캐시를 비우는 데 쓴다). */
export async function getCommentOwner(
  db: Db,
  id: string,
): Promise<{ profileId: string; board: string } | undefined> {
  const [row] = await db
    .select({ profileId: boardComments.profileId, board: boardPosts.board })
    .from(boardComments)
    .innerJoin(boardPosts, eq(boardPosts.id, boardComments.postId))
    .where(and(eq(boardComments.id, id), isNull(boardComments.deletedAt)));
  return row;
}

export async function deleteComment(db: Db, id: string, now: string): Promise<void> {
  await db.update(boardComments).set({ deletedAt: now }).where(eq(boardComments.id, id));
}

/** 살아 있는 댓글의 작성자(차단할 사람)와 그때의 닉네임·관리자 여부. 없거나 지운 댓글이면 undefined. */
export async function getCommentAuthor(db: Db, id: string) {
  const [row] = await db
    .select({
      profileId: boardComments.profileId,
      nickname: boardComments.nickname,
      admin: boardComments.admin,
    })
    .from(boardComments)
    .where(and(eq(boardComments.id, id), isNull(boardComments.deletedAt)));
  return row;
}

/** 신고를 남긴다. 같은 사람이 같은 댓글을 다시 신고하면 처음 기록을 그대로 둔다(멱등). */
export async function reportComment(
  db: Db,
  input: { commentId: string; profileId: string; reason: CommentReportReason },
  now: string,
): Promise<void> {
  await db
    .insert(boardCommentReports)
    .values({ ...input, createdAt: now })
    .onConflictDoNothing();
}

/** 작성자를 차단한다. 이미 차단했으면 그 기록을 돌려준다(멱등). */
export async function blockAuthor(
  db: Db,
  input: { profileId: string; blockedProfileId: string; nickname: string },
  now: string,
): Promise<BoardBlock> {
  await db
    .insert(boardBlocks)
    .values({ id: newId('blk'), ...input, createdAt: now })
    .onConflictDoNothing();
  const [row] = await db
    .select({
      id: boardBlocks.id,
      nickname: boardBlocks.nickname,
      createdAt: boardBlocks.createdAt,
    })
    .from(boardBlocks)
    .where(
      and(
        eq(boardBlocks.profileId, input.profileId),
        eq(boardBlocks.blockedProfileId, input.blockedProfileId),
      ),
    );
  return row!;
}

/** 내 차단 하나를 푼다. 내 것이 아니거나 없으면 false. */
export async function unblock(db: Db, id: string, profileId: string): Promise<boolean> {
  const res = await db
    .delete(boardBlocks)
    .where(and(eq(boardBlocks.id, id), eq(boardBlocks.profileId, profileId)));
  return res.meta.changes > 0;
}

/** 내가 차단한 사람(게시판·채팅 공통, 오래된 순). */
export const listBlocks = (db: Db, profileId: string) =>
  db
    .select({
      id: boardBlocks.id,
      nickname: boardBlocks.nickname,
      createdAt: boardBlocks.createdAt,
      blockedProfileId: boardBlocks.blockedProfileId,
    })
    .from(boardBlocks)
    .where(eq(boardBlocks.profileId, profileId))
    .orderBy(asc(boardBlocks.createdAt));

/** 이 프로필이 글 하나에서 뺄 댓글 — 차단한 작성자와 (이 글에서) 신고한 댓글 — 과 차단 목록. */
export async function getHiddenFor(db: Db, profileId: string, postId: string) {
  const [blocks, reported] = await Promise.all([
    listBlocks(db, profileId),
    db
      .select({ commentId: boardCommentReports.commentId })
      .from(boardCommentReports)
      .innerJoin(boardComments, eq(boardComments.id, boardCommentReports.commentId))
      .where(and(eq(boardCommentReports.profileId, profileId), eq(boardComments.postId, postId))),
  ]);
  return {
    blocks: blocks.map(({ blockedProfileId: _, ...b }) => b),
    blockedAuthors: new Set(blocks.map((b) => b.blockedProfileId)),
    reportedComments: new Set(reported.map((r) => r.commentId)),
  };
}

/** 프로필 삭제 batch용 — 그 사람이 쓴 댓글과 누른 좋아요, 신고·차단 기록(차단당한 기록 포함)을 지운다
 *  (글은 관리자 운영 기록이라 남긴다). 좋아요 수는 지우기 전에 그 글들에서 하나씩 뺀다. */
export const deleteBoardActivityStatements = (db: Db, profileId: string) => {
  const mine = eq(boardPostLikes.profileId, profileId);
  return [
    db.delete(boardComments).where(eq(boardComments.profileId, profileId)),
    db
      .update(boardPosts)
      .set({ likeCount: sql`${boardPosts.likeCount} - 1` })
      .where(
        inArray(
          boardPosts.id,
          db.select({ id: boardPostLikes.postId }).from(boardPostLikes).where(mine),
        ),
      ),
    db.delete(boardPostLikes).where(mine),
    db.delete(boardCommentReports).where(eq(boardCommentReports.profileId, profileId)),
    db
      .delete(boardBlocks)
      .where(or(eq(boardBlocks.profileId, profileId), eq(boardBlocks.blockedProfileId, profileId))),
  ] as const;
};
