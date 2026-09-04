import { runSettledFixture } from './career-06-settled.js';
import { marketFixtureRuleset } from './market-fixture-ruleset.js';
import { generateMarket, judgeMarketReason, type GeneratedMarket } from '../market.js';
import type { CareerState } from '../types.js';

export const MARKET_03_REVISION = 15;

/**
 * T-3-002 시장 골든 3(관심·BENCH·임대): career-06-settled 결산 뒤 상태에서 `rolePromise`만 `BENCH`로
 * 낮추고 `이적_희망` 태그만 준다 — `judgeMarketReason` → `'INTEREST'`(태그), 제안 수
 * `clamp(1+2+0,1,4) = 3`(안전 잔류 + 3 = 4건), `kindWeightsByRole.BENCH`(LOAN 70%)라 LOAN 위주가
 * 나오고 그중 하나는 바이아웃(`buyOptionMinor`)을 포함한다.
 */
export function buildMarket03LoanBenchState(): CareerState {
  const { snapshot } = runSettledFixture();
  const base = snapshot.state;
  if (base.contract === null) throw new RangeError('market-03: contract가 null이다.');
  return { ...base, tags: ['이적_희망'], contract: { ...base.contract, rolePromise: 'BENCH' } };
}

export function runMarket03LoanBench(): { state: CareerState; reason: 'EXPIRED' | 'INTEREST'; result: GeneratedMarket } {
  const state = buildMarket03LoanBenchState();
  const reason = judgeMarketReason(state, marketFixtureRuleset);
  if (reason === null) throw new RangeError('market-03: judgeMarketReason이 null이다(시나리오가 깨졌다).');
  const result = generateMarket({ state, ruleset: marketFixtureRuleset, reason, revision: MARKET_03_REVISION, rng: state.rngState });
  return { state, reason, result };
}
