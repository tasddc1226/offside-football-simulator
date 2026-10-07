/** Dormant careers keep their identity and scores. Only bulky observation logs move to R2. */
import { activeSeason } from '@offside/contracts/service-seasons';
import type { Bindings } from '../env.js';
import { DAY_MS } from '../time.js';
import { gzipToR2 } from './backup.js';

export const RETENTION = { dormantDays: 30, archiveDays: 90, observeDays: 30, page: 50 } as const;
export const RETENTION_STATE_KEY = 'cron:career-retention:state';
export const RETENTION_REPORT_KEY = 'cron:career-retention:last';
const PREFIX = (env: string) => `career-details/${env}/`;

type State = {
  startedAt: string;
  nextReportAt: string;
  nextArchiveAt: string;
  sweepCursor?: string;
};
type Candidate = { id: string; profile_id: string; updated_at: string };
type Detail = {
  year: number;
  events_json: string;
  signals_json: string | null;
  growth_json: string | null;
};
type Archive = { version: 1; careerId: string; rows: Detail[] };
export type RetentionResult = {
  mode: 'skipped' | 'busy' | 'observe' | 'archive' | 'idle';
  archived: number;
  bytes: number;
  raced: number;
  orphanObjects: number;
  report?: { active: number; dormant: number; candidates: number; archived: number };
};

/** All NOT EXISTS lookups have career-id indexes. Bind 1=cutoff, 2=current service season. */
const eligible = `c.status = 'active' AND c.updated_at <= ?1 AND c.detail_archive_key IS NULL
  AND (?2 IS NULL OR c.service_season IS NULL OR c.service_season <> ?2)
  AND c.title IS NULL AND c.wall_of_honor_json IS NULL
  AND (SELECT count(*) FROM career_seasons s WHERE s.career_id = c.id) BETWEEN 1 AND 3
  AND NOT EXISTS (SELECT 1 FROM cards r WHERE r.career_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM market_listings r WHERE r.career_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM server_firsts r WHERE r.career_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM server_records r WHERE r.career_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM retired_numbers r WHERE r.career_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM owner_season_records r WHERE r.best_career_id = c.id)
  AND EXISTS (SELECT 1 FROM career_seasons s WHERE s.career_id = c.id
    AND (s.events_json <> '[]' OR s.signals_json IS NOT NULL OR s.growth_json IS NOT NULL))`;

