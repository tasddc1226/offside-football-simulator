import { describe, expect, it } from 'vitest';
import { CoachMemoryStateSchema } from './career-state.js';
const actor = { id: 'coach-1', name: '감독', teamId: 'club' };
const memory = {
  id: 'm',
  actor,
  seasonIndex: 1,
  step: 1,
  matchId: 'match',
  chapterId: 'chapter',
  decisionId: 'd',
  optionId: 'pass',
  action: 'PASS',
  outcomeKind: 'SUCCESS',
  before: { goalsFor: 0, goalsAgainst: 0 },
  after: { goalsFor: 1, goalsAgainst: 0 },
  trustDelta: 1,
};
const reaction = {
  id: 'r',
  actor,
  memory,
  seasonIndex: 2,
  kind: 'FOLLOW_UP',
  trustBefore: 99,
  trustAfter: 100,
  trustDelta: 1,
};
const valid = {
  version: 'COACH_MEMORY_V1',
  memories: [memory],
  reactions: [reaction],
  consumed: [{ memoryId: 'm', kind: 'FOLLOW_UP' }],
};
describe('persisted coach memory schema', () => {
  it('round-trips captured identity and clamped effect', () =>
    expect(CoachMemoryStateSchema.parse(JSON.parse(JSON.stringify(valid)))).toEqual(valid));
  it('rejects duplicated identities, impossible attribution/time/delta and unknown consumed source', () => {
    for (const invalid of [
      { ...valid, memories: [memory, memory] },
      { ...valid, reactions: [reaction, reaction] },
      { ...valid, reactions: [{ ...reaction, actor: { ...actor, id: 'other' } }] },
      { ...valid, reactions: [{ ...reaction, seasonIndex: 1 }] },
      { ...valid, reactions: [{ ...reaction, trustDelta: 2 }] },
      { ...valid, consumed: [{ memoryId: 'missing', kind: 'REUNION' }] },
    ])
      expect(CoachMemoryStateSchema.safeParse(invalid).success).toBe(false);
  });
});
