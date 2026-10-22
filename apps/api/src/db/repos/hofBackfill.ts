import { inArray } from 'drizzle-orm';
import type { Db } from '../client.js';
import { appMeta } from '../schema.js';
import { CLUB_IDS_BACKFILL_KEYS, ensureClubIdsBackfilled } from './clubIds.js';
import { CAREER_VALUES_BACKFILL_KEYS, ensureCareerValuesBackfilled } from './careerValues.js';

/** Request-local completion/cursor snapshot: one indexed metadata read, never an isolate-wide flag.
 * Each unfinished backfill retains its bounded page, writes and completion checks. */
export async function ensureHofBackfilled(db: Db): Promise<boolean> {
  const keys = [...CLUB_IDS_BACKFILL_KEYS, ...CAREER_VALUES_BACKFILL_KEYS];
  const rows = await db.select().from(appMeta).where(inArray(appMeta.key, keys));
  const meta = new Map(rows.map((row) => [row.key, row.value]));
  const results = await Promise.all([
    ensureClubIdsBackfilled(db, undefined, meta),
    ensureCareerValuesBackfilled(db, undefined, meta),
  ]);
  return results.some(Boolean);
}
