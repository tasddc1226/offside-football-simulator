import { runSettledFixture } from './career-06-settled.js';
import { marketFixtureRuleset } from './market-fixture-ruleset.js';
import { generateMarket, judgeMarketReason, type GeneratedMarket } from '../market.js';
import type { CareerState } from '../types.js';

export const MARKET_02_REVISION = 15;

/**
 * T-3-002 시장 골든 2(관심·STARTER): career-06-settled 결산 뒤 상태에서 계약 `rolePromise`(안전
 * 잔류 제안의 역할로 쓰인다)와 `이적_희망`·`에이전트_계약` 태그를 준다 — `judgeMarketReason` →
 * `'INTEREST'`(태그), 제안 수 `clamp(1+2+1,1,4) = 4`(안전 잔류 + 4 = 5건). 오케스트레이터 리뷰(PR
 * #50): `season === null`에서 kind 추첨이 쓰는 `currentSquadRole`은 `seasonHistory.at(-1)`의
 * `squadRoleAtEnd`이지 `contract.rolePromise`가 아니다 — `kindWeightsByRole.STARTER`(TRANSFER
 * 80%)를 쓰는 TRANSFER 위주 시나리오를 만들려면 그 값을 `STARTER`로 override해야 한다.
 */
export function buildMarket02InterestStarterState(): CareerState {
  const { snapshot, beforeSettlementState } = runSettledFixture();
  // T-3-003 §5: settleSeason이 이제 결산 뒤 시장을 실제로 연다(openMarketAfterSettlement 배선). 이
  // fixture는 "생성기만" 보는 게 목적이라, 그 배선이 소비했을 rng·pending을 결산 이전(SETTLE_SEASON
  // 직전) 값으로 되돌려 시장 골든이 그 배선과 무관하게 그대로 유지되게 한다.
  const base = { ...snapshot.state, rngState: beforeSettlementState.rngState, pending: null };
  if (base.contract === null) throw new RangeError('market-02: contract가 null이다.');
  const lastIndex = base.seasonHistory.length - 1;
  if (lastIndex < 0) throw new RangeError('market-02: seasonHistory가 비어 있다.');
  const seasonHistory = base.seasonHistory.map((summary, index) =>
    index === lastIndex
      ? { ...summary, result: { ...summary.result, selectionSummary: { ...summary.result.selectionSummary, squadRoleAtEnd: 'STARTER' as const } } }
      : summary,
  );
  return {
    ...base,
    tags: ['이적_희망', '에이전트_계약'],
    contract: { ...base.contract, rolePromise: 'STARTER' },
    seasonHistory,
  };
}

export function runMarket02InterestStarter(): { state: CareerState; reason: 'EXPIRED' | 'INTEREST'; result: GeneratedMarket } {
  const state = buildMarket02InterestStarterState();
  const reason = judgeMarketReason(state, marketFixtureRuleset);
  if (reason === null) throw new RangeError('market-02: judgeMarketReason이 null이다(시나리오가 깨졌다).');
  const result = generateMarket({ state, ruleset: marketFixtureRuleset, reason, revision: MARKET_02_REVISION, rng: state.rngState });
  return { state, reason, result };
}
