import { desc, eq } from 'drizzle-orm';
import type { Db } from '../client.js';
import { notices } from '../schema.js';

export type NoticeRecord = typeof notices.$inferSelect;

/**
 * API-NOTICE-001: 게시된(`isPublished = 1`) 공지만, `publishedAt` 내림차순으로 최대 `limit`건.
 * 같은 `publishedAt`이 여럿이면 `id` 내림차순으로 묶어 정렬을 안정적으로 만든다.
 */
export async function listPublishedNotices(db: Db, limit: number): Promise<NoticeRecord[]> {
  return db
    .select()
    .from(notices)
    .where(eq(notices.isPublished, 1))
    .orderBy(desc(notices.publishedAt), desc(notices.id))
    .limit(limit);
}
