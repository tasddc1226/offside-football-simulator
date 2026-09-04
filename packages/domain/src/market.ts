import { clamp } from './clamp.js';
import { compareCodePoints } from './canonical.js';
import { generateCompetitors } from './competitors.js';
import { computeContractSeasonsRemaining, computeMarketValueIndex, buildMarketValueInput } from './market-value.js';
import { findOvrBand, lookupBandAmount } from './offers.js';
import { rollInt, seedRng, type RngState } from './rng.js';
import { rollRange } from './roll-range.js';
import type { Ruleset, Team, TransferRules } from './ruleset.js';
import type { CareerState, Contract, Offer, OfferKind, Pending, Position, SquadRole } from './types.js';

/**
 * T-3-002 D-43: 결산 직전 상태(`state.season !== null`, step 12, `SETTLE_SEASON` 처리 중)를 입력으로
 * 받는다. `season`이 없으면(결산 뒤 상태 등) STARTER·평점 조건만 건너뛰고 나머지(만료·태그·시장가치
 * 지수)는 그대로 판정한다 — `openMarketAfterSettlement`가 결산 뒤 상태로 재사용할 수 있게 하는
 * 경계(season 유무)다. rng를 전혀 소비하지 않는다.
 */
export function judgeMarketReason(state: CareerState, ruleset: Ruleset): 'EXPIRED' | 'INTEREST' | null {
  const contract = state.contract;
  if (contract === null) return null;
  // 임대 계약의 결산은 LOAN_RETURN 경로(T-3-003)다 — 호출자가 먼저 갈라야 하지만, 방어적으로도 null.
  if (contract.kind === 'LOAN') return null;

  const remaining = computeContractSeasonsRemaining(contract.lengthSeasons, contract.signedAtRevision, state.timeline);
  if (remaining === 0) return 'EXPIRED';

  if (state.tags.includes('잔류_선언')) return null;
  if (state.tags.includes('이적_희망')) return 'INTEREST';

  const season = state.season;
  if (season !== null && season.squadRole === 'STARTER') {
    const stats = season.playerStats;
    const avgRatingTenths = stats.ratedMatches > 0 ? Math.round(stats.ratingSumTenths / stats.ratedMatches) : 0;
    if (avgRatingTenths >= ruleset.transferRules.interest.minRatingTenths) return 'INTEREST';
  }

  const indexCenti = computeMarketValueIndex(buildMarketValueInput(state, ruleset), ruleset.marketValueRules).indexCenti;
  if (indexCenti >= ruleset.transferRules.interest.minIndexCenti) return 'INTEREST';

  return null;
}

const ROLE_DEGRADE: Record<SquadRole, SquadRole> = {
  STARTER: 'ROTATION',
  ROTATION: 'BENCH',
  BENCH: 'RESERVE',
  RESERVE: 'RESERVE',
};

/** 현재 "squadRole"의 원천. 시즌이 있으면 실제 시즌 성적(`season.squadRole`), 없으면(결산 뒤) 계약의 약속 역할. */
function currentSquadRole(state: CareerState, contract: Contract): SquadRole {
  return state.season?.squadRole ?? contract.rolePromise;
}

function findTeamById(ruleset: Ruleset, teamId: string): Team {
  const team = ruleset.teams.find((candidate) => candidate.id === teamId);
  if (team === undefined) {
    throw new RangeError(`market.ts: 룰셋에 teamId '${teamId}'가 없다.`);
  }
  return team;
}

/**
 * D-43 후보 구단: 현 구단·YOUTH 제외, `demandBands`에서 시장가치 지수 centi가 속한 첫 밴드의 tiers에
 * 있는 팀만, id 오름차순. 후보가 0이면 밴드를 한 단계씩 넓혀(다음 밴드의 tiers를 합집합) 최소 1팀을
 * 확보한다.
 */
function computeCandidateTeams(ruleset: Ruleset, currentTeamId: string, indexCenti: number): Team[] {
  const bands = ruleset.transferRules.demandBands;
  const startIndex = bands.findIndex((band) => indexCenti <= band.maxIndexCenti);
  const firstIndex = startIndex === -1 ? bands.length - 1 : startIndex;

  const filterByTiers = (tiers: ReadonlySet<1 | 2 | 3>): Team[] =>
    ruleset.teams
      .filter((team) => team.id !== currentTeamId && team.leagueTier !== 'YOUTH' && tiers.has(team.leagueTier))
      .sort((a, b) => compareCodePoints(a.id, b.id));

  const tierSet = new Set<1 | 2 | 3>(bands[firstIndex]!.tiers);
  let candidates = filterByTiers(tierSet);
  let bandIndex = firstIndex;
  while (candidates.length === 0 && bandIndex + 1 < bands.length) {
    bandIndex += 1;
    for (const tier of bands[bandIndex]!.tiers) tierSet.add(tier);
    candidates = filterByTiers(tierSet);
  }
  return candidates;
}

