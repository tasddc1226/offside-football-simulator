import { hashState, seedRng, simulate, type DomainSnapshot, type Command } from '@offside/domain';
import { buildTestState } from './build-test-state.ts';
import { describe, expect, it } from 'vitest';
import { loadRuleset } from '../rulesets/load-ruleset.ts';
import { loadContentPack } from '../packs/load-content-pack.ts';
import { loadRetirementArtifacts } from '../retirement-artifacts.ts';

describe('simulator 2.0.0 / 0.7.0', () => {
  it('spaces mandatory ordinary choices and preserves old rules', () => {
    const rules = loadRuleset('2.0.0');
    expect(rules.eventSelectionRules?.version).toBe('FRESH_WEIGHTED_V1');
    expect(loadRuleset('1.7.4').eventSelectionRules).toBeUndefined();
    expect(
      rules.leagueCalendar.steps
        .filter((s) => s.slots.some((x) => x.kind === 'EVENT' && x.required))
        .map((s) => s.index),
    ).toEqual([4, 9]);
    expect(loadRetirementArtifacts('2.0.0', '0.7.0').legacyVersion).toBe('1.2.0');
  });
  it('offers bounded once-only training gambles with explicit cost and a safe alternative', () => {
    const pack = loadContentPack('0.7.0');
    expect(pack.manifest.compatibleRulesetVersions).toEqual(['2.0.0']);
    for (const id of ['EVT-DEV-201', 'EVT-DEV-202', 'EVT-DEV-203']) {
      const event = pack.eventsById.get(id)!;
      expect(event.cooldown).toBeUndefined();
      const gamble = event.choices[0]!;
      expect(gamble.outcomes.map((o) => o.weight)).toEqual([65, 35]);
      expect(gamble.outcomes[0]!.effects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: 'PERMANENT', delta: 1, stackingRule: 'ONCE_PER_SOURCE' }),
        ]),
      );
      for (const outcome of gamble.outcomes)
        expect(outcome.effects).toEqual(
          expect.arrayContaining([expect.objectContaining({ target: 'fitness', delta: -6 })]),
        );
      expect(event.choices[2]!.outcomes).toHaveLength(1);
      expect(loadContentPack('0.6.8').eventsById.has(id)).toBe(false);
    }
  });
});

it('training outcomes change real attributes and fitness, replay exactly, and cannot resolve twice', () => {
  const ruleset = loadRuleset('2.0.0');
  const pack = loadContentPack('0.7.0');
  for (const [eventId, attribute] of [
    ['EVT-DEV-201', 'passing'],
    ['EVT-DEV-202', 'firstTouch'],
    ['EVT-DEV-203', 'stamina'],
  ] as const) {
    const event = pack.eventsById.get(eventId)!;
    const outcomes = new Set<string>();
    for (let index = 0; index < 30; index++) {
      const state = buildTestState({
        rulesetVersion: '2.0.0',
        contentPackVersion: '0.7.0',
        stage: 'PRO',
        age: 20,
        seasonPhase: 'LEAGUE',
        currentStep: 4,
        rngState: seedRng(`training-${index}`),
        pending: { kind: 'EVENT', eventId, version: 1 },
      });
      const snapshot: DomainSnapshot = {
        revision: 1,
        checkpoint: 'EVENT_OFFERED',
        state,
        stateHash: hashState(state),
        rulesetVersion: '2.0.0',
        contentPackVersion: '0.7.0',
      };
      const choice = event.choices[0]!;
      const command: Command & { commandId: string; expectedRevision: number } = {
        type: 'RESOLVE_EVENT',
        commandId: `training-${index}`,
        expectedRevision: 1,
        payload: {
          eventId,
          definitionVersion: 1,
          choiceId: choice.id,
          outcomes: choice.outcomes.map(({ id, kind, weight, effects }) => ({
            id,
            kind,
            weight,
            effects,
          })),
        },
      };
      const input = {
        snapshot,
        command,
        ruleset,
        rulesetVersion: '2.0.0',
        contentPackVersion: '0.7.0',
      };
      const result = simulate(input);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      outcomes.add(result.outcomeId!);
      expect(simulate(input)).toEqual(result);
      expect(result.snapshot.state.state.fitness).toBe(state.state.fitness - 6);
      expect(result.snapshot.state.attributes[attribute]).toBe(
        state.attributes[attribute] + (result.outcomeId === 'A1' ? 1 : 0),
      );
      expect(
        simulate({
          ...input,
          snapshot: result.snapshot,
          command: { ...command, expectedRevision: 2 },
        }).ok,
      ).toBe(false);
    }
    expect(outcomes).toEqual(new Set(['A1', 'A2']));
  }
});
