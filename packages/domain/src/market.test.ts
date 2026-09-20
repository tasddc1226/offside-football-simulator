import { describe, expect, it } from 'vitest';
import { rulesetProto, runCareerFixture } from './__fixtures__/career-01.js';
import { runGkFixture } from './__fixtures__/career-04-gk.js';
import { runSettledFixture } from './__fixtures__/career-06-settled.js';
import { marketFixtureRuleset } from './__fixtures__/market-fixture-ruleset.js';
import { buildMarketValueInput, computeMarketValueIndex } from './market-value.js';
import {
  buildRenewalOffer,
  countContractMatchesPlayed,
  generateMarket,
  isRenewalWindowOpen,
  judgeMarketReason,
  openMarketAfterSettlement,
} from './market.js';
import { seedRng } from './rng.js';
import { selectOpenSlot } from './season.js';
import type { CareerState, SeasonStep, SquadRole } from './types.js';

// T-3-002: market.ts는 ADR-005(도메인은 어떤 패키지에도 의존하지 않는다) 때문에 실제 1.0.0 콘텐츠
// 룰셋을 쓸 수 없다 — 브리프는 "실제 1.0.0 룰셋"을 요구하지만(PR 본문 "결정 필요" 참고), 이 테스트는
// domain 내부 fixture(`rulesetProto`·`marketFixtureRuleset`)로 같은 조건을 재현한다.

function contractOf(state: CareerState) {
  const contract = state.contract;
  if (contract === null) throw new RangeError('fixture contract가 null이다.');
  return contract;
}

describe('judgeMarketReason', () => {
  // career-06-settled의 SETTLE_SEASON 직전 상태(`season !== null`, step 12) — 브리프가 요구하는 입력
  // 형태 그대로다. 계약 lengthSeasons 3·잔여 2, season.squadRole ROTATION, 평균 평점 64(<70),
  // 시장가치 지수 7235(≥7000)라 override 없이 그대로 쓰면 index발 INTEREST가 나온다.
  const { beforeSettlementState: base } = runSettledFixture();

  function stateAtMarketIndex(target: number): CareerState {
    for (let popularityCenti = 0; popularityCenti <= 10000; popularityCenti += 1) {
      const state: CareerState = {
        ...base,
        reputation: { ...base.reputation, popularityCenti },
      };
      const index = computeMarketValueIndex(
        buildMarketValueInput(state, rulesetProto),
        rulesetProto.marketValueRules,
      ).indexCenti;
      if (index === target) return state;
    }
    throw new Error(`market index ${target}를 만드는 popularityCenti를 찾지 못했다.`);
  }

  it('계약 잔여 0이면 EXPIRED — 다른 조건과 무관하게 우선한다', () => {
    const state: CareerState = { ...base, contract: { ...contractOf(base), lengthSeasons: 1 } };
    expect(judgeMarketReason(state, rulesetProto)).toBe('EXPIRED');
  });

  it('시장가치 지수가 임계값 이상이면 INTEREST(태그·평점 신호 없이도)', () => {
    // base 자체가 index 7235 ≥ interest.minIndexCenti(7000), squadRole ROTATION(평점 조건 미해당),
    // 태그 없음 — 순수 지수발 INTEREST다.
    expect(base.tags).not.toContain('이적_희망');
    expect(base.season?.squadRole).not.toBe('STARTER');
    const index = computeMarketValueIndex(
      buildMarketValueInput(base, rulesetProto),
      rulesetProto.marketValueRules,
    ).indexCenti;
    expect(index).toBeGreaterThanOrEqual(rulesetProto.transferRules.interest.minIndexCenti);
    expect(judgeMarketReason(base, rulesetProto)).toBe('INTEREST');
  });

  it.each([
    { target: 6999, expected: null },
    { target: 7000, expected: 'INTEREST' as const },
  ])('시장가치 지수 $target/$expected 경계를 정확히 평가한다', ({ target, expected }) => {
    const state = stateAtMarketIndex(target);
    expect(
      computeMarketValueIndex(
        buildMarketValueInput(state, rulesetProto),
        rulesetProto.marketValueRules,
      ).indexCenti,
    ).toBe(target);
    expect(judgeMarketReason(state, rulesetProto)).toBe(expected);
  });

  // 지수발 INTEREST를 걷어내려고 baseOvr·scoutedPotential을 낮춘 공통 베이스(index 5535 < 7000).
  const lowIndexBase: CareerState = {
    ...base,
    player: {
      ...base.player,
      profile: {
        ...base.player.profile!,
        baseOvr: 35,
        scoutedPotentialMin: 30,
        scoutedPotentialMax: 45,
      },
    },
  };

  it('이적_희망 태그가 있으면 INTEREST(지수·평점과 무관)', () => {
    const state: CareerState = { ...lowIndexBase, tags: [...lowIndexBase.tags, '이적_희망'] };
    expect(judgeMarketReason(state, rulesetProto)).toBe('INTEREST');
  });

  it('STARTER이고 시즌 평균 평점이 임계값 이상이면 INTEREST', () => {
    const state: CareerState = {
      ...lowIndexBase,
      season: {
        ...lowIndexBase.season!,
        squadRole: 'STARTER',
        playerStats: {
          ...lowIndexBase.season!.playerStats,
          ratingSumTenths: 700,
          ratedMatches: 10,
        },
      },
    };
    expect(judgeMarketReason(state, rulesetProto)).toBe('INTEREST');
  });

  it('STARTER여도 평균 평점이 임계값 미만이면 INTEREST가 아니다', () => {
    const state: CareerState = {
      ...lowIndexBase,
      season: {
        ...lowIndexBase.season!,
        squadRole: 'STARTER',
        playerStats: {
          ...lowIndexBase.season!.playerStats,
          ratingSumTenths: 650,
          ratedMatches: 10,
        },
      },
    };
    expect(judgeMarketReason(state, rulesetProto)).toBeNull();
  });

  it('잔류_선언 태그가 있으면 지수·태그 신호와 무관하게 null이다(계약 잔여가 0이 아닐 때)', () => {
    const state: CareerState = { ...base, tags: [...base.tags, '이적_희망', '잔류_선언'] };
    expect(judgeMarketReason(state, rulesetProto)).toBeNull();
  });

  it('아무 신호도 없으면 null이다', () => {
    expect(judgeMarketReason(lowIndexBase, rulesetProto)).toBeNull();
  });

  it('임대 계약(LOAN)은 항상 null이다(결산은 LOAN_RETURN 경로, T-3-003)', () => {
    const state: CareerState = { ...base, contract: { ...contractOf(base), kind: 'LOAN' } };
    expect(judgeMarketReason(state, rulesetProto)).toBeNull();
  });

  it('contract가 null이면 null이다(첫 계약 경로)', () => {
    expect(judgeMarketReason({ ...base, contract: null }, rulesetProto)).toBeNull();
  });

  it('rng를 전혀 소비하지 않는다(함수 시그니처에 rng 인자·반환이 없다)', () => {
    expect(judgeMarketReason.length).toBe(2);
  });
});

