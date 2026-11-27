import { retireAtOf } from '@offside/contracts/service-seasons';
import { and, eq, inArray } from 'drizzle-orm';
import { createDb, type Db } from '../db/client.js';
import { runBatch } from '../db/repos/batch.js';
import { readFirstsPage, rejudgeCareer, upsertFirst, upsertRecord } from '../db/repos/firsts.js';
import { firstsRepairs } from '../db/schema.js';
import { LEGEND_THRESHOLDS, RECORDS, RETIRE_CAP_FIRST, firstRule } from '../firsts.js';

type Job = typeof firstsRepairs.$inferSelect;
const pageSize = 40;
const groupSize = 16;
// NULL and zero compete together in the preseason. Equality per branch preserves index seeks.
function branches(season: number, query: (filter: string) => string) {
  const parts = [query('service_season = ?1')];
  if (season === 0) parts.push(query('service_season IS NULL'));
  return parts.join(' UNION ALL ');
}

async function repairIndexed(db: D1Database, jobs: Job[]) {
  const season = jobs[0]!.season;
  const legacy = jobs.some((j) => j.kind === 'legacy');
  const levels = legacy
    ? LEGEND_THRESHOLDS
    : jobs
        .filter((j) => j.kind === 'first' && j.id.startsWith('legend'))
        .map((j) => Number(j.id.slice(6)));
  const statements: D1PreparedStatement[] = [];
  const visible = "status='retired' AND hidden=0 AND retired_at IS NOT NULL";
  const hof = 'careers INDEXED BY careers_hof_season_score_order_idx';
  if (legacy || jobs.some((j) => j.kind === 'record')) {
    const best = branches(
      season,
      (filter) => `SELECT * FROM (SELECT id,legend_score,retired_at FROM ${hof}
      WHERE ${visible} AND ${filter} AND legend_score>0 ORDER BY legend_score DESC,retired_at,id LIMIT 1)`,
    );
    statements.push(
      db.prepare("DELETE FROM server_records WHERE season=? AND id='legend'").bind(season),
      db
        .prepare(
          `INSERT INTO server_records(season,id,career_id,value,achieved_at)
      SELECT ?1,'legend',id,legend_score,retired_at FROM (${best}) ORDER BY legend_score DESC,retired_at,id LIMIT 1`,
        )
        .bind(season),
    );
  }
  if (levels.length) {
    const bands = branches(
      season,
      (filter) => `SELECT floor,(SELECT id FROM ${hof} WHERE ${visible} AND ${filter}
      AND legend_score>=floor AND legend_score<ceiling ORDER BY retired_at,id LIMIT 1) id FROM bands`,
    );
    statements.push(
      db
        .prepare(
          "DELETE FROM server_firsts WHERE season=?1 AND id IN (SELECT 'legend'||value FROM json_each(?2))",
        )
        .bind(season, JSON.stringify(levels)),
      db
        .prepare(
          `WITH bands AS MATERIALIZED (SELECT value floor,lead(value,1,1e30) OVER (ORDER BY value) ceiling FROM json_each(?2)),
      candidates AS MATERIALIZED (${bands}), winners AS MATERIALIZED (
        SELECT floor,c.id,c.retired_at FROM candidates JOIN careers c ON c.id=candidates.id)
      INSERT INTO server_firsts(season,id,career_id,achieved_at)
      SELECT ?1,'legend'||b.floor,w.id,w.retired_at FROM bands b JOIN winners w ON w.id=
        (SELECT id FROM winners WHERE floor>=b.floor ORDER BY retired_at,id LIMIT 1)`,
        )
        .bind(season, JSON.stringify(levels)),
    );
  }
  if (jobs.some((j) => j.id === RETIRE_CAP_FIRST)) {
    statements.push(
      db.prepare("DELETE FROM server_firsts WHERE season=? AND id='retirecap'").bind(season),
    );
    if (season > 0)
      statements.push(
        db
          .prepare(
            `INSERT INTO server_firsts(season,id,career_id,achieved_at)
      SELECT ?1,'retirecap',id,retired_at FROM careers INDEXED BY careers_hof_count_idx WHERE ${visible}
        AND service_season=?1 AND pos IN ('GK','DF','MF','FW') AND retire_age=?2 ORDER BY retired_at,id LIMIT 1`,
          )
          .bind(season, retireAtOf(season)),
      );
  }
  // The deletes above can re-enqueue their slots. This batch recomputed them from live data
  // atomically, so acknowledge by slot (including the old migration's outstanding legend jobs).
  const keys = jobs.map((j) => [j.kind, j.id]);
  if (legacy) keys.push(['record', 'legend'], ...levels.map((n) => ['first', 'legend' + n]));
  statements.push(
    db
      .prepare(
        `DELETE FROM firsts_repairs WHERE season=?1 AND (kind,id) IN
    (SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]') FROM json_each(?2))`,
      )
      .bind(season, JSON.stringify(keys)),
  );
  await db.batch(statements);
}

async function repairPage(db: Db, jobs: Job[], size: number) {
  const { season, cursor } = jobs[0]!;
  const page = await readFirstsPage(db, cursor, size, season);
  const statements = [];
  for (const j of jobs) {
    if (j.kind === 'first') {
      const match = firstRule(j.id);
      let best: Parameters<typeof upsertFirst>[1] | undefined;
      for (const c of page.careers) {
        const hit = match?.(c);
        if (hit && (!best || hit.at < best.at))
          best = { ...hit, season, id: j.id, careerId: c.id, revision: c.revision };
      }
      if (best) statements.push(upsertFirst(db, best));
    } else {
      const def = RECORDS.find((d) => d.id === j.id);
      let best: Parameters<typeof upsertRecord>[1] | undefined;
      for (const c of page.careers) {
        const hit = def?.value(c);
        if (
          hit &&
          (!best || hit.value > best.value || (hit.value === best.value && hit.at < best.at))
        )
          best = { ...hit, season, id: j.id, careerId: c.id, revision: c.revision };
      }
      if (best) statements.push(upsertRecord(db, best, true));
    }
  }
  const guard = and(
    inArray(
      firstsRepairs.seq,
      jobs.map((j) => j.seq),
    ),
    eq(firstsRepairs.cursor, cursor),
    page.unchanged,
  );
  statements.push(
    page.careers.length < size
      ? db.delete(firstsRepairs).where(guard)
      : db.update(firstsRepairs).set({ cursor: page.last }).where(guard),
  );
  await runBatch(db, statements);
}

/** Prefer short jobs on alternate slices. FIFO otherwise guarantees the oldest scan some progress. */
export async function repairNextFirsts(
  db: D1Database,
  preferFast = true,
  size = pageSize,
): Promise<{ season: number } | null> {
  const job = await db
    .prepare(`SELECT * FROM firsts_repairs ORDER BY ${preferFast ? 'work,' : ''}seq LIMIT 1`)
    .first<Job>();
  if (!job) return null;
  if (job.kind === 'career') await rejudgeCareer(createDb(db), job.id, job.seq);
  else {
    const fastSlot = job.work === 0;
    const batch = await db
      .prepare(
        `SELECT * FROM firsts_repairs WHERE season=? AND cursor=? AND work=? ORDER BY seq LIMIT ?`,
      )
      .bind(job.season, job.cursor, job.work, groupSize)
      .all<Job>();
    // The queue may have changed between selection and grouping.
    if (batch.results.length) {
      if (fastSlot) await repairIndexed(db, batch.results);
      else await repairPage(createDb(db), batch.results, size);
    }
  }
  return { season: job.season };
}
