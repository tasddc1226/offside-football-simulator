import { runSettledFixture } from './career-06-settled.js';
import { marketFixtureRuleset } from './market-fixture-ruleset.js';
import { generateMarket, judgeMarketReason, type GeneratedMarket } from '../market.js';
import type { CareerState } from '../types.js';

export const MARKET_02_REVISION = 15;

/**
 * T-3-002 시장 골든 2(관심·STARTER): career-06-settled 결산 뒤 상태(`season === null`이라
 * `currentSquadRole`이 `contract.rolePromise`로 대체된다)에서 `rolePromise`만 `STARTER`로 올리고
 * `이적_희망`·`에이전트_계약` 태그를 둘 다 준다 — `judgeMarketReason` → `'INTEREST'`(태그),
 * 제안 수 `clamp(1+2+1,1,4) = 4`(안전 잔류 + 4 = 5건), `kindWeightsByRole.STARTER`(TRANSFER 80%)라
 * TRANSFER 위주가 나온다.
 */
export function buildMarket02InterestStarterState(): CareerState {
  const { snapshot } = runSettledFixture();
  const base = snapshot.state;
  if (base.contract === null) throw new RangeError('market-02: contract가 null이다.');
  return { ...base, tags: ['이적_희망', '에이전트_계약'], contract: { ...base.contract, rolePromise: 'STARTER' } };
}

export function runMarket02InterestStarter(): { state: CareerState; reason: 'EXPIRED' | 'INTEREST'; result: GeneratedMarket } {
  const state = buildMarket02InterestStarterState();
  const reason = judgeMarketReason(state, marketFixtureRuleset);
  if (reason === null) throw new RangeError('market-02: judgeMarketReason이 null이다(시나리오가 깨졌다).');
  const result = generateMarket({ state, ruleset: marketFixtureRuleset, reason, revision: MARKET_02_REVISION, rng: state.rngState });
  return { state, reason, result };
}
