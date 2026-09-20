import { describe, expect, it } from 'vitest';
import {
  buildSchedule,
  hashState,
  simulate,
  type Command,
  type DomainSnapshot,
} from '@offside/domain';
import { loadRuleset } from '../rulesets/load-ruleset.ts';
import { loadContentPack } from '../packs/load-content-pack.ts';
import { buildTestState } from './build-test-state.ts';
import { selectEligibleEvents } from './select-eligible-events.ts';

const ruleset = loadRuleset('2.1.0');
const pack = loadContentPack('0.8.0');
it.each([
  ['A', 'firstTouch', 'EVT-DEV-302'],
  ['B', 'stamina', 'EVT-DEV-303'],
  ['C', 'decisions', 'EVT-DEV-304'],
] as const)(
  'training choice %s changes an attribute and unlocks only its own follow-up',
  (choiceId, attribute, followUp) => {
    const event = pack.eventsById.get('EVT-DEV-301')!;
    const state = buildTestState({
      rulesetVersion: ruleset.version,
      contentPackVersion: '0.8.0',
      stage: 'PRO',
      age: 20,
      seasonPhase: 'LEAGUE',
      currentStep: 4,
      pending: { kind: 'EVENT', eventId: event.id, version: 1 },
    });
    const snapshot: DomainSnapshot = {
      revision: 1,
      checkpoint: 'EVENT_OFFERED',
      state,
      stateHash: hashState(state),
      rulesetVersion: ruleset.version,
      contentPackVersion: '0.8.0',
    };
    const choice = event.choices.find((c) => c.id === choiceId)!;
    const command: Command & { commandId: string; expectedRevision: number } = {
      type: 'RESOLVE_EVENT',
      commandId: `journey-${choiceId}`,
      expectedRevision: 1,
      payload: {
        eventId: event.id,
        definitionVersion: 1,
        choiceId,
        outcomes: choice.outcomes.map(({ id, kind, weight, effects, addTags }) => ({
          id,
          kind,
          weight,
          effects,
          ...(addTags ? { addTags } : {}),
        })),
      },
    };
    const result = simulate({
      snapshot,
      command,
      ruleset,
      rulesetVersion: ruleset.version,
      contentPackVersion: '0.8.0',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.snapshot.state.attributes[attribute]).toBe(state.attributes[attribute] + 2);
    const eligible = selectEligibleEvents(pack, result.snapshot.state).map((e) => e.eventId);
    expect(eligible).toContain(followUp);
    for (const other of ['EVT-DEV-302', 'EVT-DEV-303', 'EVT-DEV-304'].filter(
      (id) => id !== followUp,
    ))
      expect(eligible).not.toContain(other);
    expect(eligible).not.toContain(event.id);
  },
);

describe('overseas leagues', () => {
  it('plays a complete foreign home/away schedule without entering the Korean cup', () => {
    for (const team of ruleset.teams.filter((t) => t.countryCode && t.countryCode !== 'KR')) {
      const schedule = buildSchedule(ruleset, team, 3);
      expect(schedule.filter((s) => s.kind === 'LEAGUE')).toHaveLength(14);
      expect(schedule.some((s) => s.kind === 'CUP')).toBe(false);
    }
    expect(loadRuleset('2.0.0').teams.some((t) => t.countryCode)).toBe(false);
    expect(loadRuleset('2.0.0').retirementRules?.maxCareerSeasons).toBeUndefined();
  });
});
