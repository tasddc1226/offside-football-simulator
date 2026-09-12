import { matchesWithMinutes } from './market.js';
import type { Ruleset } from './ruleset.js';
import { computeSquadStatus, isSquadRoleBetter } from './selection.js';
import { computePromiseFulfilment } from './settlement.js';
import type { CareerState, Contract, SeasonSummary, SquadRole } from './types.js';

/**
 * 이슈 #148: 임대 복귀(LOAN_RETURN → RETURN) 시 원소속 역할 재평가 입력·결과. 표시(SCR-020 임대 복귀
 * 결정 화면)와 도메인 전이(`simulate.ts` loanReturn, 1.4.0+ `transferRules.loanReturn.reevaluate`)가
 * 같은 함수를 읽는다. 이미 저장된 임대 시즌 결산값만 쓰고 rng를 전혀 소비하지 않는다.
 */
export type LoanReturnEvaluation = {
  /** 임대 시즌 성과 요약(표시용). `goals`·`assists`는 포지션군에 그 항목이 없으면 null. */
  loanSeason: {
    index: number;
    teamId: string;
    /** 1분 이상 뛴 경기 수(`total - zeroMinute`). 직전 시즌 결산 화면의 출전 수와 같은 식이다. */
    matches: number;
    started: number;
    /** 실제로 투입된 교체 출전 수(미사용 교체 명단 `zeroMinute - out` 제외). 결산 화면과 같은 식이다. */
    sub: number;
    minutes: number;
    possibleMinutes: number;
    minutesShareBp: number;
    avgRatingTenths: number | null;
    goals: number | null;
    assists: number | null;
  };
  /** 원소속 계약이 약속한 역할(복귀 전). */
  parentRolePromise: SquadRole;
  /** 임대 시즌 출전 비율이 실제로 "이행한" 역할(`computePromiseFulfilment.delivered`와 같은 판정). */
  deliveredRole: SquadRole;
  /** 원소속 리그 등급이 제안하는 역할 상한(`offerRules.rolePromiseByTier[tier]` 중 최선). */
  ceilingRole: SquadRole;
  /** 재평가 결과 역할: `max(parentRolePromise, min(deliveredRole, ceilingRole))` — 복귀로 내려가지는 않는다. */
  reevaluatedRole: SquadRole;
  /** 임대 이행 역할이 원소속 등급 상한보다 높아 상한에 잘렸는지(`deliveredRole > ceilingRole`). */
  cappedByTier: boolean;
  /** 임대 이행 역할이 원소속 약속보다 낮아 '복귀로 내려가지 않음' 규칙이 약속을 지켰는지(`deliveredRole < parentRolePromise`). */
  belowPromise: boolean;
  /** 재평가 역할 + 임대 시즌 평균 평점으로 `computeSquadStatus`가 낸 값(주장 보너스 없음). */
  squadStatus: number;
  /** 이 룰셋이 실제로 재평가를 적용하는지(1.4.0+ 키). false면 표시만 하고 계약은 그대로다. */
  applies: boolean;
};

function betterRole(a: SquadRole, b: SquadRole): SquadRole {
  return isSquadRoleBetter(a, b) ? a : b;
}

function worseRole(a: SquadRole, b: SquadRole): SquadRole {
  return isSquadRoleBetter(a, b) ? b : a;
}

function bestRoleOfferedAtTier(ruleset: Ruleset, tier: Contract['leagueTier']): SquadRole {
  const key = String(tier) as '1' | '2' | '3' | 'YOUTH';
  const options = ruleset.offerRules.rolePromiseByTier[key];
  return options.reduce<SquadRole>((best, role) => betterRole(role, best), 'RESERVE');
}

function loanSeasonSummary(state: CareerState, parent: Contract): SeasonSummary | null {
  const last = state.seasonHistory.at(-1);
  if (last === undefined || last.teamId === parent.teamId) return null;
  return last;
}

export type EvaluateLoanReturnRoleArgs = { state: CareerState; ruleset: Ruleset; parent: Contract };

/**
 * 임대 시즌(`seasonHistory.at(-1)`, 원소속과 다른 팀)의 결산값으로 원소속 역할을 재평가한다. 임대
 * 시즌이 없거나 마지막 시즌이 원소속 시즌이면 null. 판정 규칙은 새 수치 없이 기존 것만 재사용한다:
 * 출전 비율 → 역할은 `computePromiseFulfilment`(결산 약속 판정과 동일), 역할 상한은 원소속 등급의
 * `offerRules.rolePromiseByTier`, squadStatus는 `computeSquadStatus`(선발 점수 입력과 동일).
 */
export function evaluateLoanReturnRole(args: EvaluateLoanReturnRoleArgs): LoanReturnEvaluation | null {
  const { state, ruleset, parent } = args;
  const loan = loanSeasonSummary(state, parent);
  if (loan === null) return null;
  const result = loan.result;
  const stats = result.playerStats;
  const selection = result.selectionSummary;

  const fulfilment = computePromiseFulfilment(
    parent.rolePromise,
    selection.minutes,
    selection.possibleMinutes,
    ruleset.contractRules.promiseMinutesShareBp,
  );
  const ceilingRole = bestRoleOfferedAtTier(ruleset, parent.leagueTier);
  const reevaluatedRole = betterRole(parent.rolePromise, worseRole(fulfilment.delivered, ceilingRole));
  const avgRatingTenths = stats.ratedMatches > 0 ? Math.round(stats.ratingSumTenths / stats.ratedMatches) : null;
  const squadStatus = computeSquadStatus(
    { rolePromise: reevaluatedRole, captaincy: 'NONE', lastRating: avgRatingTenths === null ? null : avgRatingTenths / 10 },
    ruleset.selectionRules,
    ruleset.contractRules.squadStatusByRole,
  );
  const totals = stats.totals;
  const goals = totals.group === 'FW' ? totals.goals : null;
  const assists = totals.group === 'FW' || totals.group === 'MF' ? totals.assists : null;
  // 저장 집계의 sub는 미사용 교체 명단까지, total은 결장까지 센다. 결산 화면(appearanceSummary)과 같은 식으로
  // 1분 이상 뛴 경기만 출전으로 세어 직전 화면과 같은 숫자가 읽히게 한다(원본 집계·해시는 그대로).
  const appearances = stats.appearances;
  const unusedSub = Math.max(0, appearances.zeroMinute - appearances.out);

  return {
    loanSeason: {
      index: loan.index,
      teamId: loan.teamId,
      matches: matchesWithMinutes(stats),
      started: appearances.started,
      sub: Math.max(0, appearances.sub - unusedSub),
      minutes: selection.minutes,
      possibleMinutes: selection.possibleMinutes,
      minutesShareBp: fulfilment.minutesShareBp,
      avgRatingTenths,
      goals,
      assists,
    },
    parentRolePromise: parent.rolePromise,
    deliveredRole: fulfilment.delivered,
    ceilingRole,
    reevaluatedRole,
    cappedByTier: isSquadRoleBetter(fulfilment.delivered, ceilingRole),
    belowPromise: isSquadRoleBetter(parent.rolePromise, fulfilment.delivered),
    squadStatus,
    applies: ruleset.transferRules.loanReturn?.reevaluate === true,
  };
}