// 오케스트레이터 리뷰(PR #50): season === null(결산 뒤)이면 STARTER·평점 조건을 아예 건너뛰던 버그를
// 고쳤다 — 이제 그 조건은 `seasonHistory.at(-1)`의 `squadRoleAtEnd`·`playerStats`로 판정한다.
describe('judgeMarketReason·generateMarket — 결산 뒤 상태(season null)에서도 STARTER·평점 조건에 도달한다', () => {
  const { snapshot, beforeSettlementState } = runSettledFixture();
  // 지수발 INTEREST를 걷어내(judgeMarketReason describe 블록의 lowIndexBase와 같은 방식) STARTER·평점
  // 신호만 남긴다. T-3-003 §5로 SETTLE_SEASON 자체가 openMarketAfterSettlement를 호출해 rng를
  // 소비·pending을 세팅하므로, 결산 뒤 상태(season null·seasonHistory 갱신)는 유지하되 rng·pending은
  // 그 호출 이전(beforeSettlementState) 값으로 되돌려 이 describe 블록이 자체적으로 시장을 새로
  // 생성하는 시나리오와 격리한다.
  const settledLowIndex: CareerState = {
    ...snapshot.state,
    rngState: beforeSettlementState.rngState,
    pending: null,
    player: {
      ...snapshot.state.player,
      profile: {
        ...snapshot.state.player.profile!,
        baseOvr: 35,
        scoutedPotentialMin: 30,
        scoutedPotentialMax: 45,
      },
    },
  };

  function withLastSeasonSquadRole(
    state: CareerState,
    squadRole: SquadRole,
    ratingSumTenths: number,
    ratedMatches: number,
  ): CareerState {
    const lastIndex = state.seasonHistory.length - 1;
    const seasonHistory = state.seasonHistory.map((summary, index) =>
      index === lastIndex
        ? {
            ...summary,
            result: {
              ...summary.result,
              playerStats: { ...summary.result.playerStats, ratingSumTenths, ratedMatches },
              selectionSummary: { ...summary.result.selectionSummary, squadRoleAtEnd: squadRole },
            },
          }
        : summary,
    );
    return { ...state, seasonHistory };
  }

  it('(a) squadRoleAtEnd가 STARTER·평균 평점 ≥ 임계값이면 INTEREST다 — rng 소비 0', () => {
    const state = withLastSeasonSquadRole(settledLowIndex, 'STARTER', 700, 10);
    expect(state.season).toBeNull();
    const before = state.rngState.draws;
    expect(judgeMarketReason(state, rulesetProto)).toBe('INTEREST');
    expect(state.rngState.draws).toBe(before);
  });

  it('(a) 대조군: 같은 평점이어도 squadRoleAtEnd가 RESERVE면 STARTER 조건에 걸리지 않아 null이다', () => {
    const state = withLastSeasonSquadRole(settledLowIndex, 'RESERVE', 700, 10);
    expect(judgeMarketReason(state, rulesetProto)).toBeNull();
  });

  it('(b) generateMarket의 kind 추첨이 squadRoleAtEnd 기준 kindWeightsByRole을 쓴다 — STARTER(TRANSFER 80)와 RESERVE(TRANSFER 20)는 같은 rng에서도 kind 분포가 다르다', () => {
    const starterState = withLastSeasonSquadRole(settledLowIndex, 'STARTER', 700, 10);
    const reserveState = withLastSeasonSquadRole(settledLowIndex, 'RESERVE', 700, 10);
    expect(starterState.rngState).toEqual(reserveState.rngState);

    const starterResult = generateMarket({
      state: { ...starterState, tags: ['이적_희망'] },
      ruleset: marketFixtureRuleset,
      reason: 'INTEREST',
      revision: 50,
      rng: starterState.rngState,
    });
    const reserveResult = generateMarket({
      state: { ...reserveState, tags: ['이적_희망'] },
      ruleset: marketFixtureRuleset,
      reason: 'INTEREST',
      revision: 50,
      rng: reserveState.rngState,
    });

    const starterKinds = starterResult.pending.offers.slice(1).map((offer) => offer.kind);
    const reserveKinds = reserveResult.pending.offers.slice(1).map((offer) => offer.kind);
    expect(starterKinds).toEqual(['LOAN', 'TRANSFER', 'TRANSFER']);
    expect(reserveKinds).toEqual(['LOAN', 'LOAN', 'LOAN']);
  });
});