function findFeeMinor(bands: TransferRules['feeByIndexBand'], indexCenti: number): number {
  const band = bands.find((candidate) => indexCenti <= candidate.maxIndexCenti);
  if (band === undefined) {
    throw new RangeError(`market.ts: feeByIndexBand에 indexCenti ${indexCenti}에 맞는 구간이 없다.`);
  }
  return band.feeMinor;
}

/**
 * D-44: 결정 스트림을 쓰지 않는 파생 시드로 T-2-002 경쟁자 생성기를 그 팀·포지션 기준 한 번 돌려
 * `rank`(선수의 예상 선발 순위, 1 = 1순위)·`ovrGap`(baseOvr − 같은 포지션 최상위 경쟁자 OVR, 음수
 * 가능)을 계산한다.
 */
function computeCompetitorSummary(
  ruleset: Ruleset,
  team: Team,
  position: Position,
  baseOvr: number,
  seed: string,
): { rank: number; ovrGap: number } {
  const generated = generateCompetitors(ruleset, team, seedRng(seed));
  const positionCompetitors = generated.competitors.filter((competitor) => competitor.position === position);
  const topOvr = positionCompetitors.reduce((max, competitor) => Math.max(max, competitor.baseOvr), 0);
  const better = positionCompetitors.filter((competitor) => competitor.baseOvr > baseOvr).length;
  return { rank: better + 1, ovrGap: baseOvr - topOvr };
}

type BuildSafeOfferArgs = {
  state: CareerState;
  ruleset: Ruleset;
  reason: 'EXPIRED' | 'INTEREST';
  revision: number;
  contract: Contract;
  squadRole: SquadRole;
};

/**
 * D-44 안전 잔류 제안: 항상 index 0, `RENEWAL`, `validUntilRevision: null`·`negotiable` 전부 false로
 * 만료되지 않는다. 계약이 남았으면(INTEREST) 현 계약 조건 그대로("현 계약 유지" 0비용), 만료면
 * (EXPIRED) 현 구단 1시즌·낮은 급여·한 단계 아래 역할.
 */
function buildSafeOffer(args: BuildSafeOfferArgs): Offer {
  const { state, ruleset, reason, revision, contract, squadRole } = args;
  const id = `OFR-${revision}-0`;
  const base: Pick<Offer, 'id' | 'kind' | 'teamId' | 'teamName' | 'fromTeamId' | 'leagueTier' | 'positionPlan' | 'shirtNumber'> = {
    id,
    kind: 'RENEWAL',
    teamId: contract.teamId,
    teamName: contract.teamName,
    fromTeamId: contract.teamId,
    leagueTier: contract.leagueTier,
    positionPlan: contract.positionPlan,
    shirtNumber: contract.shirtNumber,
  };

  if (reason === 'INTEREST') {
    const remaining = computeContractSeasonsRemaining(contract.lengthSeasons, contract.signedAtRevision, state.timeline);
    return {
      ...base,
      lengthSeasons: remaining,
      wageMinorPerWeek: contract.wageMinorPerWeek,
      signingBonusMinor: 0,
      transferFeeMinor: null,
      rolePromise: contract.rolePromise,
      appearancePromise: contract.appearancePromise,
      tacticalFitEstimate: state.context.tacticalFit,
      competitorSummary: null,
      validUntilRevision: null,
      negotiable: { wage: false, role: false, length: false },
      negotiationState: 'OPEN',
      negotiatedAsk: null,
      loan: null,
    };
  }

  const team = findTeamById(ruleset, contract.teamId);
  const profile = state.player.profile;
  if (profile === null) throw new RangeError('buildSafeOffer: player.profile이 null이다.');
  const band = findOvrBand(ruleset.contractRules, profile.baseOvr);
  const wageBase = lookupBandAmount(ruleset.contractRules.wageBands, team.wageBandId, band.id, 'wageBands');
  const wage = Math.floor((wageBase * ruleset.transferRules.safeRenewal.wageBp) / 10000);
  const degradedRole = ROLE_DEGRADE[squadRole];

  return {
    ...base,
    lengthSeasons: ruleset.transferRules.safeRenewal.lengthSeasons,
    wageMinorPerWeek: wage,
    signingBonusMinor: 0,
    transferFeeMinor: null,
    rolePromise: degradedRole,
    appearancePromise: { minutesShareBp: ruleset.contractRules.promiseMinutesShareBp[degradedRole] },
    tacticalFitEstimate: state.context.tacticalFit,
    competitorSummary: null,
    validUntilRevision: null,
    negotiable: { wage: false, role: false, length: false },
    negotiationState: 'OPEN',
    negotiatedAsk: null,
    loan: null,
  };
}

