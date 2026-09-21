import { describe, expect, it } from 'vitest';
import { reactToCoachMemory, rememberCoachChoice } from './character-memory.js';
import type { CareerState, CoachChoiceMemory, SeasonManager } from './types.js';
import type { Ruleset } from './ruleset.js';

const manager: SeasonManager = {
  id: 'home-mgr-1',
  name: '김감독',
  preferredArchetypeIds: [],
  tenureSeasons: 2,
  trustBase: 40,
};
const memory: CoachChoiceMemory = {
  id: 'source',
  actor: { id: manager.id, name: manager.name, teamId: 'home' },
  seasonIndex: 1,
  step: 3,
  matchId: 'match',
  chapterId: 'chapter',
  decisionId: 'decision',
  optionId: 'pass',
  action: 'PASS',
  outcomeKind: 'SUCCESS',
  before: { goalsFor: 0, goalsAgainst: 0 },
  after: { goalsFor: 1, goalsAgainst: 0 },
  trustDelta: 2,
};
const rules = {
  characterMemoryRules: {
    version: 'COACH_MEMORY_V1',
    memoryMax: 128,
    reactionMax: 1,
    successTrustDelta: 2,
    failTrustDelta: -1,
  },
} as Ruleset;
function state(teams: string[]): CareerState {
  return {
    characterMemory: {
      version: 'COACH_MEMORY_V1',
      memories: [memory],
      reactions: [],
      consumed: [],
    },
    seasonHistory: teams.map((teamId, i) => ({
      index: i + 1,
      teamId,
      result: { managerId: `${teamId}-mgr-1` },
    })),
  } as unknown as CareerState;
}
describe('coach memory boundaries (unit fixtures, not natural path evidence)', () => {
  it('records clamped trust and distinguishes real return from continuation', () => {
    const followup = reactToCoachMemory(state(['home']), rules, manager, 'home', 99);
    expect(followup.characterMemory?.reactions[0]).toMatchObject({
      kind: 'FOLLOW_UP',
      trustBefore: 99,
      trustAfter: 100,
      trustDelta: 1,
    });
    const reunion = reactToCoachMemory(state(['home', 'away']), rules, manager, 'home', 20);
    expect(reunion.characterMemory?.reactions[0]).toMatchObject({
      kind: 'REUNION',
      seasonIndex: 3,
      trustDelta: 2,
    });
  });
  it('does not transfer memories to a replacement or manufacture unnamed history', () => {
    expect(
      reactToCoachMemory(state(['home']), rules, { ...manager, id: 'home-mgr-2' }, 'home', 30)
        .managerTrust,
    ).toBe(30);
    expect(
      reactToCoachMemory(
        { ...state(['home']), characterMemory: undefined },
        rules,
        manager,
        'home',
        30,
      ).characterMemory,
    ).toBeUndefined();
    expect(reactToCoachMemory(state(['away']), rules, manager, 'home', 30).managerTrust).toBe(30);
  });
  it('retains dedup tombstones when display reaction history is evicted', () => {
    const first = reactToCoachMemory(state(['home']), rules, manager, 'home', 40);
    const later = { ...state(['home', 'away']), characterMemory: first.characterMemory };
    const second = reactToCoachMemory(later, rules, manager, 'home', 40);
    expect(second.characterMemory?.reactions).toHaveLength(1);
    expect(second.characterMemory?.consumed).toHaveLength(2);
    const again = reactToCoachMemory(
      { ...state(['home', 'away', 'home']), characterMemory: second.characterMemory },
      rules,
      manager,
      'home',
      40,
    );
    expect(again.managerTrust).toBe(40);
    expect(again.characterMemory).toBe(second.characterMemory);
  });
  it('leaves flagless versions byte-equivalent and ignores absent actual receipts', () => {
    const original = state(['home']);
    expect(reactToCoachMemory(original, {} as Ruleset, manager, 'home', 50)).toEqual({
      characterMemory: original.characterMemory,
      managerTrust: 50,
    });
    expect(
      rememberCoachChoice(original, rules, {
        chapterId: 'chapter',
        decisionId: 'd',
        optionId: 'x',
        match: {} as never,
      }),
    ).toBe(original);
  });
});