describe('generateMarket', () => {
  const { snapshot } = runSettledFixture();
  const settled = snapshot.state; // season === null(결산 뒤) — 골든 3종과 같은 베이스.

  it('(a) 안전 잔류 제안은 항상 index 0이고 validUntilRevision null·negotiable 전부 false, market.safeOfferId와 id가 같다', () => {
    const expiredState: CareerState = {
      ...settled,
      tags: [],
      contract: { ...contractOf(settled), lengthSeasons: 1 },
    };
    const expired = generateMarket({
      state: expiredState,
      ruleset: marketFixtureRuleset,
      reason: 'EXPIRED',
      revision: 30,
      rng: expiredState.rngState,
    });
    const interestState: CareerState = { ...settled, tags: ['이적_희망'] };
    const interest = generateMarket({
      state: interestState,
      ruleset: marketFixtureRuleset,
      reason: 'INTEREST',
      revision: 30,
      rng: interestState.rngState,
    });

    for (const generated of [expired, interest]) {
      const safeOffer = generated.pending.offers[0]!;
      expect(safeOffer.id).toBe('OFR-30-0');
      expect(generated.pending.market.safeOfferId).toBe(safeOffer.id);
      expect(safeOffer.kind).toBe('RENEWAL');
      expect(safeOffer.validUntilRevision).toBeNull();
      expect(safeOffer.negotiable).toEqual({ wage: false, role: false, length: false });
      expect(safeOffer.competitorSummary).toBeNull();
      expect(safeOffer.transferFeeMinor).toBeNull();
      expect(safeOffer.loan).toBeNull();
    }
  });

  it('(b) 제안 수 = clamp(1 + interest + agent, 1, 4) — 후보가 충분하면 그대로 나온다', () => {
    // EXPIRED·태그 없음: interest=0(reason이 INTEREST가 아니다)·agent=0 → 1.
    const none: CareerState = {
      ...settled,
      tags: [],
      contract: { ...contractOf(settled), lengthSeasons: 1 },
    };
    const noneResult = generateMarket({
      state: none,
      ruleset: marketFixtureRuleset,
      reason: 'EXPIRED',
      revision: 40,
      rng: none.rngState,
    });
    expect(noneResult.pending.offers).toHaveLength(1 + 1);

    // INTEREST·태그 없음: interest=1(reason만으로)·agent=0 → 2.
    const reasonOnly: CareerState = { ...settled, tags: [] };
    const reasonOnlyResult = generateMarket({
      state: reasonOnly,
      ruleset: marketFixtureRuleset,
      reason: 'INTEREST',
      revision: 40,
      rng: reasonOnly.rngState,
    });
    expect(reasonOnlyResult.pending.offers).toHaveLength(2 + 1);

    // 이적_희망: interest=2·agent=0 → 3.
    const wantsMove: CareerState = { ...settled, tags: ['이적_희망'] };
    const wantsMoveResult = generateMarket({
      state: wantsMove,
      ruleset: marketFixtureRuleset,
      reason: 'INTEREST',
      revision: 40,
      rng: wantsMove.rngState,
    });
    expect(wantsMoveResult.pending.offers).toHaveLength(3 + 1);

    // 이적_희망 + 에이전트_계약: interest=2·agent=1 → 4(상한).
    const both: CareerState = { ...settled, tags: ['이적_희망', '에이전트_계약'] };
    const bothResult = generateMarket({
      state: both,
      ruleset: marketFixtureRuleset,
      reason: 'INTEREST',
      revision: 40,
      rng: both.rngState,
    });
    expect(bothResult.pending.offers).toHaveLength(4 + 1);
  });

  it('(b) 후보가 모자라면 desiredCount 대신 후보 수만큼만 나온다', () => {
    // rulesetProto(도메인 골든 9종이 공유하는 3팀짜리 룰셋)로 계산한 지수(7270)는 밴드
    // "<=7499"(tiers [1,2])에 속한다 — 현 구단(seoul-tier1, tier1) 제외하면 이 밴드에 맞는 팀은
    // busan-tier2(tier2) 1개뿐(daejeon-tier3은 tier3라 밴드 밖). desiredCount 4를 요청해도 1로
    // 줄어든다.
    const both: CareerState = { ...settled, tags: ['이적_희망', '에이전트_계약'] };
    const result = generateMarket({
      state: both,
      ruleset: rulesetProto,
      reason: 'INTEREST',
      revision: 40,
      rng: both.rngState,
    });
    expect(result.pending.offers).toHaveLength(1 + 1);
    expect(result.pending.offers[1]!.teamId).toBe('busan-tier2');
  });

  it('(c) 후보 구단은 현 구단·YOUTH를 제외하고 demandBands 4개 각각 적어도 1팀에 도달한다(8팀 풀)', () => {
    const bandScenarios: Array<{
      label: string;
      baseOvr: number;
      scoutedMin: number;
      scoutedMax: number;
      form: number;
      leagueTier: 1 | 2 | 3;
      expectedTiers: number[];
    }> = [
      {
        label: 'band1(<=3499)→tier3만',
        baseOvr: 10,
        scoutedMin: 5,
        scoutedMax: 15,
        form: 0,
        leagueTier: 3,
        expectedTiers: [3],
      },
      {
        label: 'band2(3500-5499)→tier2·3',
        baseOvr: 10,
        scoutedMin: 5,
        scoutedMax: 20,
        form: 50,
        leagueTier: 1,
        expectedTiers: [2, 3],
      },
      {
        label: 'band3(5500-7499)→tier1·2',
        baseOvr: 35,
        scoutedMin: 30,
        scoutedMax: 45,
        form: 50,
        leagueTier: 1,
        expectedTiers: [1, 2],
      },
      {
        label: 'band4(7500-10000)→tier1·2',
        baseOvr: 75,
        scoutedMin: 70,
        scoutedMax: 85,
        form: 50,
        leagueTier: 1,
        expectedTiers: [1, 2],
      },
    ];

    for (const scenario of bandScenarios) {
      const state: CareerState = {
        ...settled,
        tags: ['이적_희망', '에이전트_계약'],
        state: { ...settled.state, form: scenario.form },
        player: {
          ...settled.player,
          profile: {
            ...settled.player.profile!,
            baseOvr: scenario.baseOvr,
            scoutedPotentialMin: scenario.scoutedMin,
            scoutedPotentialMax: scenario.scoutedMax,
          },
        },
        contract: { ...contractOf(settled), leagueTier: scenario.leagueTier },
      };
      const result = generateMarket({
        state,
        ruleset: marketFixtureRuleset,
        reason: 'INTEREST',
        revision: 50,
        rng: state.rngState,
      });
      const drawnTeamIds = result.pending.offers.slice(1).map((offer) => offer.teamId);
      expect(drawnTeamIds.length).toBeGreaterThan(0);
      expect(drawnTeamIds).not.toContain(state.contract!.teamId);
      for (const offer of result.pending.offers.slice(1)) {
        expect(offer.leagueTier).not.toBe('YOUTH');
        expect(scenario.expectedTiers).toContain(offer.leagueTier);
      }
    }
  });

  it('(d) EXPIRED면 전부 FREE_AGENT다', () => {
    const state: CareerState = {
      ...settled,
      tags: ['이적_희망', '에이전트_계약'],
      contract: { ...contractOf(settled), lengthSeasons: 1 },
    };
    const result = generateMarket({
      state,
      ruleset: marketFixtureRuleset,
      reason: 'EXPIRED',
      revision: 60,
      rng: state.rngState,
    });
    for (const offer of result.pending.offers.slice(1)) {
      expect(offer.kind).toBe('FREE_AGENT');
    }
  });

  it('(d) INTEREST면 역할별 TRANSFER/LOAN 가중이 결정론적으로 갈리고(같은 시드 반복), 다른 시드에서는 두 종류가 다 나온다', () => {
    const state: CareerState = {
      ...settled,
      tags: ['이적_희망', '에이전트_계약'],
      contract: { ...contractOf(settled), rolePromise: 'STARTER' },
    };
    const first = generateMarket({
      state,
      ruleset: marketFixtureRuleset,
      reason: 'INTEREST',
      revision: 70,
      rng: state.rngState,
    });
    const second = generateMarket({
      state,
      ruleset: marketFixtureRuleset,
      reason: 'INTEREST',
      revision: 70,
      rng: state.rngState,
    });
    expect(second.pending.offers).toEqual(first.pending.offers);

    const kinds = new Set<string>();
    for (let seed = 0; seed < 10; seed++) {
      const seeded: CareerState = {
        ...state,
        rngState: seedRng(`market-kind-distribution-${seed}`),
      };
      const result = generateMarket({
        state: seeded,
        ruleset: marketFixtureRuleset,
        reason: 'INTEREST',
        revision: 70,
        rng: seeded.rngState,
      });
      for (const offer of result.pending.offers.slice(1)) kinds.add(offer.kind);
    }
    expect(kinds.has('TRANSFER')).toBe(true);
    expect(kinds.has('LOAN')).toBe(true);
  });

  it('(e) LOAN 제안은 loan·lengthSeasons 1을 갖고, TRANSFER 제안은 지수 밴드의 feeMinor를 담는다', () => {
    const state: CareerState = {
      ...settled,
      tags: ['이적_희망', '에이전트_계약'],
      contract: { ...contractOf(settled), rolePromise: 'BENCH' },
    };
    const result = generateMarket({
      state,
      ruleset: marketFixtureRuleset,
      reason: 'INTEREST',
      revision: 80,
      rng: state.rngState,
    });
    const drawn = result.pending.offers.slice(1);
    expect(drawn.some((offer) => offer.kind === 'LOAN')).toBe(true);
    for (const offer of drawn) {
      if (offer.kind === 'LOAN') {
        expect(offer.lengthSeasons).toBe(1);
        expect(offer.loan).toEqual({
          parentTeamId: state.contract!.teamId,
          seasons: 1,
          wageShareBp: marketFixtureRuleset.transferRules.loan.wageShareBp,
          buyOptionMinor: offer.loan!.buyOptionMinor,
        });
        expect(offer.transferFeeMinor).toBeNull();
      }
      if (offer.kind === 'TRANSFER') {
        expect(offer.loan).toBeNull();
        const indexCenti = computeMarketValueIndex(
          buildMarketValueInput(state, marketFixtureRuleset),
          marketFixtureRuleset.marketValueRules,
        ).indexCenti;
        const band = marketFixtureRuleset.transferRules.feeByIndexBand.find(
          (candidate) => indexCenti <= candidate.maxIndexCenti,
        )!;
        expect(offer.transferFeeMinor).toBe(band.feeMinor);
      }
    }
  });

  it('(f) 추첨 제안의 validUntilRevision = revision + offerValidityRevisions', () => {
    const state: CareerState = { ...settled, tags: ['이적_희망'] };
    const revision = 123;
    const result = generateMarket({
      state,
      ruleset: marketFixtureRuleset,
      reason: 'INTEREST',
      revision,
      rng: state.rngState,
    });
    for (const offer of result.pending.offers.slice(1)) {
      expect(offer.validUntilRevision).toBe(
        revision + marketFixtureRuleset.transferRules.offerValidityRevisions,
      );
    }
  });

  it('(g) competitorSummary는 파생 시드로 계산되어 결정 스트림 draws를 늘리지 않는다', () => {
    // FREE_AGENT(EXPIRED)는 제안당 정확히 5draws(팀·기간·역할·등번호·적합도, 종류 roll 없음)를 쓴다 —
    // competitorSummary가 이 스트림을 썼다면 이보다 늘어난다.
    const state: CareerState = {
      ...settled,
      tags: [],
      contract: { ...contractOf(settled), lengthSeasons: 1 },
    };
    const before = state.rngState.draws;
    const result = generateMarket({
      state,
      ruleset: marketFixtureRuleset,
      reason: 'EXPIRED',
      revision: 90,
      rng: state.rngState,
    });
    const drawnCount = result.pending.offers.length - 1;
    expect(result.rngState.draws - before).toBe(drawnCount * 5);
    expect(result.pending.offers.slice(1).every((offer) => offer.competitorSummary !== null)).toBe(
      true,
    );
  });

  it('(h) rng 소비 순서: 제안당 draws 증가량 — EXPIRED(FREE_AGENT) 5, TRANSFER 6, LOAN 6', () => {
    // 팀(1) → 종류(1, EXPIRED면 생략) → (LOAN이면 바이아웃 1) → 기간(1, LOAN이면 생략) → 역할(1) →
    // 등번호(1) → 적합도(1). EXPIRED: 5(팀·기간·역할·등번호·적합도). TRANSFER: 6(+종류). LOAN: 6(종류
    // 대신 바이아웃, 기간 생략 — 순증감 0).
    const expiredState: CareerState = {
      ...settled,
      tags: [],
      contract: { ...contractOf(settled), lengthSeasons: 1 },
    };
    const expired = generateMarket({
      state: expiredState,
      ruleset: marketFixtureRuleset,
      reason: 'EXPIRED',
      revision: 100,
      rng: expiredState.rngState,
    });
    expect(expired.rngState.draws - expiredState.rngState.draws).toBe(
      (expired.pending.offers.length - 1) * 5,
    );

    const interestState: CareerState = { ...settled, tags: ['이적_희망', '에이전트_계약'] };
    const interest = generateMarket({
      state: interestState,
      ruleset: marketFixtureRuleset,
      reason: 'INTEREST',
      revision: 100,
      rng: interestState.rngState,
    });
    expect(interest.rngState.draws - interestState.rngState.draws).toBe(
      (interest.pending.offers.length - 1) * 6,
    );
  });

  it('market.openedAtRevision·seasonIndex·reason·safeOfferId이 정확하다', () => {
    const state: CareerState = { ...settled, tags: ['이적_희망'] };
    const result = generateMarket({
      state,
      ruleset: marketFixtureRuleset,
      reason: 'INTEREST',
      revision: 111,
      rng: state.rngState,
    });
    expect(result.pending.market).toEqual({
      openedAtRevision: 111,
      seasonIndex: state.seasonHistory.length,
      reason: 'INTEREST',
      safeOfferId: result.pending.offers[0]!.id,
    });
  });
});

