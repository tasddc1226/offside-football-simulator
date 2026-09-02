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

export async function putIdempotent(db: Db, input: PutIdempotentInput): Promise<void> {
  await db.insert(idempotency).values(input);
}

export async function purgeExpired(db: Db, now: string): Promise<number> {
  const deleted = await db.delete(idempotency).where(lte(idempotency.expiresAt, now)).returning({ key: idempotency.key });
  return deleted.length;
}
