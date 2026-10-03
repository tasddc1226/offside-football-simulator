import { describe, it, expect } from 'vitest';
import { coreMetrics, DAY } from './core-metrics.mjs';
const base = Date.parse('2026-01-01T00:00:00+09:00');
const event = (user, name, offset, params = {}) => ({
  user_pseudo_id: user,
  event_name: name,
  timestamp_ms: base + offset,
  platform: 'web',
  test_marker: 'live',
  measurement_version: '3',
  ...params,
});
const report = (events) =>
  coreMetrics({ events, availableFrom: base, coveredUntil: base + 10 * DAY, platforms: ['web'] });
describe('exact mature core metrics', () => {
  it('uses KST calendar D1/D7, distinct days/users, exact elapsed windows, and excludes QA', () => {
    const events = [
      event('a', 'first_visit', 0),
      event('a', 'player_first_play', DAY - 1, { cohort_origin: 'observed_new' }),
      event('a', 'play_complete', DAY - 1),
      event('a', 'play_complete', DAY + 1),
      event('a', 'play_complete', DAY + 2),
      event('a', 'play_complete', 7 * DAY + 1),
      event('a', 'player_first_season', 8 * DAY - 1),
      event('a', 'player_first_retire', DAY, { cohort_origin: 'observed_new' }),
      event('a', 'player_restart', 8 * DAY),
      event('b', 'play_complete', 5 * DAY),
      event('b', 'play_complete', 5 * DAY + 1),
      event('qa', 'play_complete', 6 * DAY, { test_marker: 'qa' }),
      event('qa', 'play_complete', 7 * DAY, { test_marker: 'qa' }),
    ];
    const r = report(events);
    expect(r.web.weeklyReturningPlayers).toBe(0); // a has only one day in last closed week
    expect(r.web.d1).toEqual({ numerator: 1, denominator: 1, rate: 1 });
    expect(r.web.d7.rate).toBe(1);
    expect(r.web.firstSeason7d.rate).toBe(1);
    expect(r.web.restart7d.rate).toBe(1);
    expect(r.iOS.status).toBe('not_instrumented');
  });
  it('excludes immature and unknown-origin cohorts; never represents an empty denominator as zero', () => {
    const r = report([
      event('late', 'player_first_play', 9 * DAY + 1, { cohort_origin: 'observed_new' }),
      event('old', 'player_first_play', DAY, { cohort_origin: 'preexisting_or_unknown' }),
    ]);
    expect(r.web.d1).toEqual({ numerator: 0, denominator: 0, rate: null });
    expect(r.web.d7.rate).toBeNull();
  });
  it('deduplicates multiple players and counts operation attempts separately from outcomes', () => {
    const events = [
      event('a', 'play_complete', 6 * DAY),
      event('a', 'play_complete', 7 * DAY),
      event('a', 'play_complete', 7 * DAY + 1),
      event('a', 'game_operation', DAY, {
        operation: 'save',
        operation_source: 'gameplay',
        outcome: 'success',
        failure_class: 'none',
      }),
      event('a', 'game_operation', 2 * DAY, {
        operation: 'save',
        operation_source: 'gameplay',
        outcome: 'failed',
        failure_class: 'save_risk',
      }),
    ];
    const r = report(events).web;
    expect(r.weeklyReturningPlayers).toBe(1);
    expect(r.operations['save/gameplay']).toMatchObject({
      numerator: 1,
      denominator: 2,
      rate: 0.5,
      failureCounts: { save_risk: 1 },
    });
  });
});
