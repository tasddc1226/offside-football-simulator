import { CLUB_NAMES } from '@offside/contracts/club-names';
import {
  CLUB_LEAGUE_AVG,
  DYNAMIC_LEAGUES,
  type StrengthRun,
  type StrengthLeagueRun,
} from '@offside/contracts/club-strength';
import {
  checkStandings,
  computeStrength,
  type StandingRow,
} from '@offside/contracts/club-strength-calc';
import type { Bindings } from '../env.js';
import { purgeEdgeOrigin } from '../edgeCache.js';
import { collectStandings, SourcesSchema, type StrengthSource } from './provider.js';
import { LOCK_KEY, RUN_PREFIX, STATE_KEY, STRENGTH_PATH, readStrengthState } from './store.js';

const completedDays = new WeakMap<D1Database, string>();

const baseOf = (league: string) =>
  Object.fromEntries(
    (CLUB_NAMES[league] ?? []).map((_, i, all) => [
      `${league}-${i}`,
      CLUB_LEAGUE_AVG[league]! + Math.round(9 - (15 * i) / (all.length - 1)),
    ]),
  );
export function validateLeague(source: StrengthSource, rows: StandingRow[]) {
  const base = baseOf(source.league);
  if (rows.length < 2 || rows.length > 40 || checkStandings(rows).length)
    throw new Error('standings-invalid');
  const ids = Object.values(source.teams);
  if (
    Object.keys(base).some((id) => !ids.includes(id)) ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !(id in base))
  )
    throw new Error('team-mapping-invalid');
  const unmapped = rows.filter((r) => !source.teams[r.team] && !source.exclude.includes(r.team));
  if (unmapped.length)
    throw new Error(`unmapped-team-ids:${unmapped.map((r) => r.team).join(',')}`);
  if (!rows.some((r) => source.teams[r.team])) throw new Error('no-mapped-teams');
  if (source.exclude.some((id) => id in source.teams)) throw new Error('team-mapping-overlap');
  return base;
}
async function fingerprint(value: unknown): Promise<string> {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))),
    ),
    (n) => n.toString(16).padStart(2, '0'),
  ).join('');
}