describe('buildRenewalOffer', () => {
  const { beforeSettlementState: base } = runSettledFixture();

  it('현 구단 RENEWAL을 rng 없이 만든다 — 급여·보너스·기간·역할·유효기간·negotiable', () => {
    const offer = buildRenewalOffer(base, rulesetProto, 20);
    const contract = contractOf(base);
    expect(offer.id).toBe('OFR-20-0');
    expect(offer.kind).toBe('RENEWAL');
    expect(offer.teamId).toBe(contract.teamId);
    expect(offer.fromTeamId).toBe(contract.teamId);
    expect(offer.lengthSeasons).toBe(rulesetProto.transferRules.renewal.lengthSeasons);
    expect(offer.rolePromise).toBe(base.season!.squadRole);
    expect(offer.appearancePromise).toEqual({
      minutesShareBp: rulesetProto.contractRules.promiseMinutesShareBp[base.season!.squadRole],
    });
    expect(offer.positionPlan).toBe(contract.positionPlan);
    expect(offer.shirtNumber).toBe(contract.shirtNumber);
    expect(offer.tacticalFitEstimate).toBe(base.context.tacticalFit);
    expect(offer.competitorSummary).toBeNull();
    expect(offer.transferFeeMinor).toBeNull();
    expect(offer.loan).toBeNull();
    expect(offer.validUntilRevision).toBe(20 + rulesetProto.transferRules.offerValidityRevisions);
    expect(offer.negotiable).toEqual({ wage: true, role: false, length: true });
    expect(offer.negotiationState).toBe('OPEN');
    expect(offer.negotiatedAsk).toBeNull();
  });

  it('같은 입력이면 항상 같은 결과다(rng 소비 없음 — 시그니처에 rng가 없다)', () => {
    expect(buildRenewalOffer.length).toBe(3);
    const a = buildRenewalOffer(base, rulesetProto, 20);
    const b = buildRenewalOffer(base, rulesetProto, 20);
    expect(a).toEqual(b);
  });

  it('season이 없으면 throw한다(step 7은 시즌 진행 중에만 연다)', () => {
    expect(() => buildRenewalOffer({ ...base, season: null }, rulesetProto, 20)).toThrow(
      RangeError,
    );
  });

  it('contract가 없으면 throw한다', () => {
    expect(() => buildRenewalOffer({ ...base, contract: null }, rulesetProto, 20)).toThrow(
      RangeError,
    );
  });
});

