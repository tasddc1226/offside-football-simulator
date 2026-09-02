import { and, asc, desc, eq, gt, lt, or } from 'drizzle-orm';
import type { Db } from '../client.js';
import { careers } from '../schema.js';

export type CareerRecord = typeof careers.$inferSelect;
export type CareerStatus = CareerRecord['status'];

export async function getCareer(db: Db, id: string): Promise<CareerRecord | undefined> {
  const [row] = await db.select().from(careers).where(eq(careers.id, id));
  return row;
}

export type ListCareersResult = { items: CareerRecord[]; nextCursor: string | null };

function encodeCursor(updatedAt: string, id: string): string {
  return Buffer.from(`${updatedAt}|${id}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { updatedAt: string; id: string } {
  const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  const separatorIndex = decoded.indexOf('|');
  return { updatedAt: decoded.slice(0, separatorIndex), id: decoded.slice(separatorIndex + 1) };
}

/** `updated_at DESC, id ASC` 안정 정렬. cursor는 `${updatedAt}|${id}` base64url. */
export async function listCareersByOwner(
  db: Db,
  ownerProfileId: string,
  { limit, cursor }: { limit: number; cursor?: string | null },
): Promise<ListCareersResult> {
  const conditions = [eq(careers.ownerProfileId, ownerProfileId)];
  if (cursor) {
    const { updatedAt, id } = decodeCursor(cursor);
    const cursorCondition = or(
      lt(careers.updatedAt, updatedAt),
      and(eq(careers.updatedAt, updatedAt), gt(careers.id, id)),
    );
    if (cursorCondition) conditions.push(cursorCondition);
  }

  const rows = await db
    .select()
    .from(careers)
    .where(and(...conditions))
    .orderBy(desc(careers.updatedAt), asc(careers.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.updatedAt, last.id) : null;
  return { items, nextCursor };
}

export type InsertCareerInput = {
  id: string;
  ownerProfileId: string;
  status: CareerStatus;
  revision: number;
  createdServiceSeasonId: string;
  rulesetVersion: string;
  contentPackVersion: string;
  verificationStatus?: CareerRecord['verificationStatus'];
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
};

export async function insertCareer(db: Db, input: InsertCareerInput): Promise<CareerRecord> {
  const [row] = await db.insert(careers).values(input).returning();
  return row!;
}

/** 낙관적 잠금(설계 결정 2). 영향 행 수를 돌려준다: 0이면 `fromRevision`이 서버 상태와 달라 충돌. */
export async function updateCareerRevision(
  db: Db,
  id: string,
  {
    fromRevision,
    toRevision,
    updatedAt,
    status,
  }: { fromRevision: number; toRevision: number; updatedAt: string; status?: CareerStatus },
): Promise<number> {
  const result = await db
    .update(careers)
    .set({
      revision: toRevision,
      updatedAt,
      lastSyncedAt: updatedAt,
      ...(status ? { status } : {}),
    })
    .where(and(eq(careers.id, id), eq(careers.revision, fromRevision)))
    .returning({ id: careers.id });
  return result.length;
}
