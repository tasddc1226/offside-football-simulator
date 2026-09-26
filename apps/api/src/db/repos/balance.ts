import { sanitizeBalance, type BalanceVersion } from '@offside/contracts';
import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '../client.js';
import { newId } from '../ids.js';
import { auditLog, balanceVersions } from '../schema.js';
import { runBatch } from './batch.js';

// T-10-016 밸런스 설정 버전. 활성은 늘 하나 — 다른 버전을 활성화하면 이전 활성은 archived가 된다.
const HISTORY_MAX = 100;

type Row = typeof balanceVersions.$inferSelect;
/** 저장 뒤 스펙(키·범위)이 바뀌었을 수 있으니 읽을 때도 거른다. */
const toVersion = ({ valuesJson, createdBy: _createdBy, ...r }: Row): BalanceVersion => ({
  ...r,
  values: sanitizeBalance(JSON.parse(valuesJson)),
});

export async function getActiveBalance(db: Db): Promise<BalanceVersion | undefined> {
  const [row] = await db
    .select()
    .from(balanceVersions)
    .where(eq(balanceVersions.status, 'active'))
    .limit(1);
  return row && toVersion(row);
}

export async function getBalanceVersion(
  db: Db,
  version: number,
): Promise<BalanceVersion | undefined> {
  const [row] = await db.select().from(balanceVersions).where(eq(balanceVersions.version, version));
  return row && toVersion(row);
}

/** 최신 버전부터. */
export async function listBalanceVersions(db: Db): Promise<BalanceVersion[]> {
  const rows = await db
    .select()
    .from(balanceVersions)
    .orderBy(desc(balanceVersions.version))
    .limit(HISTORY_MAX);
  return rows.map(toVersion);
}

export async function createBalanceDraft(
  db: Db,
  input: { note: string; values: unknown },
  profileId: string,
  now: string,
): Promise<BalanceVersion> {
  const [row] = await db
    .insert(balanceVersions)
    .values({
      status: 'draft',
      note: input.note,
      valuesJson: JSON.stringify(sanitizeBalance(input.values)),
      createdBy: profileId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return toVersion(row!);
}

const draft = (version: number) =>
  and(eq(balanceVersions.version, version), eq(balanceVersions.status, 'draft'));

/** 초안만 고친다. 없거나 초안이 아니면 undefined. */
export async function updateBalanceDraft(
  db: Db,
  version: number,
  input: { note: string; values: unknown },
  now: string,
): Promise<BalanceVersion | undefined> {
  const [row] = await db
    .update(balanceVersions)
    .set({
      note: input.note,
      valuesJson: JSON.stringify(sanitizeBalance(input.values)),
      updatedAt: now,
    })
    .where(draft(version))
    .returning();
  return row && toVersion(row);
}

export async function deleteBalanceDraft(db: Db, version: number) {
  const res = await db.delete(balanceVersions).where(draft(version));
  return res.meta.changes > 0;
}

/** 이전 활성 → archived, 이 버전 → active, 감사 로그를 한 트랜잭션으로. 되돌리기도 옛 버전을 이걸로 다시 켠다. */
export async function activateBalance(
  db: Db,
  version: number,
  previous: number | null,
  profileId: string,
  now: string,
) {
  await runBatch(db, [
    db
      .update(balanceVersions)
      .set({ status: 'archived', updatedAt: now })
      .where(eq(balanceVersions.status, 'active')),
    db
      .update(balanceVersions)
      .set({ status: 'active', activatedAt: now, updatedAt: now })
      .where(eq(balanceVersions.version, version)),
    db.insert(auditLog).values({
      id: newId('aud'),
      kind: 'BALANCE_ACTIVATED',
      profileId,
      payloadJson: JSON.stringify({ version, previous }),
      createdAt: now,
    }),
  ]);
}
