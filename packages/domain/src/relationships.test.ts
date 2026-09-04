import { describe, expect, it } from 'vitest';
import { onSettlementRelations } from './relationships.js';
import { rulesetProto } from './__fixtures__/career-01.js';
import { seedRng } from './rng.js';
import type { CareerState, FootballSeason, SeasonResult } from './types.js';

// T-4-001 D-50: 감독 교체·주장 임명·평판 갱신·약속 위반 관계 Effect는 T-4-003이 채운다 — 이번
// 작업은 settleSeason의 배선(호출 시점·인자)만 만들고 훅 본문은 항등으로 둔다.
describe('onSettlementRelations', () => {
  it('T-4-003 전까지는 항등이다(state·rng를 그대로 돌려준다)', () => {
    const rng = seedRng('relationships-test');
    const state = { rngState: rng } as CareerState;

    const result = onSettlementRelations({
      state,
      season: {} as FootballSeason,
      result: {} as SeasonResult,
      ruleset: rulesetProto,
      rng,
    });

    expect(result.state).toBe(state);
    expect(result.rng).toBe(rng);
  });
});
