/** Offline aggregate from a complete normalized GA4 event-level export. No network/credentials. */
export const DAY = 86400000;
export const kstDay = (t) => Math.floor((t + 9 * 3600000) / DAY);
const ratio = (numerator, denominator) => ({
  numerator,
  denominator,
  rate: denominator ? numerator / denominator : null,
});
/** Input must include full history from availableFrom and a complete coveredUntil watermark. */
export function coreMetrics({ events, availableFrom, coveredUntil, platforms }) {
  if (
    !Number.isFinite(availableFrom) ||
    !Number.isFinite(coveredUntil) ||
    availableFrom >= coveredUntil
  )
    throw Error('Invalid coverage watermark');
  const report = {};
  for (const platform of ['web', 'iOS', 'Android']) {
    if (!platforms.includes(platform)) {
      report[platform] = { status: 'not_instrumented' };
      continue;
    }
    const users = new Map();
    const operations = new Map();
    for (const e of events) {
      if (
        e.platform !== platform ||
        e.test_marker !== 'live' ||
        String(e.measurement_version) !== '3'
      )
        continue;
      if (
        !Number.isFinite(e.timestamp_ms) ||
        e.timestamp_ms < availableFrom ||
        e.timestamp_ms >= coveredUntil
      )
        continue;
      const key = e.user_id || e.user_pseudo_id;
      if (typeof key !== 'string' || !key) continue;
      let rows = users.get(key);
      if (!rows) users.set(key, (rows = []));
      rows.push(e);
      if (e.event_name === 'game_operation') {
        const group = `${e.operation}/${e.operation_source}`;
        const o = operations.get(group) ?? { attempts: 0, failed: 0, byFailure: {} };
        if (!['success', 'empty', 'failed'].includes(e.outcome)) continue;
        o.attempts++;
        if (e.outcome === 'failed') {
          o.failed++;
          o.byFailure[e.failure_class] = (o.byFailure[e.failure_class] ?? 0) + 1;
        }
        operations.set(group, o);
      }
    }
    let weekly = 0;
    const d1 = [],
      d7 = [],
      season = [],
      restart = [],
      visits = [];
    // Rolling 168 hours; count distinct KST calendar dates within that window.
    const closedDay = kstDay(coveredUntil),
      weekStart = coveredUntil - 7 * DAY;
    for (const rows of users.values()) {
      rows.sort((a, b) => a.timestamp_ms - b.timestamp_ms);
      const first = (name) => rows.find((e) => e.event_name === name);
      const play = rows.filter((e) => e.event_name === 'play_complete');
      if (
        new Set(play.filter((e) => e.timestamp_ms >= weekStart).map((e) => kstDay(e.timestamp_ms)))
          .size >= 2
      )
        weekly++;
      const p = first('player_first_play');
      const visit = first(platform === 'web' ? 'first_visit' : 'first_open');
      // Visit -> play uses an explicit 7 * 24h window, mature visitors only.
      if (visit && visit.timestamp_ms + 7 * DAY <= coveredUntil)
        visits.push(
          !!p &&
            p.cohort_origin === 'observed_new' &&
            p.timestamp_ms >= visit.timestamp_ms &&
            p.timestamp_ms <= visit.timestamp_ms + 7 * DAY,
        );
      if (p?.cohort_origin === 'observed_new') {
        const pd = kstDay(p.timestamp_ms);
        if (pd + 2 <= closedDay) d1.push(play.some((e) => kstDay(e.timestamp_ms) === pd + 1));
        if (pd + 8 <= closedDay) d7.push(play.some((e) => kstDay(e.timestamp_ms) === pd + 7));
        if (p.timestamp_ms + 7 * DAY <= coveredUntil) {
          const done = first('player_first_season');
          season.push(
            !!done &&
              done.timestamp_ms >= p.timestamp_ms &&
              done.timestamp_ms <= p.timestamp_ms + 7 * DAY,
          );
        }
      }
      const retired = first('player_first_retire');
      if (
        retired?.cohort_origin === 'observed_new' &&
        retired.timestamp_ms + 7 * DAY <= coveredUntil
      ) {
        const next = first('player_restart');
        restart.push(
          !!next &&
            next.timestamp_ms >= retired.timestamp_ms &&
            next.timestamp_ms <= retired.timestamp_ms + 7 * DAY,
        );
      }
    }
    const rate = (values) => ratio(values.filter(Boolean).length, values.length);
    report[platform] = {
      status: 'observed',
      weeklyReturningPlayers: availableFrom <= weekStart ? weekly : null,
      newVisitorFirstPlay7d: rate(visits),
      d1: rate(d1),
      d7: rate(d7),
      firstSeason7d: rate(season),
      restart7d: rate(restart),
      operations: Object.fromEntries(
        [...operations].map(([k, v]) => [
          k,
          { ...ratio(v.failed, v.attempts), failureCounts: v.byFailure },
        ]),
      ),
    };
  }
  return report;
}
