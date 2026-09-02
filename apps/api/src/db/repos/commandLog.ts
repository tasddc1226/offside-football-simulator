import { and, asc, eq, gt } from 'drizzle-orm';
import type { Db } from '../client.js';
import { commandLog } from '../schema.js';
import { runBatch } from './batch.js';

export type CommandLogRecord = {
  careerId: string;
  revision: number;
  commandId: string;
  commandType: string;
  payload: Record<string, unknown>;
  resultHash: string;
  createdAt: string;
};

function toRecord(row: typeof commandLog.$inferSelect): CommandLogRecord {
  return {
    careerId: row.careerId,
    revision: row.revision,
    commandId: row.commandId,
    commandType: row.commandType,
    payload: JSON.parse(row.payloadJson) as Record<string, unknown>,
    resultHash: row.resultHash,
    createdAt: row.createdAt,
  };
}

export type AppendCommandEntry = {
  revision: number;
  commandId: string;
  commandType: string;
  payload: Record<string, unknown>;
  resultHash: string;
  createdAt: string;
};

/** batch 안의 한 항목이 `(career_id, revision)` PK 충돌이면 전부 롤백된다(설계 결정 2). */
export async function appendCommands(db: Db, careerId: string, entries: AppendCommandEntry[]): Promise<void> {
  if (entries.length === 0) return;
  await runBatch(
    db,
    entries.map((entry) =>
      db.insert(commandLog).values({
        careerId,
        revision: entry.revision,
        commandId: entry.commandId,
        commandType: entry.commandType,
        payloadJson: JSON.stringify(entry.payload),
        resultHash: entry.resultHash,
        createdAt: entry.createdAt,
      }),
    ),
  );
}

export async function listCommandsSince(db: Db, careerId: string, afterRevision: number): Promise<CommandLogRecord[]> {
  const rows = await db
    .select()
    .from(commandLog)
    .where(and(eq(commandLog.careerId, careerId), gt(commandLog.revision, afterRevision)))
    .orderBy(asc(commandLog.revision));
  return rows.map(toRecord);
}
