import type { BatchItem } from 'drizzle-orm/batch';
import type { Db } from '../client.js';

/**
 * Drizzle `db.batch` 래퍼. 빈 배열이면 no-op. D1에는 대화형 트랜잭션이 없으므로(설계 결정 2) 한 요청의
 * 여러 쓰기는 이 함수로 묶어 보낸다:
 *
 * ```ts
 * await runBatch(db, [
 *   db.update(profiles).set({ deletedAt: now }).where(eq(profiles.id, id)),
 *   db.delete(idempotency).where(eq(idempotency.ownerProfileId, id)),
 * ]);
 * ```
 *
 * batch는 단일 SQL 트랜잭션으로 실행되므로 항목 하나가 실패하면 전부 롤백된다.
 */
export async function runBatch(db: Db, statements: BatchItem<'sqlite'>[]): Promise<unknown[]> {
  if (statements.length === 0) return [];
  return db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
}
