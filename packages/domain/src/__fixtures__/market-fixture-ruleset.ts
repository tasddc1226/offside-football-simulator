import { rulesetProto } from './career-01.js';
import type { Ruleset, Team } from '../ruleset.js';

/**
 * T-3-002: market.ts 골든·테스트 전용 8팀 룰셋(실제 1.0.0 콘텐츠 룰셋의 팀 분포 — YOUTH 1·tier1
 * 2·tier2 3·tier3 2 — 를 domain 안에서 흉내낸 것). ADR-005(`@offside/domain`은 어떤 패키지에도
 * 의존하지 않는다)라 실제 content 1.0.0 룰셋을 domain 테스트에서 import할 수 없어, `rulesetProto`의
 * `teams`만 복제·확장한다. `transferRules`를 요구하는 `demandBands` 밴드 4개가 각각 후보 팀을
 * 1개 이상 만나는지, `generateMarket`의 제안 수(최대 4)가 실제로 4까지 뽑히는지를 검증하는 데 쓴다 —
 * `ruleset-proto.json`(다른 9개 골든이 공유) 자체는 건드리지 않는다.
 */
const EXTRA_TEAMS: Team[] = [
  { id: 'incheon-tier1', name: '인천 유나이티드', leagueTier: 1, reputation: 4, wageBandId: 'tier1', leagueId: 'league-tier1', tacticalStyleId: 'counter', squadStrength: 78 },
  { id: 'daegu-tier2', name: '대구 FC', leagueTier: 2, reputation: 3, wageBandId: 'tier2', leagueId: 'league-tier2', tacticalStyleId: 'press', squadStrength: 60 },
  { id: 'gwangju-tier2', name: '광주 시티', leagueTier: 2, reputation: 3, wageBandId: 'tier2', leagueId: 'league-tier2', tacticalStyleId: 'possession', squadStrength: 58 },
  { id: 'ulsan-tier3', name: '울산 FC', leagueTier: 3, reputation: 2, wageBandId: 'tier3', leagueId: 'league-tier3', tacticalStyleId: 'counter', squadStrength: 48 },
];

export const marketFixtureRuleset: Ruleset = {
  ...rulesetProto,
  teams: [...rulesetProto.teams, ...EXTRA_TEAMS],
};
