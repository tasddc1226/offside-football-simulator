import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_KEYS } from './types.js';
import { simulateFriendly, type FriendlyInput, type FriendlyPlayer } from './friendly-match.js';

const player = (
  id = 'legend',
  position: FriendlyPlayer['position'] = 'ST',
  value = 85,
): FriendlyPlayer => ({
  id,
  name: id,
  position,
  archiveHash: 'a'.repeat(64),
  attributes: Object.fromEntries(
    ATTRIBUTE_KEYS.map((key) => [key, value]),
  ) as FriendlyPlayer['attributes'],
});
const input = (): FriendlyInput => ({
  version: 'FRIENDLY_V1',
  seed: 'friendly-proof',
  formation: '4-3-3',
  tactic: 'BALANCED',
  lineup: Array.from({ length: 18 }, (_, i) => (i === 9 ? player() : null)),
});
describe('FRIENDLY_V1 immutable retired-player match', () => {
  it('keeps arbitrary saved career IDs distinct from every basic actor, including reserves', () => {
    const source = input();
    source.lineup[9] = player('AWAY-basic-0');
    source.lineup[8] = player('_AWAY-basic-0', 'W');
    source.lineup[11] = player('HOME-basic-0', 'GK');
    const saved = JSON.stringify(source);
    const result = simulateFriendly(source);
    const ids = [...result.home, ...result.away].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(result.away[0]!.id).toBe('__AWAY-basic-0');
    expect(result.home.find((p) => p.basic && p.slot === 0)?.id).toBe('_HOME-basic-0');
    expect(result.home.find((p) => p.id === 'AWAY-basic-0')?.basic).toBe(false);
    expect(source.lineup[9]!.id).toBe('AWAY-basic-0');
    for (const moment of result.moments) {
      for (const id of [moment.shooterId, moment.providerId, moment.keeperId]) {
        expect(ids.filter((actorId) => actorId === id)).toHaveLength(1);
      }
    }
    expect(JSON.stringify(source)).toBe(saved);
    expect(simulateFriendly(JSON.parse(saved) as FriendlyInput)).toEqual(result);
  });
  it('replays exactly without mutating input; one legend gets ten visible basic starters', () => {
    const source = input();
    const before = JSON.stringify(source);
    const result = simulateFriendly(source);
    expect(simulateFriendly(JSON.parse(before) as FriendlyInput)).toEqual(result);
    expect(JSON.stringify(source)).toBe(before);
    expect(result.home.filter((p) => p.basic)).toHaveLength(10);
    expect(result.home.find((p) => p.id === 'legend')?.toMinute).toBe(90);
    expect(result.moments).toHaveLength(24);
    expect(result.moments.at(-1)?.minute).toBe(90);
  });
  it('balances every shot, goal, assist, save and player minute, including halftime bench windows', () => {
    const source = input();
    source.lineup[11] = player('sub-1', 'ST');
    source.lineup[12] = player('sub-2', 'CB');
    source.lineup[13] = player('sub-3', 'CM');
    source.lineup[14] = player('unused', 'W');
    const result = simulateFriendly(source);
    for (const [side, team, goals] of [
      ['HOME', result.home, result.homeGoals],
      ['AWAY', result.away, result.awayGoals],
    ] as const) {
      expect(team.reduce((sum, p) => sum + p.toMinute - p.fromMinute, 0)).toBe(990);
      expect(team.reduce((sum, p) => sum + p.goals, 0)).toBe(goals);
      expect(team.reduce((sum, p) => sum + p.assists, 0)).toBe(goals);
      expect(result.moments.filter((m) => m.side === side && m.outcome === 'GOAL')).toHaveLength(
        goals,
      );
      for (const actor of team) {
        expect(actor.goals).toBe(
          result.moments.filter((m) => m.outcome === 'GOAL' && m.shooterId === actor.id).length,
        );
        expect(actor.assists).toBe(
          result.moments.filter((m) => m.outcome === 'GOAL' && m.providerId === actor.id).length,
        );
        expect(actor.saves).toBe(
          result.moments.filter((m) => m.outcome === 'SAVE' && m.keeperId === actor.id).length,
        );
      }
    }
    expect(result.home).toHaveLength(14);
    expect(result.home.find((p) => p.id === 'legend')?.toMinute).toBe(45);
    expect(result.home.find((p) => p.id === 'sub-1')?.fromMinute).toBe(45);
    for (const moment of result.moments) {
      const attacking = moment.side === 'HOME' ? result.home : result.away;
      for (const id of [moment.shooterId, moment.providerId]) {
        const actor = attacking.find((p) => p.id === id)!;
        expect(moment.minute).toBeGreaterThan(actor.fromMinute);
        expect(moment.minute).toBeLessThanOrEqual(actor.toMinute);
      }
    }
  });
  it('formation, position fit, supporting passing and tactic change actual calculation', () => {
    const base = input();
    const before = simulateFriendly(base);
    const wrong = input();
    wrong.lineup[9] = player('legend', 'CB');
    expect(simulateFriendly(wrong).home.find((p) => p.id === 'legend')?.fitPercent).toBe(65);
    expect(simulateFriendly(wrong).strengths).not.toEqual(before.strengths);
    const press = simulateFriendly({ ...base, tactic: 'PRESS' });
    expect(press.strengths[0]!.homeAttack).toBeGreaterThan(before.strengths[0]!.homeAttack);
    expect(press.strengths[0]!.homeDefence).toBeLessThan(before.strengths[0]!.homeDefence);
    expect(simulateFriendly({ ...base, formation: '3-5-2' }).strengths).not.toEqual(
      before.strengths,
    );
    const combination = input();
    combination.lineup[8] = player('provider', 'W', 99);
    expect(simulateFriendly(combination).moments).not.toEqual(before.moments);
    const bench = input();
    bench.lineup[9] = null;
    bench.lineup[8] = player('other', 'W', 55);
    bench.lineup[11] = player();
    expect(simulateFriendly(bench).strengths[0]).not.toEqual(before.strengths[0]);
  });
  it('stronger finishing improves actual goals over a deterministic seed cohort', () => {
    let strong = 0;
    let weak = 0;
    for (let i = 0; i < 200; i++) {
      const a = input();
      a.seed = `cohort-${i}`;
      const b = input();
      b.seed = a.seed;
      b.lineup[9] = player('legend', 'ST', 25);
      strong += simulateFriendly(a).homeGoals;
      weak += simulateFriendly(b).homeGoals;
    }
    expect(strong).toBeGreaterThan(weak);
  });
  it('rejects empty, duplicate and incompatible goalkeeper starters', () => {
    const empty = input();
    empty.lineup[9] = null;
    expect(() => simulateFriendly(empty)).toThrow();
    const duplicate = input();
    duplicate.lineup[8] = player();
    expect(() => simulateFriendly(duplicate)).toThrow();
    const keeper = input();
    keeper.lineup[9] = player('keeper', 'GK');
    expect(() => simulateFriendly(keeper)).toThrow();
  });
});