/** One KST day after 13:00, on the existing 5-minute tick. A lease fences concurrent/late writers. */
export async function updateClubStrength(
  env: Bindings,
  now: number,
  request: typeof fetch = fetch,
): Promise<StrengthRun | null> {
  if (env.CLUB_STRENGTH_ENABLED !== '1' || !Number.isFinite(now) || now <= 0) return null;
  const kst = new Date(now + 9 * 3_600_000);
  if (kst.getUTCHours() < 13) return null;
  const day = kst.toISOString().slice(0, 10),
    runKey = RUN_PREFIX + day;
  if ((completedDays.get(env.DB) ?? '') >= day) return null;
  const done = await env.DB.prepare('SELECT key FROM app_meta WHERE key=?').bind(runKey).first();
  if (done) {
    completedDays.set(env.DB, day);
    return null;
  }
  const token = String(now + 10 * 60_000);
  const lease = await env.DB.prepare(
    'INSERT INTO app_meta(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(app_meta.value AS INTEGER)<?3 RETURNING key',
  )
    .bind(LOCK_KEY, token, now)
    .first();
  if (!lease) return null;
  try {
    // Recheck after acquiring: a preceding runner might have completed between our reads.
    if (await env.DB.prepare('SELECT key FROM app_meta WHERE key=?').bind(runKey).first())
      return null;
    const state = await readStrengthState(env.DB);
    if (state.completedDay && state.completedDay >= day) return null;
    let config: unknown;
    try {
      config = JSON.parse(env.CLUB_STRENGTH_SOURCES ?? '[]');
    } catch {
      config = null;
    }
    const sources = SourcesSchema.safeParse(config);
    const leagues: StrengthLeagueRun[] = [];
    const nextValues = { ...state.snapshot.values },
      inputs = { ...state.inputs };
    for (const league of DYNAMIC_LEAGUES) {
      const source = sources.success ? sources.data.find((s) => s.league === league) : undefined;
      const key =
        source?.provider === 'football-data' ? env.FOOTBALL_DATA_TOKEN : env.API_FOOTBALL_KEY;
      const result: StrengthLeagueRun = {
        league,
        status: 'unconfigured',
        reason: sources.success ? 'source-or-key-missing' : 'source-config-invalid',
        season: null,
        changes: [],
      };
      leagues.push(result);
      if (!source || !key) continue;
      try {
        const collected = await collectStandings(source, key, request);
        result.season = collected.season;
        const base = validateLeague(source, collected.rows);
        const previousInput = inputs[league];
        const played = collected.rows.reduce((sum, row) => sum + row.p, 0);
        const seasonYear = Number(collected.season.slice(0, 4));
        const previousYear = Number(previousInput?.season.slice(0, 4));
        if (
          previousInput &&
          (seasonYear < previousYear ||
            (seasonYear === previousYear &&
              previousInput.played !== undefined &&
              played < previousInput.played))
        )
          throw new Error('stale-standings');
        const rows = collected.rows.toSorted((a, b) => a.team.localeCompare(b.team));
        const hash = await fingerprint({
          provider: source.provider,
          competition: source.competition,
          teams: Object.entries(source.teams).toSorted(([a], [b]) => a.localeCompare(b)),
          exclude: source.exclude.toSorted(),
          season: collected.season,
          rows,
        });
        if (inputs[league]?.hash === hash) {
          result.status = 'unchanged';
          result.reason = 'same-standings';
          continue;
        }
        const previous = { ...base, ...state.snapshot.values };
        const center = Object.values(base).reduce((a, b) => a + b, 0) / Object.keys(base).length;
        const calculated = computeStrength(center, rows, source.teams, base, previous);
        for (const row of calculated) {
          nextValues[row.id] = row.next;
          if (row.prev !== row.next)
            result.changes.push({ id: row.id, before: row.prev, after: row.next });
        }
        inputs[league] = { hash, season: collected.season, played };
        result.status = result.changes.length ? 'changed' : 'unchanged';
        result.reason = calculated.some((r) => r.held)
          ? 'insufficient-games-held'
          : 'validated-standings';
      } catch (e) {
        result.status = 'failed';
        // Schema/parser errors may contain upstream data. Only our bounded diagnostic codes are persisted.
        const msg = e instanceof Error ? e.message : '';
        result.reason = /^(provider-http-\d+|unmapped-team-ids:[\d,]+|[a-z-]+)$/.test(msg)
          ? msg.slice(0, 300)
          : 'provider-or-validation-failed';
      }
    }
    const changed = leagues.some((r) => r.status === 'changed');
    // One publication per day: large monotonic day versions are compatible with the existing numeric save field.
    const snapshot = changed
      ? {
          v: Math.max(state.snapshot.v + 1, Math.floor(now / 86_400_000) + 2),
          asOf: day,
          source: 'Daily standings',
          values: nextValues,
        }
      : state.snapshot;
    const report: StrengthRun = {
      day,
      at: new Date(now).toISOString(),
      version: snapshot.v,
      leagues,
    };
    const guard = 'SELECT ?1,?2 WHERE EXISTS(SELECT 1 FROM app_meta WHERE key=?3 AND value=?4)';
    // D1 batch is atomic. Expired workers cannot publish, overwrite history, or release the replacement lease.
    const committed = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO app_meta(key,value) ${guard} ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      ).bind(STATE_KEY, JSON.stringify({ snapshot, inputs, completedDay: day }), LOCK_KEY, token),
      env.DB.prepare(`INSERT INTO app_meta(key,value) ${guard}`).bind(
        runKey,
        JSON.stringify(report),
        LOCK_KEY,
        token,
      ),
      ...(changed
        ? [
            env.DB.prepare(`INSERT INTO app_meta(key,value) ${guard}`).bind(
              `club-strength:version:${snapshot.v}`,
              JSON.stringify(snapshot),
              LOCK_KEY,
              token,
            ),
          ]
        : []),
    ]);
    if (!committed[0]!.meta.changes) return null;
    completedDays.set(env.DB, day);
    if (changed) await purgeEdgeOrigin(new URL(env.GOOGLE_REDIRECT_URI).origin, [STRENGTH_PATH]);
    return report;
  } finally {
    await env.DB.prepare('DELETE FROM app_meta WHERE key=? AND value=?')
      .bind(LOCK_KEY, token)
      .run();
  }
}
