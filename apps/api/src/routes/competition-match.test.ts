import { loadRuleset } from '@offside/content';
import { describe, expect, it } from 'vitest';
import {
  applyCompetitionAction,
  buildCompetitionMatchDefinition,
  initialCompetitionActionState,
  playCompetitionMatch,
  scoreCompetitionMatch,
} from '@offside/domain';

const ruleset = loadRuleset('3.3.0');

function stateFor(...actions: string[]) {
  const definition = buildCompetitionMatchDefinition(ruleset, '2026-09-21');
  return actions.reduce((state, action) => applyCompetitionAction(definition, state, action), initialCompetitionActionState(definition));
}

describe('competition match authority', () => {
  it('rotates position by immutable day definition and deterministically recomputes evidence', () => {
    const definition = buildCompetitionMatchDefinition(ruleset, '2026-09-21');
    expect(definition.position).not.toBe(buildCompetitionMatchDefinition(ruleset, '2026-09-22').position);
    const state = stateFor('PRESS_HIGH', 'SHARPEN', 'PLAY_THROUGH');
    const first = playCompetitionMatch(ruleset, definition, state);
    const second = playCompetitionMatch(ruleset, definition, state);
    expect(second).toEqual(first);
    expect(first.score).toBe(scoreCompetitionMatch(first.match).score);
  });

  it('uses action-derived domain inputs and has no client score path', () => {
    const definition = buildCompetitionMatchDefinition(ruleset, '2026-09-21');
    const cautiousState = stateFor('HOLD_SHAPE', 'RECOVER', 'SET_PIECES');
    const aggressiveState = stateFor('PRESS_HIGH', 'SHARPEN', 'ATTACK_WIDE');
    const cautious = playCompetitionMatch(ruleset, definition, cautiousState);
    const aggressive = playCompetitionMatch(ruleset, definition, aggressiveState);
    expect(cautious.definition).toEqual(aggressive.definition);
    expect(cautiousState).not.toEqual(aggressiveState);
    expect(cautious.match).toHaveProperty('stats');
    expect(aggressive.match).toHaveProperty('stats');
    expect(Object.keys(cautious).includes('clientScore')).toBe(false);
  });

  it('keeps every rotating position eligible for 28 consecutive immutable day definitions', () => {
    const positions = new Set<string>();
    for (let day = 1; day <= 28; day += 1) {
      const dayKey = `2026-09-${String(day).padStart(2, '0')}`;
      const definition = buildCompetitionMatchDefinition(ruleset, dayKey);
      const state = ['PRESS_HIGH', 'SHARPEN', 'PLAY_THROUGH'].reduce(
        (current, action) => applyCompetitionAction(definition, current, action),
        initialCompetitionActionState(definition),
      );
      const result = playCompetitionMatch(ruleset, definition, state);
      positions.add(definition.position);
      expect(result.match.minutes).toBeGreaterThan(0);
    }
    expect(positions).toEqual(new Set(['GK', 'CB', 'CM', 'ST']));
  });
});
