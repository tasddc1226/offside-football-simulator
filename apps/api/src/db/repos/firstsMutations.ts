import { and, eq, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../client.js';
import { appMeta, careers, firstsRepairs, serverFirsts, serverRecords } from '../schema.js';

export const META_KEY = 'server_firsts_backfill';
export const CURSOR_KEY = 'server_firsts_cursor';

// Queue before the existing career write, in the same D1 transaction. A new sequence
// invalidates stale workers even if the previous job was still pending.
export const queueFirstsRejudge = (db: Db, id: string, when: SQL) =>
  db
    .insert(firstsRepairs)
    .select(
      sql`SELECT NULL, 1, coalesce(service_season,0), 'career', id, 0 FROM careers
      WHERE id=${id} AND ${when}`,
    )
    .onConflictDoUpdate({
      target: [firstsRepairs.season, firstsRepairs.kind, firstsRepairs.id],
      set: { seq: sql`excluded.seq` },
    });

// Fold the generation into the career write already required by the caller.
export const queuedFirstsRevision = sql<number>`coalesce((SELECT seq FROM firsts_repairs
  WHERE season=coalesce(careers.service_season,0) AND kind='career' AND id=careers.id),careers.firsts_revision)`;

export const hideCareerStatements = (db: Db, careerId: string, guard?: SQL) => [
  db
    .update(careers)
    .set({ hidden: 1 })
    .where(and(eq(careers.id, careerId), eq(careers.hidden, 0), guard)),
  db.delete(serverFirsts).where(and(eq(serverFirsts.careerId, careerId), guard)),
  db.delete(serverRecords).where(and(eq(serverRecords.careerId, careerId), guard)),
];

export const setMeta = (db: Db, key: string, value: string) =>
  db
    .insert(appMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: appMeta.key, set: { value } });
