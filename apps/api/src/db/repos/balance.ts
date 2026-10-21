import {
  BalancePatchSchema,
  resolveBalance,
  sanitizeBalance,
  type BalanceHistory,
  type BalancePatch,
  type BalanceVersion,
} from '@offside/contracts';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import type { Db } from '../client.js';
import { newId } from '../ids.js';
import { auditLog, balancePatches, balanceVersions } from '../schema.js';
import { runBatch } from './batch.js';

// T-10-016 밸런스 설정 버전. 활성은 늘 하나 — 다른 버전을 활성화하면 이전 활성은 archived가 된다.
const HISTORY_MAX = 100;

type Row = typeof balanceVersions.$inferSelect;
/** 저장 뒤 스펙(키·범위)이 바뀌었을 수 있으니 읽을 때도 거른다. */
export const balanceVersionOf = ({
  valuesJson,
  createdBy: _createdBy,
  ...r
}: Row): BalanceVersion => ({
  ...r,
  values: sanitizeBalance(JSON.parse(valuesJson)),
});
const toVersion = balanceVersionOf;

/** 활성 버전 조회문(다른 읽기와 한 batch로 보낼 때). 결과 행은 balanceVersionOf로 푼다. */
export const activeBalanceQuery = (db: Db) =>
  db.select().from(balanceVersions).where(eq(balanceVersions.status, 'active')).limit(1);

export async function getActiveBalance(db: Db): Promise<BalanceVersion | undefined> {
  const [row] = await activeBalanceQuery(db);
  return row && toVersion(row);
}

/** T-11-376 활성 버전의 지난 시즌 선수 급여 예산(없으면 기본값). 활성 행을 batch로 읽었으면 그 행을 넘긴다. */
export const pastSalaryBudgetFrom = (row: Row | undefined) =>
  resolveBalance(row && toVersion(row).values).pastSalaryBudget;
export async function pastSalaryBudgetOf(db: Db): Promise<number> {
  const [row] = await activeBalanceQuery(db);
  return pastSalaryBudgetFrom(row);
}

export async function getBalanceVersion(
  db: Db,
  version: number,
): Promise<BalanceVersion | undefined> {
  const [row] = await db.select().from(balanceVersions).where(eq(balanceVersions.version, version));
  return row && toVersion(row);
}

/** T-11-141 공개 이력: 한 번이라도 적용된 버전(적용 시각이 있는 것), 최근 적용 순. 운영 메모는 읽지 않는다.
 * T-11-333 코드 배포 패치(balance_patches)도 같은 응답에 최근 적용 순으로 싣는다 — 두 조회를 한 batch로 보낸다. */
export async function listAppliedBalanceVersions(db: Db, limit: number): Promise<BalanceHistory> {
  const [rows, patches] = await db.batch([
    db
      .select({
        version: balanceVersions.version,
        status: balanceVersions.status,
        valuesJson: balanceVersions.valuesJson,
        activatedAt: balanceVersions.activatedAt,
      })
      .from(balanceVersions)
      .where(isNotNull(balanceVersions.activatedAt))
      .orderBy(desc(balanceVersions.activatedAt))
      .limit(limit),
    db.select().from(balancePatches).orderBy(desc(balancePatches.appliedAt)).limit(limit),
  ]);
  return {
    versions: rows.map((r) => ({
      version: r.version,
      values: sanitizeBalance(JSON.parse(r.valuesJson)),
      activatedAt: r.activatedAt!,
      active: r.status === 'active',
    })),
    patches: patches.flatMap(balancePatchOf),
  };
}

/** 저장 뒤 스펙에서 빠진 키가 있을 수 있어 스키마로 걸러 읽는다(안 맞는 행은 이력에서 뺀다). */
export function balancePatchOf(r: typeof balancePatches.$inferSelect): BalancePatch[] {
  const parsed = BalancePatchSchema.safeParse({
    id: r.id,
    appliedAt: r.appliedAt,
    title: JSON.parse(r.titleJson),
    items: JSON.parse(r.itemsJson),
    changes: r.changesJson ? JSON.parse(r.changesJson) : [],
    postId: r.postId,
  });
  return parsed.success ? [parsed.data] : [];
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
  /** T-10-090 시즌 진행 중 잠금을 풀고 활성화했으면 그 시즌 id(감사 로그에 남긴다). */
  seasonOverride?: number,
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
      payloadJson: JSON.stringify({ version, previous, seasonOverride }),
      createdAt: now,
    }),
  ]);
}

/** T-11-418e 활성 버전의 리그 홈 이점(없으면 기본값). */
export async function leagueHomeAdvOf(db: Db): Promise<number> {
  const [row] = await activeBalanceQuery(db);
  return resolveBalance(row && toVersion(row).values).leagueHomeAdv;
}
