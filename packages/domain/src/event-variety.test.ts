import { describe, expect, it } from 'vitest';
import { freshEventPool } from './event-variety.js';
import { selectOpenSlot } from './season.js';
import { rulesetProto, runCareerFixture } from './__fixtures__/career-01.js';
import { seedRng } from './rng.js';
import type { TimelineEntry, SeasonStep } from './types.js';
const policy = {
  version: 'FRESH_WEIGHTED_V1',
  repeatCooldownSeasons: 2,
  unseenWeightMultiplier: 3,
} as const;
const pool = [
  { eventId: 'A', version: 1, weight: 10 },
  { eventId: 'B', version: 1, weight: 10 },
];
const entry = (kind: TimelineEntry['kind'], refId: string | null): TimelineEntry => ({
  kind,
  refId,
  revision: 1,
  age: 20,
  step: 4,
});
describe('simulator event variety', () => {
  it('historical rulesets retain exact candidates and weights', () => {
    expect(
      freshEventPool(
        pool,
        { timeline: [entry('EVENT_RESOLVED', 'A:A:A1')], resolvedEventIds: ['A'] },
        undefined,
      ),
    ).toBe(pool);
  });
  it('suppresses current and previous season repeats, permits after two settlements', () => {
    const resolved = entry('EVENT_RESOLVED', 'A:A:A1');
    const boundary = entry('SEASON_SETTLED', null);
    for (const timeline of [[resolved], [resolved, boundary]])
      expect(freshEventPool(pool, { timeline, resolvedEventIds: ['A'] }, policy)).toEqual([
        { ...pool[1], weight: 30 },
      ]);
    expect(
      freshEventPool(
        pool,
        { timeline: [resolved, boundary, boundary], resolvedEventIds: ['A'] },
        policy,
      ),
    ).toEqual([pool[0], { ...pool[1], weight: 30 }]);
  });
  it('uses latest occurrence and never matches an ID prefix', () => {
    expect(
      freshEventPool(
        pool,
        { timeline: [entry('EVENT_RESOLVED', 'AB:A:A1')], resolvedEventIds: ['AB'] },
        policy,
      ),
    ).toHaveLength(2);
    expect(
      freshEventPool(
        pool,
        {
          timeline: [
            entry('EVENT_RESOLVED', 'A:A:A1'),
            entry('SEASON_SETTLED', null),
            entry('SEASON_SETTLED', null),
            entry('EVENT_RESOLVED', 'A:B:B1'),
          ],
          resolvedEventIds: ['A'],
        },
        policy,
      ),
    ).toEqual([{ ...pool[1], weight: 30 }]);
  });
  it('empty fresh pool skips an ordinary interruption without consuming RNG', () => {
    expect(
      freshEventPool(
        pool,
        {
          timeline: [entry('EVENT_RESOLVED', 'A:A:A1'), entry('EVENT_RESOLVED', 'B:A:A1')],
          resolvedEventIds: ['A', 'B'],
        },
        policy,
      ),
    ).toEqual([]);
  });
  it('seeded selection varies across careers and replays identically', () => {
    const state = runCareerFixture().state;
    const step = {
      index: 4,
      decisionSlots: [{ kind: 'EVENT', required: true, skippedByBudget: false }],
    } as SeasonStep;
    const ruleset = { ...rulesetProto, eventSelectionRules: policy };
    const pick = (seed: string) =>
      selectOpenSlot(step, 'FAST', pool, seedRng(seed), null, null, 20, 1, state, ruleset);
    const winners = new Set<string>();
    for (let index = 0; index < 30; index++) {
      const seed = `variety-${index}`;
      const first = pick(seed);
      expect(pick(seed)).toEqual(first);
      if (first.opened && first.eventId) winners.add(first.eventId);
    }
    expect(winners.size).toBe(2);
  });
});

it('caps ordinary interruptions separately from mandatory decisions and resets each season', () => {
  const bounded = { ...policy, maxEventsPerSeason: 2 };
  const mandatory = [
    entry('SEASON_STARTED', null),
    entry('EVENT_RESOLVED', 'EVT-INJ-001:A:A1'),
    entry('EVENT_RESOLVED', 'EVT-NAT-001:A:A1'),
  ];
  expect(freshEventPool(pool, { timeline: mandatory, resolvedEventIds: [] }, bounded)).toHaveLength(
    2,
  );
  const full = [...mandatory, entry('EVENT_RESOLVED', 'C:A:A1'), entry('EVENT_RESOLVED', 'D:A:A1')];
  expect(freshEventPool(pool, { timeline: full, resolvedEventIds: [] }, bounded)).toEqual([]);
  expect(
    freshEventPool(
      pool,
      { timeline: [...full, entry('SEASON_STARTED', null)], resolvedEventIds: [] },
      bounded,
    ),
  ).toHaveLength(2);
});
