import type {
  AutomationAction,
  AutomationEnforcement,
  AutomationReason,
  AutomationSweep,
} from '@offside/contracts';
import { and, eq, gt, lt, sql, desc } from 'drizzle-orm';
import type { Db } from '../client.js';
import { createDb } from '../client.js';
import { appMeta, careers } from '../schema.js';
import { runBatch } from './batch.js';
import { hideCareerStatements, setMeta } from './firsts.js';
import { AUTOMATION_RULE_VERSION } from './automation.js';

const PREFIX = 'automation_action:';
export const AUTOMATION_SWEEP_KEY = 'automation:sweep';
const LOCK_KEY = 'automation:sweep:lease';
const PAGE = 500;
const MAX_PAGES = 10;
const CLEARED_PREFIX = 'anomaly_cleared:';

export function actionEntry(
  careerId: string,
  action: AutomationAction['action'],
  source: AutomationAction['source'],
  reasons: AutomationReason[],
  seasons: number,
  now: number,
) {
  const at = new Date(now).toISOString();
  const value: AutomationAction = {
    careerId,
    at,
    action,
    source,
    reasons,
    seasons,
    ruleVersion: AUTOMATION_RULE_VERSION,
  };
  return { key: `${PREFIX}${at}:${careerId}:${action}`, value: JSON.stringify(value) };
}

/** Audit and all public-record changes commit together. The conditional audit is also the race guard:
 * an operator restore between the scan and this transaction must win. No-op retries have no extra event. */
export async function autoHideCareer(
  db: Db,
  careerId: string,
  reasons: AutomationReason[],
  seasons: number,
  source: 'upload' | 'sweep',
  now: number,
): Promise<boolean> {
  const entry = actionEntry(careerId, 'hide', source, reasons, seasons, now);
  const guard = sql`exists (select 1 from app_meta where key = ${entry.key}) and not exists (select 1 from app_meta where key = ${CLEARED_PREFIX + careerId})`;
  const result = await runBatch(db, [
    db
      .insert(appMeta)
      .select(
        db
          .select({
            key: sql<string>`${entry.key}`.as('key'),
            value: sql<string>`${entry.value}`.as('value'),
          })
          .from(careers)
          .where(
            and(
              eq(careers.id, careerId),
              eq(careers.hidden, 0),
              sql`not exists (select 1 from app_meta where key = ${CLEARED_PREFIX + careerId})`,
            ),
          ),
      )
      .onConflictDoNothing(),
    ...hideCareerStatements(db, careerId, guard),
  ]);
  return (result[0] as D1Result).meta.changes > 0;
}

/** Aggregate summaries keep season JSON out of Worker memory. These fields mirror signalReasons.
 * A career is evaluated with its ENTIRE signal history, even for incremental scans. */
type Evidence = {
  careerId: string;
  seasons: number;
  webdriver: number;
  headless: number;
  synthetic: number;
  clicks: number;
  noInput: number;
};
export function evidenceReasons(r: Evidence): AutomationReason[] {
  const reasons: AutomationReason[] = [];
  if (r.webdriver) reasons.push('webdriver');
  if (r.headless) reasons.push('headless');
  if (r.synthetic >= 5 && r.synthetic > r.clicks) reasons.push('synthetic');
  if (r.noInput >= 2) reasons.push('noInput');
  return reasons;
}