describe('bounded career recovery policy', () => {
  it('an expired over-age youth market contains no youth renewal and leads with an adult free-agent route', () => {
    const settledState = runSettledFixture().snapshot.state;
    const youth = marketFixtureRuleset.teams.find((team) => team.leagueTier === 'YOUTH')!;
    const state: CareerState = {
      ...settledState,
      age: 19,
      pending: null,
      contract: {
        ...settledState.contract!,
        teamId: youth.id,
        teamName: youth.name,
        leagueTier: 'YOUTH',
        lengthSeasons: 1,
      },
    };
    const ruleset = {
      ...marketFixtureRuleset,
      transferRules: {
        ...marketFixtureRuleset.transferRules,
        recovery: {
          youthMaxAge: 18,
          zeroMinutesConsecutiveSeasons: 2,
          opportunityTier: 3 as const,
          opportunityRole: 'ROTATION' as const,
        },
      },
    };
    const result = generateMarket({
      state,
      ruleset,
      reason: 'EXPIRED',
      revision: 119,
      rng: state.rngState,
    });
    expect(result.pending.offers[0]).toMatchObject({
      kind: 'FREE_AGENT',
      leagueTier: 3,
      fromTeamId: null,
    });
    expect(
      result.pending.offers.some(
        (offer) => offer.kind === 'RENEWAL' && offer.leagueTier === 'YOUTH',
      ),
    ).toBe(false);
  });

  it('two consecutive zero-minute seasons add a tier-3 opportunity without removing the safe option or guaranteeing minutes', () => {
    const settledState = runSettledFixture().snapshot.state;
    const zero = {
      ...settledState.seasonHistory.at(-1)!,
      result: {
        ...settledState.seasonHistory.at(-1)!.result,
        playerStats: { ...settledState.seasonHistory.at(-1)!.result.playerStats, minutes: 0 },
      },
    };
    const state: CareerState = {
      ...settledState,
      pending: null,
      seasonHistory: [zero, { ...zero, index: zero.index + 1 }],
    };
    const ruleset = {
      ...marketFixtureRuleset,
      transferRules: {
        ...marketFixtureRuleset.transferRules,
        recovery: {
          youthMaxAge: 18,
          zeroMinutesConsecutiveSeasons: 2,
          opportunityTier: 3 as const,
          opportunityRole: 'ROTATION' as const,
        },
      },
    };
    const result = generateMarket({
      state,
      ruleset,
      reason: 'INTEREST',
      revision: 120,
      rng: state.rngState,
    });
    expect(result.pending.offers[0]!.teamId).toBe(state.contract!.teamId);
    expect(result.pending.offers[1]).toMatchObject({
      kind: 'LOAN',
      leagueTier: 3,
      rolePromise: 'ROTATION',
      fromTeamId: state.contract!.teamId,
    });
    expect(result.pending.offers[1]!.appearancePromise.minutesShareBp).toBe(
      ruleset.contractRules.promiseMinutesShareBp.ROTATION,
    );
  });

  // T-7-002 D-67(이슈 #140): recovery.zeroMinutesConsecutiveSeasons는 이미 데이터로만 읽힌다
  // (hasConsecutiveZeroMinuteSeasons/needsRecoveryOpportunity, market.ts 코드 변경 없음) — 룰셋
  // 1.4.0(=1)과 1.3.0(=2)이 실제로 다른 문턱에서 회복 트리거를 여는지만 테스트로 고정한다.
  // index발·평점발 INTEREST를 걷어내려고(judgeMarketReason describe 블록의 lowIndexBase와 같은
  // 방식) baseOvr·scoutedPotential을 낮추고, squadRoleAtEnd는 원본 그대로 ROTATION(STARTER
  // 아님)을 유지한다 — 순수하게 회복 트리거 하나만으로 INTEREST가 나오는지 본다.
  describe('T-7-002 D-67: zeroMinutesConsecutiveSeasons 문턱(1.4.0=1, 1.3.0=2)', () => {
    const { snapshot, beforeSettlementState } = runSettledFixture();
    const settledLowIndex: CareerState = {
      ...snapshot.state,
      rngState: beforeSettlementState.rngState,
      pending: null,
      player: {
        ...snapshot.state.player,
        profile: {
          ...snapshot.state.player.profile!,
          baseOvr: 35,
          scoutedPotentialMin: 30,
          scoutedPotentialMax: 45,
        },
      },
    };
    const zeroMinuteLastSeason = {
      ...settledLowIndex.seasonHistory.at(-1)!,
      result: {
        ...settledLowIndex.seasonHistory.at(-1)!.result,
        playerStats: { ...settledLowIndex.seasonHistory.at(-1)!.result.playerStats, minutes: 0 },
      },
    };
    const oneZeroMinuteSeasonState: CareerState = {
      ...settledLowIndex,
      seasonHistory: [zeroMinuteLastSeason],
    };

    function rulesetWithRecovery(zeroMinutesConsecutiveSeasons: number) {
      return {
        ...marketFixtureRuleset,
        transferRules: {
          ...marketFixtureRuleset.transferRules,
          recovery: {
            youthMaxAge: 18,
            zeroMinutesConsecutiveSeasons,
            opportunityTier: 3 as const,
            opportunityRole: 'ROTATION' as const,
          },
        },
      };
    }

    it('1.4.0(zeroMinutesConsecutiveSeasons: 1): 0분 시즌 1회만으로 judgeMarketReason이 INTEREST고, 결산 시장에 회복 제안이 들어간다', () => {
      const ruleset = rulesetWithRecovery(1);
      expect(judgeMarketReason(oneZeroMinuteSeasonState, ruleset)).toBe('INTEREST');
      const result = openMarketAfterSettlement(oneZeroMinuteSeasonState, ruleset, 130);
      expect(result.opened).toBe(true);
      if (result.state.pending?.kind !== 'OFFERS') throw new Error('OFFERS pending이 아니다.');
      expect(result.state.pending.market.reason).toBe('INTEREST');
      expect(
        result.state.pending.offers.some(
          (offer) =>
            offer.leagueTier === 3 &&
            offer.rolePromise === 'ROTATION' &&
            offer.fromTeamId === oneZeroMinuteSeasonState.contract!.teamId,
        ),
      ).toBe(true);
    });

    it('1.3.0(zeroMinutesConsecutiveSeasons: 2): 0분 시즌 1회로는 회복 트리거 미달이라 null이다(다른 신호도 없음)', () => {
      const ruleset = rulesetWithRecovery(2);
      expect(judgeMarketReason(oneZeroMinuteSeasonState, ruleset)).toBeNull();
    });
  });
});