async function saveState(db: D1Database, state: State) {
  await db
    .prepare(
      'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    )
    .bind(RETENTION_STATE_KEY, JSON.stringify(state))
    .run();
}

/** Incrementally removes only unreferenced objects, after 7 days (never an in-flight upload). */
async function sweepOrphans(
  db: D1Database,
  bucket: R2Bucket,
  env: string,
  now: number,
  state: State,
) {
  const listed = await bucket.list({
    prefix: PREFIX(env),
    limit: 100,
    ...(state.sweepCursor && { cursor: state.sweepCursor }),
  });
  const old = listed.objects.filter((o) => o.uploaded.getTime() <= now - 7 * DAY_MS);
  let removed = 0;
  if (old.length) {
    // Restored objects may still be referenced by historical D1 backups. Keep them while that career exists.
    const ids = old.map((o) => decodeURIComponent(o.key.slice(PREFIX(env).length).split('/')[0]!));
    const refs = await db
      .prepare(
        'SELECT id, detail_archive_key FROM careers WHERE id IN (SELECT value FROM json_each(?1)) OR detail_archive_key IN (SELECT value FROM json_each(?2))',
      )
      .bind(JSON.stringify(ids), JSON.stringify(old.map((o) => o.key)))
      .all<{ id: string; detail_archive_key: string | null }>();
    const keepIds = new Set(refs.results.map((r) => r.id));
    const keepKeys = new Set(refs.results.map((r) => r.detail_archive_key));
    const keys = old
      .filter((o, i) => !keepIds.has(ids[i]!) && !keepKeys.has(o.key))
      .map((o) => o.key);
    if (keys.length) {
      await bucket.delete(keys);
      removed = keys.length;
    }
  }
  if (listed.truncated) state.sweepCursor = listed.cursor;
  else delete state.sweepCursor;
  return removed;
}

export async function runCareerRetention(env: Bindings, now: number): Promise<RetentionResult> {
  const empty: RetentionResult = {
    mode: 'skipped',
    archived: 0,
    bytes: 0,
    raced: 0,
    orphanObjects: 0,
  };
  if (env.ENVIRONMENT !== 'production' || !env.BACKUP || env.CAREER_RETENTION_DISABLED === '1')
    return empty;
  // A short DB lease prevents overlapping/retried cron invocations from multiplying the batch limit.
  const wall = Date.now();
  const lease = JSON.stringify({ token: crypto.randomUUID(), expiresAt: wall + 16 * 60_000 });
  const claimed = await env.DB.prepare(
    `INSERT INTO app_meta(key,value) VALUES ('cron:career-retention:lease',?1)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(json_extract(app_meta.value,'$.expiresAt') AS INTEGER) <= ?2
    RETURNING value`,
  )
    .bind(lease, wall)
    .first();
  if (!claimed) return { ...empty, mode: 'busy' };
  try {
    return await retainCareers(env, now);
  } finally {
    await env.DB.prepare("DELETE FROM app_meta WHERE key='cron:career-retention:lease' AND value=?")
      .bind(lease)
      .run();
  }
}

async function retainCareers(env: Bindings, now: number): Promise<RetentionResult> {
  const result: RetentionResult = {
    mode: 'skipped',
    archived: 0,
    bytes: 0,
    raced: 0,
    orphanObjects: 0,
  };
  if (!env.BACKUP) return result;
  const db = env.DB;
  const at = new Date(now).toISOString();
  const raw = await db
    .prepare('SELECT value FROM app_meta WHERE key=?')
    .bind(RETENTION_STATE_KEY)
    .first<{ value: string }>();
  const state: State = raw
    ? (JSON.parse(raw.value) as State)
    : {
        startedAt: at,
        nextReportAt: at,
        nextArchiveAt: new Date(now + RETENTION.observeDays * DAY_MS).toISOString(),
      };
  if (
    ![state.startedAt, state.nextReportAt, state.nextArchiveAt].every(
      (v) => typeof v === 'string' && Number.isFinite(Date.parse(v)),
    )
  )
    throw new Error('Invalid career retention state');
  // Persist first-run clock before doing any work. Deployment date is not hard-coded.
  if (!raw) await saveState(db, state);
  const cutoff = new Date(now - RETENTION.archiveDays * DAY_MS).toISOString();
  const season = activeSeason(at)?.id ?? null;
  result.mode =
    now < Date.parse(state.startedAt) + RETENTION.observeDays * DAY_MS ? 'observe' : 'idle';
  if (at >= state.nextReportAt) {
    const counts = await db
      .prepare(
        `SELECT count(*) active,
      sum(updated_at <= ?1) dormant, sum(detail_archive_key IS NOT NULL) archived
      FROM careers WHERE status='active'`,
      )
      .bind(new Date(now - RETENTION.dormantDays * DAY_MS).toISOString())
      .first<{ active: number; dormant: number | null; archived: number | null }>();
    const candidates = await db
      .prepare(
        `SELECT count(*) n FROM careers c INDEXED BY careers_status_updated_idx WHERE ${eligible}`,
      )
      .bind(cutoff, season)
      .first<{ n: number }>();
    result.report = {
      active: counts!.active,
      dormant: counts!.dormant ?? 0,
      archived: counts!.archived ?? 0,
      candidates: candidates!.n,
    };
    state.nextReportAt = new Date(now + 7 * DAY_MS).toISOString();
    await db
      .prepare(
        'INSERT INTO app_meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      )
      .bind(RETENTION_REPORT_KEY, JSON.stringify({ at, ...result.report }))
      .run();
  }
  if (result.mode !== 'observe' && at >= state.nextArchiveAt) {
    result.mode = 'archive';
    const page = await db
      .prepare(
        `SELECT c.id, c.profile_id, c.updated_at FROM careers c INDEXED BY careers_status_updated_idx WHERE ${eligible}
      ORDER BY c.updated_at, c.id LIMIT ${RETENTION.page}`,
      )
      .bind(cutoff, season)
      .all<Candidate>();
    const byCareer = new Map<string, Detail[]>();
    if (page.results.length) {
      const details = await db
        .prepare(
          `SELECT career_id, year, events_json, signals_json, growth_json
        FROM career_seasons WHERE career_id IN (SELECT value FROM json_each(?)) ORDER BY career_id, year LIMIT ${RETENTION.page * 3}`,
        )
        .bind(JSON.stringify(page.results.map((c) => c.id)))
        .all<Detail & { career_id: string }>();
      for (const { career_id, ...row } of details.results) {
        const rows = byCareer.get(career_id) ?? [];
        rows.push(row);
        byCareer.set(career_id, rows);
      }
    }
    for (const c of page.results) {
      const rows = byCareer.get(c.id) ?? [];
      if (rows.length < 1 || rows.length > 3) {
        result.raced++;
        continue;
      }
      const archive: Archive = { version: 1, careerId: c.id, rows };
      const key = `${PREFIX(env.ENVIRONMENT)}${encodeURIComponent(c.id)}/${crypto.randomUUID()}.json.gz`;
      const bytes = await gzipToR2(env.BACKUP, key, 'application/json', async (write) => {
        await write(JSON.stringify(archive));
      });
      // CAS all rows as well as the header: a retry, new season, retirement or growth archive may have raced with R2.
      const saved = await db.batch([
        db
          .prepare(
            `UPDATE careers AS c SET detail_archive_key=?3 WHERE ${eligible} AND c.id=?4
          AND c.profile_id=?5 AND c.updated_at=?6
          AND (SELECT count(*) FROM career_seasons s WHERE s.career_id=c.id)=json_array_length(?7)
          AND (SELECT count(*) FROM career_seasons s JOIN json_each(?7) j ON s.year=json_extract(j.value,'$.year')
            WHERE s.career_id=c.id AND s.events_json=json_extract(j.value,'$.events_json')
            AND s.signals_json IS json_extract(j.value,'$.signals_json')
            AND s.growth_json IS json_extract(j.value,'$.growth_json')) = json_array_length(?7)`,
          )
          .bind(cutoff, season, key, c.id, c.profile_id, c.updated_at, JSON.stringify(rows)),
        db
          .prepare(
            `UPDATE career_seasons SET events_json='[]', signals_json=NULL, growth_json=NULL
          WHERE career_id=?1 AND EXISTS (SELECT 1 FROM careers WHERE id=?1 AND detail_archive_key=?2)`,
          )
          .bind(c.id, key),
      ]);
      if (saved[0]!.meta.changes) {
        result.archived++;
        result.bytes += bytes;
      } else {
        result.raced++;
        await env.BACKUP.delete(key);
      }
    }
    // Continue a bounded backlog next day; after draining it, wait until the next calendar month.
    if (page.results.length < RETENTION.page) {
      const next = new Date(now);
      next.setUTCMonth(next.getUTCMonth() + 1, 1);
      next.setUTCHours(0, 0, 0, 0);
      state.nextArchiveAt = next.toISOString();
    }
  }
  result.orphanObjects = await sweepOrphans(db, env.BACKUP, env.ENVIRONMENT, now, state);
  await saveState(db, state);
  return result;
}

/** Called only after authenticated ownership/body checks. No R2 request for ordinary careers. */
export async function restoreCareerDetails(
  env: Bindings,
  careerId: string,
  profileId: string,
  key: string | null,
  now: string,
): Promise<void> {
  if (!key) return;
  if (!env.BACKUP) throw new Error('Career details archive storage is unavailable');
  const object = await env.BACKUP.get(key);
  if (!object) throw new Error('Career details archive is missing');
  const text = await new Response(object.body.pipeThrough(new DecompressionStream('gzip'))).text();
  const archive = JSON.parse(text) as Archive;
  if (
    archive.version !== 1 ||
    archive.careerId !== careerId ||
    !Array.isArray(archive.rows) ||
    archive.rows.length < 1 ||
    archive.rows.length > 3
  )
    throw new Error('Invalid career details archive');
  // Same key + owner in every statement; changed uploads win. Header stays put for ownership and season membership.
  await env.DB.batch([
    ...archive.rows.map((r) =>
      env.DB.prepare(
        `UPDATE career_seasons SET
      events_json=CASE WHEN events_json='[]' THEN ?1 ELSE events_json END,
      signals_json=coalesce(signals_json,?2), growth_json=coalesce(growth_json,?3)
      WHERE career_id=?4 AND year=?5 AND EXISTS
        (SELECT 1 FROM careers WHERE id=?4 AND profile_id=?6 AND detail_archive_key=?7)`,
      ).bind(r.events_json, r.signals_json, r.growth_json, careerId, r.year, profileId, key),
    ),
    env.DB.prepare(
      'UPDATE careers SET detail_archive_key=NULL, updated_at=?1 WHERE id=?2 AND profile_id=?3 AND detail_archive_key=?4',
    ).bind(now, careerId, profileId, key),
  ]);
  // Keep R2 evidence for historical D1 backups. The sweep deletes it only after the career is deleted.
}

/** Fence only old/archived heads; ordinary season uploads incur no additional D1/R2 round trip. */
export async function resumeCareerDetails(
  env: Bindings,
  careerId: string,
  profileId: string,
  knownKey: string | null,
  updatedAt: string | undefined,
  now: string,
): Promise<void> {
  if (
    !knownKey &&
    (!updatedAt ||
      updatedAt > new Date(Date.parse(now) - RETENTION.archiveDays * DAY_MS).toISOString())
  )
    return;
  const head = await env.DB.prepare(
    'UPDATE careers SET updated_at=?1 WHERE id=?2 AND profile_id=?3 RETURNING detail_archive_key',
  )
    .bind(now, careerId, profileId)
    .first<{ detail_archive_key: string | null }>();
  if (head) await restoreCareerDetails(env, careerId, profileId, head.detail_archive_key, now);
}
