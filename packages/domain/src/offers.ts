import { clamp } from './clamp.js';
import { compareCodePoints } from './canonical.js';
import { rollInt, type RngState } from './rng.js';
import { rollRange } from './roll-range.js';
import type { ContractRules, OfferBranch, OfferRules, Ruleset, Team } from './ruleset.js';
import type { Offer, SquadRole } from './types.js';

/**
 * D-9: `branches` 배열 순서대로 첫 일치 분기를 고른다. `requireTags`는 전부 있어야 하고
 * `forbidTags`는 하나도 없어야 한다.
 */
export function findMatchingOfferBranch(rules: OfferRules, tags: readonly string[]): OfferBranch | null {
  const tagSet = new Set(tags);
  for (const branch of rules.branches) {
    if (!branch.requireTags.every((tag) => tagSet.has(tag))) continue;
    if (branch.forbidTags?.some((tag) => tagSet.has(tag))) continue;
    return branch;
  }
  return null;
}

function computeOfferCount(rules: OfferRules, branch: OfferBranch, tags: readonly string[]): number {
  if (branch.fixedCount !== undefined) return branch.fixedCount;
  const tagSet = new Set(tags);
  const bonus = rules.countBonusTags.filter((tag) => tagSet.has(tag)).length;
  return clamp(1 + bonus, 1, rules.maxOffers);
}

function buildTeamPool(ruleset: Ruleset, branch: OfferBranch): { pool: Team[]; fixed: boolean } {
  if (branch.fixedTeamId !== undefined) {
    const team = ruleset.teams.find((candidate) => candidate.id === branch.fixedTeamId);
    if (team === undefined) {
      throw new RangeError(`buildTeamPool: 룰셋에 fixedTeamId '${branch.fixedTeamId}'가 없다.`);
    }
    return { pool: [team], fixed: true };
  }
  const pool = ruleset.teams
    .filter((team) => branch.tiers.includes(team.leagueTier))
    .slice()
    .sort((a, b) => compareCodePoints(a.id, b.id));
  return { pool, fixed: false };
}

function findOvrBand(rules: ContractRules, baseOvr: number): { id: string; maxOvr: number } {
  const band = rules.ovrBands.find((candidate) => baseOvr <= candidate.maxOvr);
  if (band === undefined) {
    throw new RangeError(`findOvrBand: baseOvr ${baseOvr}에 맞는 ovrBand가 없다.`);
  }
  return band;
}

function lookupBandAmount(table: Record<string, Record<string, number>>, wageBandId: string, bandId: string, label: string): number {
  const amount = table[wageBandId]?.[bandId];
  if (amount === undefined) {
    throw new RangeError(`lookupBandAmount: ${label}에 wageBandId '${wageBandId}'·band '${bandId}' 조합이 없다.`);
  }
  return amount;
}

export type GeneratedOffers = { offers: Offer[]; rngState: RngState };

/**
 * D-9: 제안 1개당 rng 소비 순서(고정) — 팀 추출(고정 팀이면 생략) → lengthSeasons → rolePromise
 * → shirtNumber → tacticalFitEstimate. 주급·계약금은 rng 없이 `contractRules.ovrBands`(baseOvr
 * 구간)와 `wageBands[team.wageBandId]`에서 읽는다. 풀이 desiredCount보다 작으면 풀 크기만큼만
 * 만든다.
 */
export function generateOffers(
  ruleset: Ruleset,
  branch: OfferBranch,
  tags: readonly string[],
  baseOvr: number,
  revision: number,
  rng: RngState,
): GeneratedOffers {
  const rules = ruleset.offerRules;
  const desiredCount = computeOfferCount(rules, branch, tags);
  const { pool, fixed } = buildTeamPool(ruleset, branch);
  const count = Math.min(desiredCount, pool.length);
  const band = findOvrBand(ruleset.contractRules, baseOvr);
  const useTopTierFirst = !fixed && branch.topTierMinOvr !== undefined && baseOvr >= branch.topTierMinOvr;

  let remainingPool = pool;
  let state = rng;
  const offers: Offer[] = [];

  for (let index = 0; index < count; index++) {
    let team: Team;
    if (fixed) {
      team = remainingPool[0]!;
      remainingPool = remainingPool.slice(1);
    } else {
      let candidatePool = remainingPool;
      if (index === 0 && useTopTierFirst) {
        const topTierPool = remainingPool.filter((candidate) => candidate.leagueTier === 1);
        if (topTierPool.length > 0) candidatePool = topTierPool;
      }
      const rolled = rollInt(state, candidatePool.length);
      state = rolled.state;
      team = candidatePool[rolled.value]!;
      remainingPool = remainingPool.filter((candidate) => candidate.id !== team.id);
    }

    const lengthRoll = rollRange(state, rules.lengthSeasons.min, rules.lengthSeasons.max);
    state = lengthRoll.state;

    const tierKey = String(team.leagueTier) as '1' | '2' | '3' | 'YOUTH';
    const roleOptions = rules.rolePromiseByTier[tierKey];
    const roleRoll = rollInt(state, roleOptions.length);
    state = roleRoll.state;
    const rolePromise: SquadRole = roleOptions[roleRoll.value]!;

    const shirtRoll = rollRange(state, rules.shirtNumber.min, rules.shirtNumber.max);
    state = shirtRoll.state;

    const fitRoll = rollRange(state, rules.tacticalFitEstimate.min, rules.tacticalFitEstimate.max);
    state = fitRoll.state;

    const wage = lookupBandAmount(ruleset.contractRules.wageBands, team.wageBandId, band.id, 'wageBands');
    const signingBonus = lookupBandAmount(ruleset.contractRules.signingBonus, team.wageBandId, band.id, 'signingBonus');

    offers.push({
      id: `OFR-${revision}-${index}`,
      teamId: team.id,
      teamName: team.name,
      leagueTier: team.leagueTier,
      lengthSeasons: lengthRoll.value,
      wageMinorPerWeek: wage,
      signingBonusMinor: signingBonus,
      rolePromise,
      shirtNumber: shirtRoll.value,
      tacticalFitEstimate: fitRoll.value,
    });
  }

  return { offers, rngState: state };
}