describe('step 7 CONTRACT 슬롯(season.ts의 selectOpenSlot) 통합', () => {
  const { beforeSettlementState: base } = runSettledFixture();
  const contractStep: SeasonStep = {
    index: 7,
    phase: 'LEAGUE',
    windowOpen: true,
    decisionSlots: [{ kind: 'CONTRACT', required: false }],
    summary: null,
  };
  const rng = seedRng('market-test-select-open-slot-contract');

  it('계약 마지막 시즌이면 RENEWAL 제안 1건을 연다', () => {
    const lastSeason: CareerState = {
      ...base,
      contract: { ...contractOf(base), lengthSeasons: 1 },
    };
    const result = selectOpenSlot(
      contractStep,
      'FAST',
      [],
      rng,
      null,
      null,
      20,
      1,
      lastSeason,
      rulesetProto,
    );
    expect(result.opened).toBe(true);
    if (result.opened && result.pending?.kind === 'CONTRACT') {
      expect(result.pending.offers).toHaveLength(1);
      expect(result.pending.offers[0]!.kind).toBe('RENEWAL');
      expect(result.pending.market.reason).toBe('PRE_NEGOTIATION');
    } else {
      throw new Error('CONTRACT pending이 아니다.');
    }
  });

  it('계약 잔여 시즌이 있으면 offers: []로 자동 통과 대상만 연다', () => {
    const result = selectOpenSlot(
      contractStep,
      'FAST',
      [],
      rng,
      null,
      null,
      20,
      1,
      base,
      rulesetProto,
    );
    expect(result.opened).toBe(true);
    if (result.opened && result.pending?.kind === 'CONTRACT') {
      expect(result.pending.offers).toEqual([]);
    } else {
      throw new Error('CONTRACT pending이 아니다.');
    }
  });

  it('임대 계약이면 마지막 시즌이어도 RENEWAL을 열지 않는다', () => {
    const loanLastSeason: CareerState = {
      ...base,
      contract: { ...contractOf(base), kind: 'LOAN', lengthSeasons: 1 },
    };
    const result = selectOpenSlot(
      contractStep,
      'FAST',
      [],
      rng,
      null,
      null,
      20,
      1,
      loanLastSeason,
      rulesetProto,
    );
    expect(result.opened).toBe(true);
    if (result.opened && result.pending?.kind === 'CONTRACT') {
      expect(result.pending.offers).toEqual([]);
    } else {
      throw new Error('CONTRACT pending이 아니다.');
    }
  });

  // 이슈 #147: 1시즌 첫 계약은 서명 직후 START_SEASON이 SEASON_STARTED를 남기는 순간 잔여 0(= "현재
  // 시즌 뒤에 남은 시즌")이 되어, 시즌 1 step 7에 한 경기도 뛰지 않았어도 사전 협상이 열린다(운영 QA
  // WG S1 "남은 계약 0시즌"). 잔여 계산은 오류가 아니라 정의가 그렇다 — 1.4.0 키
  // `contractRules.renewalWindow.minMatchesPlayed`로 "이번 계약에서 N경기 소화" 조건을 더한다.
  describe('이슈 #147: 재계약 사전 협상 창(1.4.0 renewalWindow 키 가드)', () => {
    const RULESET_1_4_0 = {
      ...rulesetProto,
      contractRules: { ...rulesetProto.contractRules, renewalWindow: { minMatchesPlayed: 3 } },
    };

    /** 1시즌 계약·이번 계약(=이번 시즌)에서 `played`경기(1분 이상) 뛴 상태. */
    function lastSeasonWithMatchesPlayed(played: number): CareerState {
      const season = base.season!;
      const stats = season.playerStats;
      return {
        ...base,
        seasonHistory: [],
        contract: { ...contractOf(base), lengthSeasons: 1 },
        season: {
          ...season,
          playerStats: {
            ...stats,
            appearances: { total: played, started: played, sub: 0, zeroMinute: 0, out: 0 },
            minutes: played * 60,
          },
        },
      };
    }

    function openedOffers(state: CareerState, ruleset: typeof rulesetProto) {
      const result = selectOpenSlot(
        contractStep,
        'FAST',
        [],
        rng,
        null,
        null,
        20,
        1,
        state,
        ruleset,
      );
      if (!(result.opened && result.pending?.kind === 'CONTRACT'))
        throw new Error('CONTRACT pending이 아니다.');
      return result.pending.offers;
    }

    it('재현(키 없음): 한 경기도 뛰지 않은 마지막 시즌 계약에도 step 7 RENEWAL이 열린다', () => {
      expect(isRenewalWindowOpen(lastSeasonWithMatchesPlayed(0), rulesetProto)).toBe(true);
      expect(openedOffers(lastSeasonWithMatchesPlayed(0), rulesetProto)).toHaveLength(1);
    });

    it('1.4.0(minMatchesPlayed 3): 2경기까지는 offers: []로 자동 통과, 3경기부터 RENEWAL이 열린다', () => {
      expect(openedOffers(lastSeasonWithMatchesPlayed(2), RULESET_1_4_0)).toEqual([]);
      const offers = openedOffers(lastSeasonWithMatchesPlayed(3), RULESET_1_4_0);
      expect(offers).toHaveLength(1);
      expect(offers[0]!.kind).toBe('RENEWAL');
    });

    it('0분 경기(결장·미사용 교체)는 소화 경기로 세지 않는다', () => {
      const zeroMinute = lastSeasonWithMatchesPlayed(3);
      const state: CareerState = {
        ...zeroMinute,
        season: {
          ...zeroMinute.season!,
          playerStats: {
            ...zeroMinute.season!.playerStats,
            appearances: { total: 5, started: 2, sub: 1, zeroMinute: 3, out: 2 },
          },
        },
      };
      expect(countContractMatchesPlayed(state, contractOf(state))).toBe(2);
      expect(openedOffers(state, RULESET_1_4_0)).toEqual([]);
    });

    it('이번 계약 누계: 서명 시즌 이후 같은 구단 결산 시즌은 더하고, 임대(다른 구단) 시즌·서명 전 시즌은 뺀다', () => {
      const current = lastSeasonWithMatchesPlayed(1);
      const contract = { ...contractOf(current), signedSeasonIndex: 2 };
      const settled = runSettledFixture().snapshot.state.seasonHistory[0]!;
      const summaryWith = (index: number, teamId: string, played: number) => ({
        ...settled,
        index,
        teamId,
        result: {
          ...settled.result,
          playerStats: {
            ...settled.result.playerStats,
            appearances: { total: played + 1, started: played, sub: 0, zeroMinute: 1, out: 1 },
          },
        },
      });
      const state: CareerState = {
        ...current,
        contract,
        seasonHistory: [
          summaryWith(1, contract.teamId, 10), // 서명 전 시즌(index 1 < signedSeasonIndex 2)
          summaryWith(2, contract.teamId, 4), // 이번 계약 첫 시즌
          summaryWith(3, 'other-club', 20), // 임대 시즌
        ],
      };
      expect(countContractMatchesPlayed(state, contract)).toBe(4 + 1);
    });
  });
});

