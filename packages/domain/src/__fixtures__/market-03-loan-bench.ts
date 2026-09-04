import { runSettledFixture } from './career-06-settled.js';
import { marketFixtureRuleset } from './market-fixture-ruleset.js';
import { generateMarket, judgeMarketReason, type GeneratedMarket } from '../market.js';
import type { CareerState } from '../types.js';

export const MARKET_03_REVISION = 15;

/**
 * T-3-002 시장 골든 3(관심·BENCH·임대): career-06-settled 결산 뒤 상태에서 `rolePromise`만 `BENCH`로
 * 낮추고 `이적_희망` 태그만 준다 — `judgeMarketReason` → `'INTEREST'`(태그), 제안 수
 * `clamp(1+2+0,1,4) = 3`(안전 잔류 + 3 = 4건). 오케스트레이터 리뷰(PR #50): `season === null`에서
 * kind 추첨이 쓰는 `currentSquadRole`은 `seasonHistory.at(-1)`의 `squadRoleAtEnd`다 —
 * `kindWeightsByRole.BENCH`(LOAN 70%)를 쓰는 LOAN 위주 시나리오를 만들려면 그 값도 `BENCH`로
 * override해야 한다(그중 하나는 바이아웃 `buyOptionMinor`을 포함한다).
 */
export function buildMarket03LoanBenchState(): CareerState {
  const { snapshot } = runSettledFixture();
  const base = snapshot.state;
  if (base.contract === null) throw new RangeError('market-03: contract가 null이다.');
  const lastIndex = base.seasonHistory.length - 1;
  if (lastIndex < 0) throw new RangeError('market-03: seasonHistory가 비어 있다.');
  const seasonHistory = base.seasonHistory.map((summary, index) =>
    index === lastIndex
      ? { ...summary, result: { ...summary.result, selectionSummary: { ...summary.result.selectionSummary, squadRoleAtEnd: 'BENCH' as const } } }
      : summary,
  );
  return { ...base, tags: ['이적_희망'], contract: { ...base.contract, rolePromise: 'BENCH' }, seasonHistory };
}

export function runMarket03LoanBench(): { state: CareerState; reason: 'EXPIRED' | 'INTEREST'; result: GeneratedMarket } {
  const state = buildMarket03LoanBenchState();
  const reason = judgeMarketReason(state, marketFixtureRuleset);
  if (reason === null) throw new RangeError('market-03: judgeMarketReason이 null이다(시나리오가 깨졌다).');
  const result = generateMarket({ state, ruleset: marketFixtureRuleset, reason, revision: MARKET_03_REVISION, rng: state.rngState });
  return { state, reason, result };
}