export type GenerateMarketArgs = {
  state: CareerState;
  ruleset: Ruleset;
  reason: 'EXPIRED' | 'INTEREST';
  revision: number;
  rng: RngState;
};

export type GeneratedMarket = { pending: Extract<Pending, { kind: 'OFFERS' }>; rngState: RngState };

/**
 * T-3-002 D-43/D-44: 결정론 rng 소비 순서(제안 1개당, 고정) — 팀 추첨 → 종류(EXPIRED가 아니면) →
 * (LOAN이면 바이아웃) → 기간(LOAN이면 생략, 고정 1) → 역할 → 등번호 → 적합도. `competitorSummary`는
 * 파생 시드(`market:${careerId}:${revision}:${teamId}`)로 계산해 이 스트림을 소비하지 않는다. 안전
 * 잔류 제안(index 0)은 rng를 쓰지 않는다.
 */
export function generateMarket(args: GenerateMarketArgs): GeneratedMarket {
  const { state, ruleset, reason, revision, rng } = args;
  const contract = state.contract;
  if (contract === null) throw new RangeError('generateMarket: contract가 null이다.');
  const profile = state.player.profile;
  if (profile === null) throw new RangeError('generateMarket: player.profile이 null이다.');

  const transferRules = ruleset.transferRules;
  const indexCenti = computeMarketValueIndex(buildMarketValueInput(state, ruleset), ruleset.marketValueRules).indexCenti;
  const squadRole = currentSquadRole(state, contract);

  const candidateTeams = computeCandidateTeams(ruleset, contract.teamId, indexCenti);

  const hasWantsMove = state.tags.includes('이적_희망');
  const hasAgentDeal = state.tags.includes('에이전트_계약');
  const interestBonus = hasWantsMove ? 2 : reason === 'INTEREST' ? 1 : 0;
  const agentBonus = hasAgentDeal ? 1 : 0;
  const desiredCount = clamp(1 + interestBonus + agentBonus, 1, 4);
  const lotteryCount = Math.min(desiredCount, candidateTeams.length);

  const feeMinor = findFeeMinor(transferRules.feeByIndexBand, indexCenti);

  let remainingPool = candidateTeams;
  let rngState = rng;
  const drawnOffers: Offer[] = [];

  for (let index = 0; index < lotteryCount; index++) {
    const teamRoll = rollInt(rngState, remainingPool.length);
    rngState = teamRoll.state;
    const team = remainingPool[teamRoll.value]!;
    remainingPool = remainingPool.filter((candidate) => candidate.id !== team.id);

    let kind: OfferKind;
    if (reason === 'EXPIRED') {
      kind = 'FREE_AGENT';
    } else {
      const kindRoll = rollInt(rngState, 100);
      rngState = kindRoll.state;
      kind = kindRoll.value < transferRules.kindWeightsByRole[squadRole].TRANSFER ? 'TRANSFER' : 'LOAN';
    }

    let loan: Offer['loan'] = null;
    let lengthSeasons: number;
    if (kind === 'LOAN') {
      const buyRoll = rollInt(rngState, 10000);
      rngState = buyRoll.state;
      const buyOptionMinor = buyRoll.value < transferRules.loan.buyOptionChanceBp ? feeMinor : null;
      loan = { parentTeamId: contract.teamId, seasons: 1, wageShareBp: transferRules.loan.wageShareBp, buyOptionMinor };
      lengthSeasons = 1;
    } else {
      const lengthRoll = rollRange(rngState, ruleset.offerRules.lengthSeasons.min, ruleset.offerRules.lengthSeasons.max);
      rngState = lengthRoll.state;
      lengthSeasons = lengthRoll.value;
    }

    const tierKey = String(team.leagueTier) as '1' | '2' | '3' | 'YOUTH';
    const roleOptions = ruleset.offerRules.rolePromiseByTier[tierKey];
    const roleRoll = rollInt(rngState, roleOptions.length);
    rngState = roleRoll.state;
    const rolePromise: SquadRole = roleOptions[roleRoll.value]!;

    const shirtRoll = rollRange(rngState, ruleset.offerRules.shirtNumber.min, ruleset.offerRules.shirtNumber.max);
    rngState = shirtRoll.state;

    const fitRoll = rollRange(rngState, ruleset.offerRules.tacticalFitEstimate.min, ruleset.offerRules.tacticalFitEstimate.max);
    rngState = fitRoll.state;

    const band = findOvrBand(ruleset.contractRules, profile.baseOvr);
    const wage = lookupBandAmount(ruleset.contractRules.wageBands, team.wageBandId, band.id, 'wageBands');
    const signingBonus = lookupBandAmount(ruleset.contractRules.signingBonus, team.wageBandId, band.id, 'signingBonus');

    const competitorSummary = computeCompetitorSummary(
      ruleset,
      team,
      profile.primaryPosition,
      profile.baseOvr,
      `market:${state.careerId}:${revision}:${team.id}`,
    );

    drawnOffers.push({
      id: `OFR-${revision}-${index + 1}`,
      kind,
      teamId: team.id,
      teamName: team.name,
      fromTeamId: null,
      leagueTier: team.leagueTier,
      lengthSeasons,
      wageMinorPerWeek: wage,
      signingBonusMinor: signingBonus,
      transferFeeMinor: kind === 'TRANSFER' ? feeMinor : null,
      rolePromise,
      appearancePromise: { minutesShareBp: ruleset.contractRules.promiseMinutesShareBp[rolePromise] },
      positionPlan: profile.primaryPosition,
      shirtNumber: shirtRoll.value,
      tacticalFitEstimate: fitRoll.value,
      competitorSummary,
      validUntilRevision: revision + transferRules.offerValidityRevisions,
      negotiable: kind === 'LOAN' ? { wage: false, role: true, length: false } : { wage: true, role: true, length: true },
      negotiationState: 'OPEN',
      negotiatedAsk: null,
      loan,
    });
  }

  const safeOffer = buildSafeOffer({ state, ruleset, reason, revision, contract, squadRole });
  const offers = [safeOffer, ...drawnOffers];

  return {
    pending: {
      kind: 'OFFERS',
      offers,
      market: { openedAtRevision: revision, seasonIndex: state.seasonHistory.length, reason, safeOfferId: safeOffer.id },
    },
    rngState,
  };
}

