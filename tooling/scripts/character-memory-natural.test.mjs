import { describe, expect, it } from 'vitest';
import { simulateRange } from './career-sim.ts';
import { loadRuleset } from '../../packages/content/src/rulesets/load-ruleset.ts';
import { CareerStateSchema } from '../../packages/contracts/src/career-state.ts';
import { simulate } from '../../packages/domain/src/simulate.ts';

function run(index, rulesetVersion = '3.3.0', contentPackVersion = '0.12.0') {
  const trace = [];
  const options = {
    rulesetVersion,
    contentPackVersion,
    seeds: index + 1,
    rangeStart: index,
    rangeEnd: index + 1,
    seedPrefix: 'growth-reunion-probe',
    seasons: 6,
    toRetirement: false,
    policy: 'world',
    position: 'all',
    mode: 'CHAPTER',
    jobs: 1,
    out: '/tmp/offside-no-output',
    verify: false,
  };
  const batch = simulateRange(options, (command, snapshot) =>
    trace.push({ command: structuredClone(command), snapshot }),
  );
  expect(batch.failures).toEqual([]);
  let replay = null;
  const ruleset = loadRuleset(rulesetVersion);
  for (const entry of trace) {
    const result = simulate({
      snapshot: replay,
      command: entry.command,
      ruleset,
      rulesetVersion,
      contentPackVersion,
    });
    expect(result.ok).toBe(true);
    replay = result.snapshot;
    expect(replay.stateHash).toBe(entry.snapshot.stateHash);
  }
  expect(CareerStateSchema.parse(JSON.parse(JSON.stringify(replay.state)))).toEqual(replay.state);
  return trace;
}
describe('coach memories from natural command progression', () => {
  it('remembers an actual goalkeeper choice then recognizes exact coach on a real transfer return', () => {
    const trace = run(0);
    const arrival = trace.find((entry) =>
      entry.snapshot.state.characterMemory?.reactions.some((r) => r.kind === 'REUNION'),
    );
    expect(arrival.command.type).toBe('START_SEASON');
    const reaction = arrival.snapshot.state.characterMemory.reactions.find(
      (r) => r.kind === 'REUNION',
    );
    expect(reaction).toMatchObject({
      seasonIndex: 5,
      actor: { id: 'yokohama-blue-mgr-1', teamId: 'yokohama-blue' },
      memory: { seasonIndex: 3 },
      trustDelta: 2,
    });
    const source = trace.find(
      (entry) =>
        entry.command.type === 'RESOLVE_CHAPTER' &&
        entry.snapshot.state.characterMemory?.memories.some((m) => m.id === reaction.memory.id),
    );
    expect(source.snapshot.state.season.manager.id).toBe(reaction.actor.id);
    expect(source.command.payload.optionId).toBe(reaction.memory.optionId);
    expect(arrival.snapshot.state.seasonHistory.at(-1).teamId).toBe('porto-atlantico');
    expect(reaction.trustAfter - reaction.trustBefore).toBe(reaction.trustDelta);
  }, 30_000);
  it('produces a meaningful continuing-coach response and no false replacement inheritance', () => {
    const trace = run(3);
    const reactions = trace.at(-1).snapshot.state.characterMemory.reactions;
    expect(
      reactions.some(
        (r) =>
          r.kind === 'FOLLOW_UP' &&
          r.seasonIndex === 2 &&
          r.memory.seasonIndex === 1 &&
          r.trustDelta === -1,
      ),
    ).toBe(true);
    for (const entry of trace.filter((entry) => entry.command.type === 'START_SEASON')) {
      const state = entry.snapshot.state;
      for (const reaction of state.characterMemory?.reactions.filter(
        (r) => r.seasonIndex === state.season.index,
      ) ?? [])
        expect(reaction.actor.id).toBe(state.season.manager.id);
    }
  }, 30_000);
  it('never invents a memory for a same-ID return with no prior club choice, and leaves old pair absent', () => {
    const current = run(11);
    expect(
      current.find(
        (entry) => entry.command.type === 'START_SEASON' && entry.snapshot.state.season.index === 3,
      ).snapshot.state.characterMemory?.reactions ?? [],
    ).toEqual([]);
    const old = run(0, '3.2.0', '0.11.0');
    expect(old.every((entry) => !Object.hasOwn(entry.snapshot.state, 'characterMemory'))).toBe(
      true,
    );
  }, 30_000);
});
