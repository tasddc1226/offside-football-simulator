import { expect, it } from 'vitest';
import {
  canScoutOverseas,
  overseasRecord,
  buildSchedule,
  type CareerState,
  type SeasonSummary,
} from '@offside/domain';
import { loadRuleset } from '../rulesets/load-ruleset.ts';
import { loadContentPack } from '../packs/load-content-pack.ts';
import { buildTestState } from './build-test-state.ts';
import { selectEligibleEvents } from './select-eligible-events.ts';
const rules = loadRuleset('3.1.0');
const pack = loadContentPack('0.10.0');
const summary = (teamId: string, minutes: number, index = 1) =>
  ({ teamId, index, result: { playerStats: { minutes } } }) as SeasonSummary;
const state = (history: SeasonSummary[]) =>
  buildTestState({ stage: 'PRO', tags: ['해외_도전'], seasonHistory: history });
const club = (country: string) => rules.teams.find((t) => t.countryCode === country)!;
it('requires real minutes through Japan and Portugal before big-league scouting', () => {
  const domestic = [summary('seoul', 900), summary('seoul', 900, 2)];
  expect(canScoutOverseas(state(domestic), club('JP'), rules)).toBe(true);
  expect(canScoutOverseas(state(domestic), club('PT'), rules)).toBe(false);
  const low = [...domestic, summary(club('JP').id, 449, 3)];
  expect(canScoutOverseas(state(low), club('PT'), rules)).toBe(false);
  const japan = [...domestic, summary(club('JP').id, 450, 3)];
  expect(canScoutOverseas(state(japan), club('PT'), rules)).toBe(true);
  expect(canScoutOverseas(state(japan), club('GB'), rules)).toBe(false);
  const bridge = [...japan, summary(club('PT').id, 450, 4)];
  for (const code of ['GB', 'ES', 'DE', 'IT', 'FR'])
    expect(canScoutOverseas(state(bridge), club(code), rules)).toBe(true);
  expect(canScoutOverseas({ ...state(bridge), tags: [] }, club('GB'), rules)).toBe(false);
});
it('contracts with no playing time do not count as overseas achievement or a homecoming', () => {
  expect(overseasRecord(state([summary(club('GB').id, 0)])).foreignSeasons).toBe(0);
  expect(
    overseasRecord(state([summary(club('JP').id, 450), summary('seoul', 90, 2)])).returned,
  ).toBe(true);
});
it.each(['JP', 'PT', 'GB', 'ES', 'DE', 'IT', 'FR'])(
  '%s has a compact real calendar and exclusive local story branches',
  (code) => {
    const team = club(code);
    const calendar = buildSchedule(rules, team, 3);
    expect(calendar.filter((s) => s.kind === 'LEAGUE')).toHaveLength(14);
    const s = buildTestState({
      stage: 'PRO',
      age: 22,
      rulesetVersion: '3.1.0',
      contentPackVersion: '0.10.0',
      seasonPhase: 'LEAGUE',
      contract: { teamId: team.id } as CareerState['contract'],
    });
    const arrival = selectEligibleEvents(pack, s);
    expect(arrival).toHaveLength(1);
    const event = pack.eventsById.get(arrival[0]!.eventId)!;
    for (const choice of event.choices) {
      const next = { ...s, tags: choice.outcomes[0]!.addTags ?? [] };
      const follow = selectEligibleEvents(pack, next);
      expect(follow).toHaveLength(1);
      expect(follow[0]!.eventId).not.toBe(event.id);
      const tags = pack.eventsById.get(follow[0]!.eventId)!.choices[0]!.outcomes[0]!.addTags ?? [];
      expect(
        selectEligibleEvents(pack, { ...next, tags: [...next.tags, ...tags] }).some((e) =>
          [event.id, follow[0]!.eventId].includes(e.eventId),
        ),
      ).toBe(false);
    }
  },
);
it('keeps the old world and retirement horizon unchanged', () => {
  expect(loadRuleset('3.0.0').overseasRules).toBeUndefined();
  expect(loadRuleset('3.0.0').teams.some((t) => t.countryCode === 'GB')).toBe(false);
  expect(rules.retirementRules?.maxCareerSeasons).toBe(12);
});