/**
 * T-3-001 D-43 (a): step 7 재계약 사전 협상. rng를 쓰지 않는다. `season.ts`의 `selectOpenSlot` CONTRACT
 * 분기가 부른다(season이 활성 상태라 `state.season`이 반드시 있어야 한다).
 */
export function buildRenewalOffer(state: CareerState, ruleset: Ruleset, revision: number): Offer {
  const contract = state.contract;
  if (contract === null) throw new RangeError('buildRenewalOffer: contract가 null이다.');
  const profile = state.player.profile;
  if (profile === null) throw new RangeError('buildRenewalOffer: player.profile이 null이다.');
  const season = state.season;
  if (season === null) throw new RangeError('buildRenewalOffer: season이 null이다.');

  const transferRules = ruleset.transferRules;
  const team = findTeamById(ruleset, contract.teamId);
  const band = findOvrBand(ruleset.contractRules, profile.baseOvr);
  const wageBase = lookupBandAmount(ruleset.contractRules.wageBands, team.wageBandId, band.id, 'wageBands');
  const wage = Math.floor((wageBase * transferRules.renewal.wageBpByRole[season.squadRole]) / 10000);
  const bonusBase = lookupBandAmount(ruleset.contractRules.signingBonus, team.wageBandId, band.id, 'signingBonus');
  const signingBonus = Math.floor(bonusBase / 2);

  return {
    id: `OFR-${revision}-0`,
    kind: 'RENEWAL',
    teamId: contract.teamId,
    teamName: contract.teamName,
    fromTeamId: contract.teamId,
    leagueTier: contract.leagueTier,
    lengthSeasons: transferRules.renewal.lengthSeasons,
    wageMinorPerWeek: wage,
    signingBonusMinor: signingBonus,
    transferFeeMinor: null,
    rolePromise: season.squadRole,
    appearancePromise: { minutesShareBp: ruleset.contractRules.promiseMinutesShareBp[season.squadRole] },
    positionPlan: contract.positionPlan,
    shirtNumber: contract.shirtNumber,
    tacticalFitEstimate: state.context.tacticalFit,
    competitorSummary: null,
    validUntilRevision: revision + transferRules.offerValidityRevisions,
    negotiable: { wage: true, role: false, length: true },
    negotiationState: 'OPEN',
    negotiatedAsk: null,
    loan: null,
  };
}

export type OpenMarketResult = { state: CareerState; opened: boolean };

/**
 * T-3-002 4절: 결산 뒤 상태를 받아 시장을 연다(배선은 T-3-003 — `settleSeason`에서 호출하지 않는다).
 * 타임라인 항목은 넣지 않는다(시장 개방은 `pending`으로 충분).
 */
export function openMarketAfterSettlement(settledState: CareerState, ruleset: Ruleset, revision: number): OpenMarketResult {
  const reason = judgeMarketReason(settledState, ruleset);
  if (reason === null) {
    return { state: settledState, opened: false };
  }
  const generated = generateMarket({ state: settledState, ruleset, reason, revision, rng: settledState.rngState });
  return {
    state: { ...settledState, rngState: generated.rngState, pending: generated.pending },
    opened: true,
  };
}
