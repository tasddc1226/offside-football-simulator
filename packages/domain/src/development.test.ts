import { describe, expect, it } from 'vitest';
import { runSettledFixture } from './__fixtures__/career-06-settled.js';
import rulesRaw from '../../content/rulesets/3.0.0/ruleset.json';
import { rulesetProto } from './__fixtures__/career-01.js';
import type { Ruleset } from './ruleset.js';
import type { CareerState } from './types.js';
import {
  developPlayer,
  developmentTargets,
  developmentPrepared,
  initialDevelopment,
  needsDevelopment,
  recordMatchLesson,
  weightMatchOutcomes,
} from './development.js';
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
const rules = rulesRaw as unknown as Ruleset;
const fixture = runSettledFixture().beforeSettlementState;
function ready(): CareerState {
  return {
    ...clone(fixture),
    pending: null,
    health: { ...fixture.health, episodes: [] },
    state: { ...fixture.state, fitness: 80 },
    season: { ...fixture.season!, currentStep: 1 },
  };
}
const plan = { drill: 'CONTROL', load: 'PUSH', partner: 'COACH' } as const;
const outcomes = [
  { kind: 'SUCCESS', weight: 50 },
  { kind: 'FAIL', weight: 50 },
  { kind: 'NEUTRAL', weight: 0 },
] as const;
describe('connected player development', () => {
  it('offers exactly one preparation per seasonal block, without changing fixtures', () => {
    let state = ready();
    const matches = clone(state.season!.matches);
    for (const step of [1, 5, 9]) {
      state = { ...state, season: { ...state.season!, currentStep: step } };
      expect(needsDevelopment(state, rules)).toBe(true);
      state = developPlayer(state, plan, rules, step);
      expect(needsDevelopment(state, rules)).toBe(false);
      expect(developmentPrepared(state, step)).toBe(true);
      expect(() => developPlayer(state, plan, rules, step + 1)).toThrow();
    }
    expect(state.development!.sessions.map((s) => s.block)).toEqual([1, 2, 3]);
    expect(state.season!.matches).toEqual(matches);
    expect(
      needsDevelopment({ ...state, season: { ...state.season!, currentStep: 12 } }, rules),
    ).toBe(false);
  });
  it('replays training exactly and trades immediate fitness for actual attributes', () => {
    const state = ready();
    const before = clone(state);
    const push = developPlayer(state, plan, rules, 100);
    expect(push).toEqual(developPlayer(state, plan, rules, 100));
    expect(state).toEqual(before);
    expect(push.state.fitness).toBe(62);
    expect(push.development!.sessions[0]!.gains.length).toBeGreaterThan(0);
    const recovery = developPlayer(state, { ...plan, load: 'RECOVERY' }, rules, 100);
    expect(recovery.state.fitness).toBe(100);
    expect(recovery.attributes).toEqual(state.attributes);
    expect(push.development!.mastery.CONTROL).toBeGreaterThan(
      recovery.development!.mastery.CONTROL,
    );
  });
  it('blocks hard training for both active injury and rehab, and never lowers skills at the cap', () => {
    for (const status of ['ACTIVE', 'REHAB'] as const) {
      const state = ready();
      state.health.episodes = [{ status } as CareerState['health']['episodes'][number]];
      expect(() => developPlayer(state, plan, rules, 100)).toThrow('재활');
      const recovered = developPlayer(state, { ...plan, load: 'RECOVERY' }, rules, 100);
      expect(recovered.state.fitness).toBe(100);
      expect(recovered.attributes).toEqual(state.attributes);
    }
    const capped = ready();
    for (const key of developmentTargets(capped,'CONTROL')) capped.attributes[key]=99;
    expect(developPlayer(capped, plan, rules, 100).attributes).toEqual(capped.attributes);
  });
  it('does not grant repeated free growth or enable the feature for historical rules', () => {
    const state = ready();
    expect(needsDevelopment(state, rulesetProto)).toBe(false);
    expect(() => developPlayer(state, plan, rulesetProto, 100)).toThrow();
    expect(weightMatchOutcomes(state, 'SAFE', outcomes, rulesetProto)).toEqual(outcomes);
  });
  it('makes skill, practice and trust change match odds, preserving impossible outcomes', () => {
    const low = ready();
    low.relationships.managerTrust = 10;
    low.state.morale = 30;
    low.attributes.firstTouch = 30;
    low.attributes.passing = 30;
    low.attributes.dribbling = 30;
    const high = clone(low);
    high.relationships.managerTrust = 90;
    high.state.morale = 90;
    high.attributes.firstTouch = 80;
    high.attributes.passing = 80;
    high.attributes.dribbling = 80;
    high.development = { ...initialDevelopment(), mastery: { CONTROL: 80, ENGINE: 0, VISION: 0 } };
    const poor = weightMatchOutcomes(low, 'SAFE', outcomes, rules);
    const prepared = weightMatchOutcomes(high, 'SAFE', outcomes, rules);
    expect(prepared[0]!.weight).toBeGreaterThan(poor[0]!.weight);
    expect(prepared[1]!.weight).toBeLessThan(poor[1]!.weight);
    expect(prepared[2]!.weight).toBe(0);
  });
  it('records failure as learning and loses trust rather than always rewarding relationships', () => {
    const state = ready();
    state.pending = { kind: 'CHAPTER', matchId: 'match-1' } as CareerState['pending'];
    const next = recordMatchLesson(state, 'SAFE', outcomes, 'FAIL');
    expect(next.relationships.managerTrust).toBe(state.relationships.managerTrust - 2);
    expect(next.state.morale).toBe(Math.max(0, state.state.morale - 4));
    expect(next.development!.mastery.CONTROL).toBe(2);
    expect(next.development!.duels[0]).toMatchObject({ successBp: 5000, result: 'FAIL' });
  });
});
