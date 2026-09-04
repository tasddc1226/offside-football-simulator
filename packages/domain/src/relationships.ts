import type { RngState } from './rng.js';
import type { Ruleset } from './ruleset.js';
import type { CareerState, FootballSeason, SeasonResult } from './types.js';

/**
 * T-4-001 D-50: 결산 시 `settleSeason`이 `settledState`를 만든 직후, `evaluateCareerTags` 전에 부르는
 * 훅 골격. 지금은 항등(rng 소비 0)이다 — 감독 교체·주장 임명·평판 갱신·약속 위반 관계 Effect는
 * T-4-003이 이 함수 본문만 채운다.
 */
export function onSettlementRelations(input: {
  state: CareerState;
  season: FootballSeason;
  result: SeasonResult;
  ruleset: Ruleset;
  rng: RngState;
}): { state: CareerState; rng: RngState } {
  return { state: input.state, rng: input.rng };
}
