import type { CommentReportReason } from '@offside/contracts/board-limits';
import { and, count, eq, gt, or } from 'drizzle-orm';
import type { Db } from '../client.js';
import { boardBlocks, chatMutes, chatReports } from '../schema.js';

// T-11-015 채팅 신고·정지. 메시지 자체는 채팅방(Durable Object)에 있고, 여기엔 운영 기록만 둔다. 차단은 게시판
// 차단(board_blocks)을 함께 쓴다 — 한 번 차단하면 댓글과 채팅 모두에서 안 보인다.

/** 정지가 끝나는 시각. 정지 중이 아니면 null. */
export async function getMutedUntil(
  db: Db,
  profileId: string,
  now: string,
): Promise<string | null> {
  const [row] = await db
    .select({ until: chatMutes.until })
    .from(chatMutes)
    .where(and(eq(chatMutes.profileId, profileId), gt(chatMutes.until, now)));
  return row?.until ?? null;
}

/** 정지를 건다. 이미 정지 중이면 새 기간으로 바꾼다. */
export async function muteChat(db: Db, profileId: string, until: string, now: string) {
  await db
    .insert(chatMutes)
    .values({ profileId, until, createdAt: now })
    .onConflictDoUpdate({ target: chatMutes.profileId, set: { until, createdAt: now } });
}

/** 신고를 적고(한 사람이 한 번) 그 메시지를 신고한 사람 수를 돌려준다. */
export async function reportChat(
  db: Db,
  input: {
    messageId: string;
    profileId: string;
    reason: CommentReportReason;
    authorProfileId: string;
    nickname: string;
    body: string;
  },
  now: string,
): Promise<number> {
  const [, [row]] = await db.batch([
    db
      .insert(chatReports)
      .values({ ...input, createdAt: now })
      .onConflictDoNothing(),
    db.select({ n: count() }).from(chatReports).where(eq(chatReports.messageId, input.messageId)),
  ]);
  return row?.n ?? 0;
}

/** 내가 신고한 메시지 id(since 이후 — 방이 메시지를 들고 있는 기간만). */
export async function reportedMessageIds(
  db: Db,
  profileId: string,
  since: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: chatReports.messageId })
    .from(chatReports)
    .where(and(eq(chatReports.profileId, profileId), gt(chatReports.createdAt, since)));
  return rows.map((r) => r.id);
}

/** 내가 차단한 사람들의 프로필 id. */
export async function blockedProfileIds(db: Db, profileId: string): Promise<string[]> {
  const rows = await db
    .select({ id: boardBlocks.blockedProfileId })
    .from(boardBlocks)
    .where(eq(boardBlocks.profileId, profileId));
  return rows.map((r) => r.id);
}

/** 프로필 삭제 — 그 사람이 한 신고, 그 사람 메시지의 신고 사본, 정지 기록을 지운다. */
export const deleteChatActivityStatements = (db: Db, profileId: string) =>
  [
    db
      .delete(chatReports)
      .where(or(eq(chatReports.profileId, profileId), eq(chatReports.authorProfileId, profileId))),
    db.delete(chatMutes).where(eq(chatMutes.profileId, profileId)),
  ] as const;
