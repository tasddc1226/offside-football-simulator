import type { Bindings } from '../env.js';
import { DAY_MS } from '../time.js';
import { gzipToR2 } from './backup.js';

/** Events are upload telemetry, never read for gameplay, records or fraud checks.
 * Keep recent telemetry in D1 and immutable older batches in R2. Signals/growth,
 * season summaries, snapshots and the dormant-career policy are untouched. */
export const EVENT_KEEP_DAYS = 7;
export const EVENT_ARCHIVE_META_KEY = 'cron:season-events:last';
const LEASE_KEY = 'cron:season-events:lease';
const PAGE_BYTES = 512 * 1024;
const PAGE_ROWS = 200;
const MAX_PAGES = 100;
const INTERVAL_MS = 60 * 60_000;

type Row = {
  rowid: number;
  career_id: string;
  year: number;
  created_at: string;
  events_json: string;
};
export type EventArchiveResult = {
  at: number;
  objects: number;
  archived: number;
  raced: number;
  bytes: number;
};

/** Bounded to 200 page read/write queries and 50MiB target per hour; retries use a DB lease.
 * Upload must complete before exact-value CAS clears any telemetry. */
export async function runSeasonEventsArchive(
  env: Bindings,
  now: number,
): Promise<EventArchiveResult | null> {
  if (env.ENVIRONMENT !== 'production' || !env.BACKUP || env.SEASON_EVENTS_ARCHIVE_DISABLED === '1')
    return null;
  const previous = await env.DB.prepare('SELECT value FROM app_meta WHERE key=?')
    .bind(EVENT_ARCHIVE_META_KEY)
    .first<{ value: string }>();
  if (previous && now - (JSON.parse(previous.value) as EventArchiveResult).at < INTERVAL_MS)
    return null;
  const wall = Date.now();
  const lease = JSON.stringify({ token: crypto.randomUUID(), expiresAt: wall + 16 * 60_000 });
  const claimed = await env.DB.prepare(
    `INSERT INTO app_meta(key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value
     WHERE CAST(json_extract(app_meta.value,'$.expiresAt') AS INTEGER) <= ?3 RETURNING value`,
  )
    .bind(LEASE_KEY, lease, wall)
    .first();
  if (!claimed) return null;
  try {
    const result: EventArchiveResult = { at: now, objects: 0, archived: 0, raced: 0, bytes: 0 };
    const cutoff = new Date(now - EVENT_KEEP_DAYS * DAY_MS).toISOString();
    let at = '';
    let rowid = 0;
    let candidates = 32;
    for (let page = 0; page < MAX_PAGES && Date.now() - wall < 60_000; page++) {
      const { results: rows } = await env.DB.prepare(
        `WITH candidates AS MATERIALIZED (
           SELECT rowid AS rid, created_at AS at, length(CAST(events_json AS BLOB)) + 128 AS bytes
           FROM career_seasons INDEXED BY career_seasons_events_created_idx
           WHERE events_json <> '[]' AND created_at < ?1
           AND (created_at > ?2 OR (created_at = ?2 AND rowid > ?3))
           ORDER BY created_at, rowid LIMIT ${candidates}
         ), sized AS (
           SELECT rid, sum(bytes) OVER (ORDER BY at, rid) AS bytes,
                  row_number() OVER (ORDER BY at, rid) AS n FROM candidates
         )
         SELECT rowid, career_id, year, created_at, events_json FROM career_seasons
         WHERE rowid IN (SELECT rid FROM sized WHERE bytes <= ?4 OR n = 1)
         ORDER BY created_at, rowid`,
      )
        .bind(cutoff, at, rowid, PAGE_BYTES)
        .all<Row>();
      if (!rows.length) break;
      const key = `season-events/${env.ENVIRONMENT}/${new Date(now).toISOString().slice(0, 10)}/${crypto.randomUUID()}.ndjson.gz`;
      result.bytes += await gzipToR2(env.BACKUP, key, 'application/x-ndjson', async (write) => {
        for (const r of rows)
          await write(
            `{"version":1,"careerId":${JSON.stringify(r.career_id)},"year":${r.year},"createdAt":${JSON.stringify(r.created_at)},"events":${r.events_json}}\n`,
          );
      });
      result.objects++;
      // Do not blank an upsert that happened while R2 was uploading. Rowid alone
      // is insufficient: deleted rows can reuse it, so also compare career/year.
      const only = rows.length === 1 ? rows[0]! : null;
      // A legacy single row can approach D1's value limit. Binding its original
      // text directly avoids doubling escape bytes inside a JSON staging array.
      const cleared = only
        ? await env.DB.prepare(
            `UPDATE career_seasons SET events_json='[]' WHERE rowid=?1 AND career_id=?2
         AND year=?3 AND created_at=?4 AND events_json=?5`,
          )
            .bind(only.rowid, only.career_id, only.year, only.created_at, only.events_json)
            .run()
        : await env.DB.prepare(
            `UPDATE career_seasons SET events_json='[]' WHERE EXISTS (
           SELECT 1 FROM json_each(?1) AS staged WHERE career_seasons.rowid=json_extract(staged.value,'$.rowid')
           AND career_seasons.career_id=json_extract(staged.value,'$.career_id')
           AND career_seasons.year=json_extract(staged.value,'$.year')
           AND career_seasons.created_at=json_extract(staged.value,'$.created_at')
           AND career_seasons.events_json=json_extract(staged.value,'$.events_json')
         ) AND rowid IN (SELECT json_extract(value,'$.rowid') FROM json_each(?1))`,
          )
            .bind(JSON.stringify(rows))
            .run();
      result.archived += cleared.meta.changes;
      result.raced += rows.length - cleared.meta.changes;
      const tail = rows.at(-1)!;
      at = tail.created_at;
      rowid = tail.rowid;
      candidates = rows.length < candidates ? rows.length : Math.min(PAGE_ROWS, candidates * 2);
    }
    await env.DB.prepare(
      'INSERT INTO app_meta(key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    )
      .bind(EVENT_ARCHIVE_META_KEY, JSON.stringify(result))
      .run();
    return result;
  } finally {
    await env.DB.prepare('DELETE FROM app_meta WHERE key=?1 AND value=?2')
      .bind(LEASE_KEY, lease)
      .run();
  }
}
