import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../client.js';
import { appMeta, careers, serverFirsts, serverRecords } from '../schema.js';

export const META_KEY = 'server_firsts_backfill';
export const CURSOR_KEY = 'server_firsts_cursor';

/** 기록을 가진 커리어가 지워지면(프로필 삭제) 그 자리는 다음 업로더가 아니라 실제로 가장 이른 달성자(서버
 * 기록은 그다음 최고값)에게 가야 한다 — 재계산 표시를 지워 공개 목록 조회가 전체를 다시 훑게 한다. */
export const resetFirstsBackfillStatement = (db: Db) =>
  db.delete(appMeta).where(inArray(appMeta.key, [META_KEY, CURSOR_KEY]));

/** 커리어를 공개 순위에서 뺀다(careers.hidden) — 쥐고 있던 서버 최초 기록·서버 기록을 비우고, 쥐고 있던 게 있으면 다시 훑게 해
 * 실제 달성자에게 넘긴다. 재계산 표시는 지우기 전에 확인해야 하므로 batch 맨 앞에 둔다. */
export const hideCareerStatements = (db: Db, careerId: string, guard?: SQL) => [
  db
    .delete(appMeta)
    .where(
      and(
        inArray(appMeta.key, [META_KEY, CURSOR_KEY]),
        guard,
        sql`(exists (select 1 from server_firsts where career_id = ${careerId}) or exists (select 1 from server_records where career_id = ${careerId}))`,
      ),
    ),
  db
    .update(careers)
    .set({ hidden: 1 })
    .where(and(eq(careers.id, careerId), guard)),
  db.delete(serverFirsts).where(and(eq(serverFirsts.careerId, careerId), guard)),
  db.delete(serverRecords).where(and(eq(serverRecords.careerId, careerId), guard)),
];

export const setMeta = (db: Db, key: string, value: string) =>
  db
    .insert(appMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: appMeta.key, set: { value } });