export async function sweepAutomation(
  d1: D1Database,
  now: number,
  continuation = false,
  budget: { pageSize?: number; maxPages?: number } = {},
): Promise<AutomationSweep | null> {
  const db = createDb(d1);
  const [saved] = await db.select().from(appMeta).where(eq(appMeta.key, AUTOMATION_SWEEP_KEY));
  let prior: AutomationSweep | null = saved ? (JSON.parse(saved.value) as AutomationSweep) : null;
  if (continuation && (!prior || prior.status === 'complete')) return null;
  // D1 compare-and-set lease prevents the daily and five-minute triggers processing the same window.
  const clock = Date.now();
  const token = String(clock + 240_000);
  const lease = await d1
    .prepare(
      `INSERT INTO app_meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(app_meta.value AS INTEGER) < ?`,
    )
    .bind(LOCK_KEY, token, clock)
    .run();
  if (!lease.meta.changes) return null;
  const [latest] = await db.select().from(appMeta).where(eq(appMeta.key, AUTOMATION_SWEEP_KEY));
  prior = latest ? (JSON.parse(latest.value) as AutomationSweep) : null;
  if (continuation && (!prior || prior.status === 'complete')) {
    await db.delete(appMeta).where(and(eq(appMeta.key, LOCK_KEY), eq(appMeta.value, token)));
    return null;
  }
  const state: AutomationSweep =
    prior && prior.ruleVersion === AUTOMATION_RULE_VERSION && prior.status !== 'complete'
      ? { ...prior, status: 'running' }
      : {
          since:
            prior && prior.ruleVersion === AUTOMATION_RULE_VERSION
              ? new Date(Date.parse(prior.through) - 3_600_000).toISOString()
              : '',
          through: new Date(now).toISOString(),
          cursor: '',
          checked: 0,
          hidden: 0,
          status: 'running',
          updatedAt: new Date(now).toISOString(),
          ruleVersion: AUTOMATION_RULE_VERSION,
        };
  delete state.error;
  try {
    for (let page = 0; page < Math.min(budget.maxPages ?? MAX_PAGES, MAX_PAGES); page++) {
      const size = Math.min(budget.pageSize ?? PAGE, PAGE);
      const candidates = await (
        state.since
          ? d1
              .prepare(
                `SELECT id FROM careers INDEXED BY careers_automation_updated_idx WHERE updated_at >= ? AND updated_at <= ? AND id > ?
            AND EXISTS (SELECT 1 FROM career_seasons WHERE career_id = careers.id AND signals_json IS NOT NULL)
            ORDER BY id LIMIT ?`,
              )
              .bind(state.since, state.through, state.cursor, size)
          : d1
              .prepare(
                `SELECT DISTINCT career_id AS id FROM career_seasons INDEXED BY career_seasons_signals_career_idx
            WHERE signals_json IS NOT NULL AND career_id > ? AND created_at <= ?
            ORDER BY career_id LIMIT ?`,
              )
              .bind(state.cursor, state.through, size)
      ).all<{ id: string }>();
      // Read 50 IDs per statement, below D1's 100-parameter limit. Ten statements are one round trip.
      const statements: D1PreparedStatement[] = [];
      for (let i = 0; i < candidates.results.length; i += 50) {
        const ids = candidates.results.slice(i, i + 50).map((r) => r.id);
        statements.push(
          d1
            .prepare(
              `SELECT career_id AS careerId, count(*) AS seasons,
          max(coalesce(json_extract(signals_json,'$.webdriver'),0)) AS webdriver,
          max(coalesce(json_extract(signals_json,'$.headless'),0)) AS headless,
          sum(coalesce(json_extract(signals_json,'$.synthetic'),0)) AS synthetic,
          sum(coalesce(json_extract(signals_json,'$.clicks'),0)) AS clicks,
          sum(CASE WHEN json_extract(signals_json,'$.clicks') + json_extract(signals_json,'$.keys') + json_extract(signals_json,'$.touches') = 0 THEN 1 ELSE 0 END) AS noInput
          FROM career_seasons WHERE career_id IN (${ids.map(() => '?').join(',')}) AND signals_json IS NOT NULL AND json_valid(signals_json)
          GROUP BY career_id`,
            )
            .bind(...ids),
        );
      }
      const groups = statements.length ? await d1.batch<Evidence>(statements) : [];
      for (const r of groups.flatMap((g) => g.results)) {
        const reasons = evidenceReasons(r);
        if (
          reasons.length &&
          (await autoHideCareer(db, r.careerId, reasons, r.seasons, 'sweep', Date.now()))
        )
          state.hidden++;
      }
      state.checked += candidates.results.length;
      state.cursor = candidates.results.at(-1)?.id ?? state.cursor;
      state.updatedAt = new Date(Date.now()).toISOString();
      if (candidates.results.length < Math.min(budget.pageSize ?? PAGE, PAGE))
        state.status = 'complete';
      await setMeta(db, AUTOMATION_SWEEP_KEY, JSON.stringify(state));
      if (state.status === 'complete') break;
    }
    return state;
  } catch (error) {
    state.status = 'error';
    state.error = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    state.updatedAt = new Date(Date.now()).toISOString();
    await setMeta(db, AUTOMATION_SWEEP_KEY, JSON.stringify(state));
    throw error;
  } finally {
    await db.delete(appMeta).where(and(eq(appMeta.key, LOCK_KEY), eq(appMeta.value, token)));
  }
}

/** Indexed keyset history; no signal-table scan, no N+1, and no polling from admin clients. */
export async function automationEnforcement(
  db: Db,
  enabled: boolean,
  before?: string,
): Promise<AutomationEnforcement> {
  const [states, rows] = await db.batch([
    db.select().from(appMeta).where(eq(appMeta.key, AUTOMATION_SWEEP_KEY)),
    db
      .select({ key: appMeta.key, value: appMeta.value, hidden: careers.hidden })
      .from(appMeta)
      .leftJoin(careers, sql`${careers.id} = json_extract(${appMeta.value}, '$.careerId')`)
      .where(and(gt(appMeta.key, PREFIX), lt(appMeta.key, before ?? 'automation_action;')))
      .orderBy(desc(appMeta.key))
      .limit(51),
  ]);
  const actions = rows.slice(0, 50).map((r) => ({
    ...(JSON.parse(r.value) as AutomationAction),
    key: r.key,
    hidden: r.hidden === 1,
  }));
  return {
    enabled,
    ruleVersion: AUTOMATION_RULE_VERSION,
    sweep: states[0] ? (JSON.parse(states[0].value) as AutomationSweep) : null,
    actions,
    next: rows.length > 50 ? actions.at(-1)!.key : null,
  };
}
