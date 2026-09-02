import { and, asc, desc, eq, gt, lt, or } from 'drizzle-orm';
import type { Db } from '../client.js';
import { careers, commandLog, snapshots } from '../schema.js';
import { runBatch } from './batch.js';

export type CareerRecord = typeof careers.$inferSelect;
export type CareerStatus = CareerRecord['status'];

export async function getCareer(db: Db, id: string): Promise<CareerRecord | undefined> {
  const [row] = await db.select().from(careers).where(eq(careers.id, id));
  return row;
}

/** T-1-004: 복구 병합·프로필 삭제가 쓴다. 페이지 없이 소유한 커리어 id 전부를 돌려준다. */
export async function listCareerIdsByOwner(db: Db, ownerProfileId: string): Promise<string[]> {
  const rows = await db.select({ id: careers.id }).from(careers).where(eq(careers.ownerProfileId, ownerProfileId));
  return rows.map((row) => row.id);
}

export async function countCareersByOwner(db: Db, ownerProfileId: string): Promise<number> {
  return (await listCareerIdsByOwner(db, ownerProfileId)).length;
}

/** API-CAR-005: 커리어와 그 Snapshot·명령 로그를 한 트랜잭션으로 즉시 삭제한다. */
export async function deleteCareerCascade(db: Db, careerId: string): Promise<void> {
  await runBatch(db, [
    db.delete(snapshots).where(eq(snapshots.careerId, careerId)),
    db.delete(commandLog).where(eq(commandLog.careerId, careerId)),
    db.delete(careers).where(eq(careers.id, careerId)),
  ]);
}

export type ListCareersResult = { items: CareerRecord[]; nextCursor: string | null };

/** Workers 런타임(nodejs_compat 없음)에는 Node 전용 바이너리 유틸이 없다. `btoa`/`atob` + `TextEncoder`/`TextDecoder`로 base64url을 구현한다. */
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeCursor(updatedAt: string, id: string): string {
  return toBase64Url(`${updatedAt}|${id}`);
}

function decodeCursor(cursor: string): { updatedAt: string; id: string } {
  const decoded = fromBase64Url(cursor);
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
