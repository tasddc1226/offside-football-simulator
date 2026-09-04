import { clamp } from './clamp.js';
import type { MarketValueRules, Ruleset } from './ruleset.js';
import type { CareerState, TimelineEntry } from './types.js';

export type MarketValueComponent = 'BASE_OVR' | 'SCOUTED_POTENTIAL_MID' | 'AGE_CURVE' | 'CONTRACT' | 'LEAGUE' | 'FORM' | 'POPULARITY';

/**
 * D-41: `truePotential`은 절대 여기 없다 — 숨긴 잠재력을 쓰면 시장가치에서 역산되므로(03 "리그와
 * 시장가치") 타입으로 막는다(`market-value.test.ts`의 `expectTypeOf`가 보증).
 */
export type MarketValueInput = {
  baseOvr: number;
  scoutedPotentialMid: number;
  age: number;
  contractSeasonsRemaining: number;
  leagueTier: 'YOUTH' | 1 | 2 | 3;
  form: number;
  popularityCenti: number;
};

export type MarketValueResult = {
  indexCenti: number;
  components: Array<{ key: MarketValueComponent; weightBp: number; valueCenti: number; contributionCenti: number }>;
};

const COMPONENT_ORDER: readonly MarketValueComponent[] = ['BASE_OVR', 'SCOUTED_POTENTIAL_MID', 'AGE_CURVE', 'CONTRACT', 'LEAGUE', 'FORM', 'POPULARITY'];

function clampCenti(value: number): number {
  return clamp(value, 0, 10000);
}

/** `rules.ageCurve`는 `maxAge` 오름차순 구간표다. 마지막 원소(maxAge 99)가 항상 있어 도달하지 않는 경우는 없다. */
function ageCurveValueCenti(age: number, rows: readonly { maxAge: number; valueCenti: number }[]): number {
  for (const row of rows) {
    if (age <= row.maxAge) return row.valueCenti;
  }
  return rows[rows.length - 1]!.valueCenti;
}

function contractCurveValueCenti(remaining: number, curve: MarketValueRules['contractCurve']): number {
  if (remaining <= 0) return curve.remaining0;
  if (remaining === 1) return curve.remaining1;
  return curve.remaining2Plus;
}

function leagueTierKey(leagueTier: MarketValueInput['leagueTier']): '1' | '2' | '3' | 'YOUTH' {
  return typeof leagueTier === 'number' ? (String(leagueTier) as '1' | '2' | '3') : leagueTier;
}

/**
 * D-41: `Market Value Index = Base OVR 35% + Scouted Potential Mid 20% + Age Curve 15% + Contract 10%
 * + League 10% + Form 5% + Popularity 5%`(03 문서 식 그대로, 가중치는 bp 단위·합 10000). 각 성분을
 * 0~10000 centi로 정규화한 뒤 가중 기여분을 반올림 1회로 정수화하고, `indexCenti`는 이미 정수인
 * 기여분들의 합이라 추가 반올림이 필요 없다(D-36 "반올림 함수마다 한 번"). 상태에 저장하지 않는다 —
 * 호출할 때마다 계산한다.
 */
export function computeMarketValueIndex(input: MarketValueInput, rules: MarketValueRules): MarketValueResult {
  const tierKey = leagueTierKey(input.leagueTier);

  const valueCenti: Record<MarketValueComponent, number> = {
    BASE_OVR: clampCenti(input.baseOvr * 100),
    SCOUTED_POTENTIAL_MID: clampCenti(input.scoutedPotentialMid * 100),
    AGE_CURVE: ageCurveValueCenti(input.age, rules.ageCurve),
    CONTRACT: contractCurveValueCenti(input.contractSeasonsRemaining, rules.contractCurve),
    LEAGUE: rules.leagueTierValueCenti[tierKey],
    FORM: clampCenti(input.form * 100),
    POPULARITY: clampCenti(input.popularityCenti),
  };

  const weightBp: Record<MarketValueComponent, number> = {
    BASE_OVR: rules.weightsBp.baseOvr,
    SCOUTED_POTENTIAL_MID: rules.weightsBp.scoutedPotentialMid,
    AGE_CURVE: rules.weightsBp.ageCurve,
    CONTRACT: rules.weightsBp.contract,
    LEAGUE: rules.weightsBp.league,
    FORM: rules.weightsBp.form,
    POPULARITY: rules.weightsBp.popularity,
  };

  let indexCenti = 0;
  const components = COMPONENT_ORDER.map((key) => {
    const contributionCenti = Math.round((valueCenti[key] * weightBp[key]) / 10000);
    indexCenti += contributionCenti;
    return { key, weightBp: weightBp[key], valueCenti: valueCenti[key], contributionCenti };
  });

  return { indexCenti, components };
}

/**
 * ADR-010 D-41 유도식: `lengthSeasons − 서명 이후 SEASON_STARTED 횟수`. "서명 이후"는 `timeline`에서
 * 이 계약 서명(`signedAtRevision`) 이후 `SEASON_STARTED`가 몇 번 있었는지로 센다(별도 저장 필드 없이
 * 기존 timeline에서 유도). T-3-001 조건 DSL `contract.seasonsRemaining`이 이 식을 그대로 복제해
 * 쓴다(content는 domain 런타임을 import할 수 없다 — ADR-005, `resolvePositionGroup`과 같은 패턴).
 */
export function computeContractSeasonsRemaining(
  lengthSeasons: number,
  signedAtRevision: number,
  timeline: readonly TimelineEntry[],
): number {
  const seasonsServed = timeline.filter(
    (entry) => entry.kind === 'SEASON_STARTED' && entry.revision > signedAtRevision,
  ).length;
  return Math.max(0, lengthSeasons - seasonsServed);
}

/**
 * D-41: Phase 3가 그대로 쓰는 어댑터. `state.contract`·`state.player.profile`이 있어야 한다(계약·
 * 선수 확정 전에는 시장가치를 계산할 이유가 없다). `popularityCenti`는 T-4-001부터 `state.reputation`을
 * 읽는다(기본값 5000은 `reputationRules.initialPopularityCenti`와 같아 지수 결과가 이전과 같다).
 */
// `ruleset` 인자는 시그니처를 D-41("buildMarketValueInput(state, ruleset)")대로 유지한다 — 현재
// 입력 항목(baseOvr·scoutedPotentialMid·age·contractSeasonsRemaining·leagueTier·form)은 모두
// `state`에서 직접 유도되고 룰셋 조회가 필요 없지만, `computeMarketValueIndex`를 바로 이어 부를 때
// 호출자가 `ruleset.marketValueRules`도 이 함수에서 함께 받을 수 있도록 자리를 남긴다.
export function buildMarketValueInput(state: CareerState, _ruleset: Ruleset): MarketValueInput {
  const profile = state.player.profile;
  if (profile === null) {
    throw new RangeError('buildMarketValueInput: player.profile이 null이다.');
  }
  const contract = state.contract;
  if (contract === null) {
    throw new RangeError('buildMarketValueInput: contract가 null이다.');
  }

  const contractSeasonsRemaining = computeContractSeasonsRemaining(
    contract.lengthSeasons,
    contract.signedAtRevision,
    state.timeline,
  );

  return {
    baseOvr: profile.baseOvr,
    scoutedPotentialMid: Math.round((profile.scoutedPotentialMin + profile.scoutedPotentialMax) / 2),
    age: state.age,
    contractSeasonsRemaining,
    leagueTier: contract.leagueTier,
    form: state.state.form,
    popularityCenti: state.reputation.popularityCenti,
  };
}