describe('step 7 CONTRACT 응답 필수 통합(simulate.ts의 ADVANCE) — career-04-gk 골든', () => {
  it('마지막 시즌 계약의 step 7 RENEWAL 제안은 더 이상 ADVANCE로 자동 통과하지 않고, REJECT_OFFER(null) 응답이 OFFER_REJECTED(ALL) 타임라인을 남긴다', () => {
    // career-04-gk는 lengthSeasons 1(계약이 시즌 1의 마지막 시즌)이라 실제 전체 시즌 재생에서
    // step 7에 CONTRACT(제안 있음) pending이 열린다. T-3-003 §5로 이 pending은 더 이상 ADVANCE로
    // 자동 통과하지 않으므로(응답 필수), fixture(runGkFixture)가 REJECT_OFFER({ offerId: null })로
    // 자동 응답한다 — 이 fixture의 golden hash·revision이 이 PR에서 바뀐 이유이기도 하다.
    const { snapshot } = runGkFixture();
    const expiredEntries = snapshot.state.timeline.filter(
      (entry) => entry.kind === 'OFFER_EXPIRED',
    );
    expect(expiredEntries).toHaveLength(0);
    const rejectedAllAtStep7 = snapshot.state.timeline.filter(
      (entry) => entry.kind === 'OFFER_REJECTED' && entry.refId === 'ALL' && entry.step === 7,
    );
    expect(rejectedAllAtStep7).toHaveLength(1);
    // SETTLE_SEASON 시점에 계약 잔여가 0(EXPIRED)이라 §5 배선으로 결산 뒤 새 시장이 열린다 — step 7의
    // 재계약 제안 거절과는 별개 이벤트다.
    expect(snapshot.state.pending?.kind).toBe('OFFERS');
  });

  it('계약 잔여 시즌이 있으면(career-01) step 7에서 OFFER_EXPIRED가 없다', () => {
    const snapshot = runCareerFixture();
    expect(snapshot.state.contract!.lengthSeasons).toBeGreaterThan(1);
    const expiredEntries = snapshot.state.timeline.filter(
      (entry) => entry.kind === 'OFFER_EXPIRED',
    );
    expect(expiredEntries).toHaveLength(0);
  });
});

