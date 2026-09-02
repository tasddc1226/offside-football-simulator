import type { BatchItem } from 'drizzle-orm/batch';
import type { Db } from '../client.js';

/**
 * Drizzle `db.batch` 래퍼. 빈 배열이면 no-op. D1에는 대화형 트랜잭션이 없으므로(설계 결정 2) 한 요청의
 * 여러 쓰기는 이 함수로 묶어 보낸다:
 *
 * ```ts
 * await runBatch(db, [
 *   db.update(careers).set({ revision: to, updatedAt }).where(and(eq(careers.id, id), eq(careers.revision, from))),
 *   db.insert(snapshots).values(snapshotRow),
 *   db.insert(commandLog).values(commandRow),
 * ]);
 * ```
 *
 * `command_log(career_id, revision)` PK와 `snapshots(career_id, revision)` UNIQUE가 동시 쓰기를
 * 실패시켜 낙관적 잠금을 완성한다. batch는 단일 SQL 트랜잭션으로 실행되므로 항목 하나가 실패하면 전부 롤백된다.
 */
export async function runBatch(db: Db, statements: BatchItem<'sqlite'>[]): Promise<unknown[]> {
  if (statements.length === 0) return [];
  return db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
}
