import { and, eq, lte } from 'drizzle-orm';
import type { Db } from '../client.js';
import { idempotency } from '../schema.js';

export type IdempotencyRecord = typeof idempotency.$inferSelect;

/** 만료된(`expiresAt <= now`) 항목은 행이 아직 남아 있어도 돌려주지 않는다. */
export async function getIdempotent(
  db: Db,
  ownerProfileId: string,
  key: string,
  now: string,
): Promise<IdempotencyRecord | undefined> {
  const [row] = await db
    .select()
    .from(idempotency)
    .where(and(eq(idempotency.ownerProfileId, ownerProfileId), eq(idempotency.key, key)));
  if (!row || row.expiresAt <= now) return undefined;
  return row;
}

export type PutIdempotentInput = {
  ownerProfileId: string;
  key: string;
  requestHash: string;
  responseStatus: number;
  responseBody: string;
  createdAt: string;
  expiresAt: string;
};

/**
 * 같은 (ownerProfileId, key) 동시 요청 레이스에서 두 번째 삽입은 조용히 건너뛴다(UNIQUE 위반으로
 * throw하지 않는다). 먼저 커밋된 행이 재생 정본이 되고, 두 응답 모두 라우트가 이미 계산한 값을 돌려준다.
 */
export async function putIdempotent(db: Db, input: PutIdempotentInput): Promise<void> {
  await db
    .insert(idempotency)
    .values(input)
    .onConflictDoNothing({ target: [idempotency.ownerProfileId, idempotency.key] });
}

export async function purgeExpired(db: Db, now: string): Promise<number> {
  const deleted = await db
    .delete(idempotency)
    .where(lte(idempotency.expiresAt, now))
    .returning({ key: idempotency.key });
  return deleted.length;
}
