import { CheckpointTypeSchema, RngStateSchema, type CheckpointType, type RngState } from '@offside/contracts';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../client.js';
import { snapshots } from '../schema.js';

export type SnapshotRecord = {
  id: string;
  careerId: string;
  revision: number;
  checkpoint: CheckpointType;
  state: string;
  stateHash: string;
  rulesetVersion: string;
  contentPackVersion: string;
  rngState: RngState;
  createdAt: string;
};

function toRecord(row: typeof snapshots.$inferSelect): SnapshotRecord {
  return {
    id: row.id,
    careerId: row.careerId,
    revision: row.revision,
    checkpoint: CheckpointTypeSchema.parse(row.checkpoint),
    state: row.state,
    stateHash: row.stateHash,
    rulesetVersion: row.rulesetVersion,
    contentPackVersion: row.contentPackVersion,
    rngState: RngStateSchema.parse(JSON.parse(row.rngStateJson)),
    createdAt: row.createdAt,
  };
}

export type PutSnapshotInput = {
  careerId: string;
  revision: number;
  checkpoint: CheckpointType;
  state: string;
  stateHash: string;
  rulesetVersion: string;
  contentPackVersion: string;
  rngState: RngState;
  createdAt: string;
};

/** `(career_id, revision)` UNIQUE가 중복 삽입을 실패시킨다(설계 결정 2). */
export async function putSnapshot(db: Db, input: PutSnapshotInput): Promise<SnapshotRecord> {
  const [row] = await db
    .insert(snapshots)
    .values({
      id: `${input.careerId}:${input.revision}`,
      careerId: input.careerId,
      revision: input.revision,
      checkpoint: input.checkpoint,
      state: input.state,
      stateHash: input.stateHash,
      rulesetVersion: input.rulesetVersion,
      contentPackVersion: input.contentPackVersion,
      rngStateJson: JSON.stringify(input.rngState),
      createdAt: input.createdAt,
    })
    .returning();
  return toRecord(row!);
}

/** 설계 결정 4(멱등)에서 요청 `(revision, stateHash)`가 이미 반영됐는지 확인하는 데 쓴다. */
export async function getSnapshotByRevision(db: Db, careerId: string, revision: number): Promise<SnapshotRecord | undefined> {
  const [row] = await db
    .select()
    .from(snapshots)
    .where(and(eq(snapshots.careerId, careerId), eq(snapshots.revision, revision)));
  return row ? toRecord(row) : undefined;
}

export async function getLatestSnapshot(db: Db, careerId: string): Promise<SnapshotRecord | undefined> {
  const [row] = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.careerId, careerId))
    .orderBy(desc(snapshots.revision))
    .limit(1);
  return row ? toRecord(row) : undefined;
}

export async function listSnapshots(
  db: Db,
  careerId: string,
  { limit }: { limit: number },
): Promise<SnapshotRecord[]> {
  const rows = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.careerId, careerId))
    .orderBy(desc(snapshots.revision))
    .limit(limit);
  return rows.map(toRecord);
}

/** 최근 checkpoint `keep`개만 남긴다(02 "최근 checkpoint 5개"). */
export async function pruneSnapshots(db: Db, careerId: string, keep = 5): Promise<void> {
  const rows = await db
    .select({ revision: snapshots.revision })
    .from(snapshots)
    .where(eq(snapshots.careerId, careerId))
    .orderBy(desc(snapshots.revision));

  const toDelete = rows.slice(keep).map((row) => row.revision);
  if (toDelete.length === 0) return;

  await db.delete(snapshots).where(and(eq(snapshots.careerId, careerId), inArray(snapshots.revision, toDelete)));
}