describe('openMarketAfterSettlement', () => {
  it('사유가 null이면 상태·rng가 그대로다', () => {
    const { snapshot } = runSettledFixture();
    const state: CareerState = {
      ...snapshot.state,
      tags: [],
      player: {
        ...snapshot.state.player,
        profile: {
          ...snapshot.state.player.profile!,
          baseOvr: 35,
          scoutedPotentialMin: 30,
          scoutedPotentialMax: 45,
        },
      },
    };
    expect(judgeMarketReason(state, rulesetProto)).toBeNull();
    const result = openMarketAfterSettlement(state, rulesetProto, 20);
    expect(result.opened).toBe(false);
    expect(result.state).toBe(state);
  });

  // 결산 뒤 상태(season === null)를 그대로 받는다 — judgeMarketReason의 STARTER·평점 분기는
  // season이 없어 건너뛰지만, 태그·계약 잔여·시장가치 지수 판정은 그대로 동작한다.
  it('사유가 있으면 pending.kind === "OFFERS"다(nextActionForPending 기준 DECISION)', () => {
    const { snapshot } = runSettledFixture();
    expect(snapshot.state.season).toBeNull();
    const state: CareerState = { ...snapshot.state, tags: ['이적_희망'] };
    const result = openMarketAfterSettlement(state, rulesetProto, 20);
    expect(result.opened).toBe(true);
    expect(result.state.pending?.kind).toBe('OFFERS');
    expect(result.state.rngState.draws).toBeGreaterThan(state.rngState.draws);

    // 면담이 없는 기존 경로는 같은 입력의 pending·RNG를 그대로 유지한다.
    const unchanged = openMarketAfterSettlement({ ...state }, rulesetProto, 20);
    expect(unchanged.state.pending).toEqual(result.state.pending);
    expect(unchanged.state.rngState).toEqual(result.state.rngState);

    const contract = contractOf(state);
    const meeting = {
      seasonIndex: state.seasonHistory.length,
      request: 'LOAN' as const,
      response: 'ACCEPTED' as const,
      reason: 'TEST',
      teamId: contract.teamId,
      contractId: contract.id,
      immediateEffect: { managerTrustDelta: -1, moraleDelta: 2 },
      plannedRole: contract.rolePromise,
      preferredOfferKind: 'LOAN' as const,
      preferenceStatus: 'PENDING' as const,
      goal: {
        seasonIndex: state.seasonHistory.length,
        role: contract.rolePromise,
        targetMinutesShareBp: contract.appearancePromise.minutesShareBp,
        status: 'PENDING' as const,
      },
    };
    const preferred = openMarketAfterSettlement(
      { ...state, clubMeeting: meeting },
      rulesetProto,
      20,
    );
    expect(preferred.state.clubMeeting?.preferenceStatus).toBe('OFFERED');
    const preferredPending = preferred.state.pending;
    if (preferredPending?.kind !== 'OFFERS')
      throw new Error('setup: preferred market가 열리지 않았다');
    const requested = preferredPending.offers.find(
      (offer) => offer.id !== preferredPending.market.safeOfferId,
    );
    expect(requested?.kind).toBe('LOAN');

    const noCandidateRules = {
      ...rulesetProto,
      teams: rulesetProto.teams.filter((team) => team.id === contract.teamId),
    };
    const noCandidate = openMarketAfterSettlement(
      { ...state, clubMeeting: meeting },
      noCandidateRules,
      20,
    );
    expect(noCandidate.state.clubMeeting?.preferenceStatus).toBe('NO_CANDIDATE');

    const expiredContract = { ...contract, lengthSeasons: 1 };
    const expired = openMarketAfterSettlement(
      {
        ...state,
        contract: expiredContract,
        clubMeeting: { ...meeting, contractId: expiredContract.id },
      },
      rulesetProto,
      20,
    );
    expect(expired.state.clubMeeting?.preferenceStatus).toBe('CANCELLED');
  });
});

it('overseas offers require experience and intent; returning home removes foreign candidates', () => {
  const source = runSettledFixture().snapshot.state;
  const candidate = generateMarket({
    state: source,
    ruleset: rulesetProto,
    reason: 'EXPIRED',
    revision: 999,
    rng: seedRng('candidate'),
  }).pending.offers.find((o) => o.teamId !== source.contract!.teamId)!;
  const foreign = {
    ...rulesetProto.teams.find((t) => t.id === candidate.teamId)!,
    id: 'foreign-test',
    countryCode: 'JP',
    name: 'Overseas Test',
  };
  const ruleset = { ...rulesetProto, teams: [...rulesetProto.teams, foreign] };
  const experienced = {
    ...source,
    seasonHistory: [source.seasonHistory[0]!, source.seasonHistory[0]!],
  };
  const offers = (state: CareerState) =>
    generateMarket({
      state,
      ruleset,
      reason: 'INTEREST',
      revision: 999,
      rng: seedRng('overseas-test'),
    }).pending.offers;
  expect(
    offers({ ...experienced, tags: ['해외_도전', '이적_희망'] }).some(
      (o) => o.teamId === foreign.id,
    ),
  ).toBe(true);
  expect(offers({ ...experienced, tags: ['이적_희망'] }).some((o) => o.teamId === foreign.id)).toBe(
    false,
  );
  expect(
    offers({ ...source, tags: ['해외_도전', '이적_희망'] }).some((o) => o.teamId === foreign.id),
  ).toBe(false);
});

it('does not open a new market after the final season of a bounded journey', () => {
  const source = runSettledFixture().snapshot.state;
  const state = {
    ...source,
    pending: null,
    seasonHistory: Array.from({ length: 12 }, () => source.seasonHistory[0]!),
  };
  expect(
    openMarketAfterSettlement(
      state,
      {
        ...rulesetProto,
        retirementRules: { ...rulesetProto.retirementRules!, maxCareerSeasons: 12 },
      },
      999,
    ),
  ).toEqual({ state, opened: false });
});
