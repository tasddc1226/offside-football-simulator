import { runSettledFixture } from './career-06-settled.js';
import { marketFixtureRuleset } from './market-fixture-ruleset.js';
import { generateMarket, judgeMarketReason, type GeneratedMarket } from '../market.js';
import type { CareerState } from '../types.js';

export const MARKET_01_REVISION = 15;

/**
 * T-3-002 시장 골든 1(만료): career-06-settled 결산 뒤 상태(계약 `lengthSeasons: 3`, 잔여 2)에서
 * 계약 `lengthSeasons`만 1로 바꿔 잔여를 0으로 만들고(`judgeMarketReason` → `'EXPIRED'`) 태그를
 * 비운다(태그발 제안 수 보너스를 걷어내 "안전 잔류 + FREE_AGENT 1건"만 남는 최소 시나리오를 본다).
 * 오케스트레이터 리뷰(PR #50): `season === null`에서 `currentSquadRole`은 이제 `seasonHistory.at(-1)`의
 * `squadRoleAtEnd`를 쓴다(계약의 `rolePromise`가 아니다) — 골든의 안전 제안 강등(`BENCH` → `RESERVE`)
 * 시나리오를 유지하려면 그 값을 `BENCH`로 override해야 한다.
 */
export function buildMarket01ExpiredState(): CareerState {
  const { snapshot } = runSettledFixture();
  const base = snapshot.state;
  if (base.contract === null) throw new RangeError('market-01: contract가 null이다.');
  const lastIndex = base.seasonHistory.length - 1;
  if (lastIndex < 0) throw new RangeError('market-01: seasonHistory가 비어 있다.');
  const seasonHistory = base.seasonHistory.map((summary, index) =>
    index === lastIndex
      ? { ...summary, result: { ...summary.result, selectionSummary: { ...summary.result.selectionSummary, squadRoleAtEnd: 'BENCH' as const } } }
      : summary,
  );
  return { ...base, tags: [], contract: { ...base.contract, lengthSeasons: 1 }, seasonHistory };
}

export function runMarket01Expired(): { state: CareerState; reason: 'EXPIRED' | 'INTEREST'; result: GeneratedMarket } {
  const state = buildMarket01ExpiredState();
  const reason = judgeMarketReason(state, marketFixtureRuleset);
  if (reason === null) throw new RangeError('market-01: judgeMarketReason이 null이다(시나리오가 깨졌다).');
  const result = generateMarket({ state, ruleset: marketFixtureRuleset, reason, revision: MARKET_01_REVISION, rng: state.rngState });
  return { state, reason, result };
}
