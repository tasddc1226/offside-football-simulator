import { canonicalize, type JsonValue } from './canonical.js';
import { sha256Hex } from './hash.js';
import type { Ruleset } from './ruleset.js';
import type { CareerState, RoleProposal, SeasonResult, SquadRole } from './types.js';
import { assertSeasonLeagueLedgerInvariant, buildFinalLeagueTable } from './league-ledger.js';

const ROLE_ORDER: readonly SquadRole[] = ['STARTER', 'ROTATION', 'BENCH', 'RESERVE'];
/** '이행'을 판정할 때만 쓰는 로컬 순위(숫자가 클수록 좋은 역할). selection.ts의 SQUAD_ROLE_RANK와는
 * 반대 방향(그쪽은 숫자가 작을수록 좋다) — 이 파일에서만 쓰는 별도 상수라 혼동 없이 둔다. */
const SQUAD_ROLE_GOODNESS: Record<SquadRole, number> = { STARTER: 4, ROTATION: 3, BENCH: 2, RESERVE: 1 };

/**
 * D-39: `minutesShareBp = minutes × 10000 / possibleMinutes`(possibleMinutes 0이면 0). `delivered`는
 * `promiseMinutesShareBp`에서 share 이상인 가장 높은 역할(ROLE_ORDER는 STARTER부터라 첫 일치가 항상
 * 최선). `fulfilled`는 delivered가 promised와 같거나 더 좋은 역할일 때.
 */
export function computePromiseFulfilment(
  promised: SquadRole,
  minutes: number,
  possibleMinutes: number,
  promiseMinutesShareBp: Record<SquadRole, number>,
): SeasonResult['promiseFulfilment'] {
  const minutesShareBp = possibleMinutes === 0 ? 0 : Math.round((minutes * 10000) / possibleMinutes);
  let delivered: SquadRole = 'RESERVE';
  for (const role of ROLE_ORDER) {
    if (minutesShareBp >= promiseMinutesShareBp[role]) {
      delivered = role;
      break;
    }
  }
  const fulfilled = SQUAD_ROLE_GOODNESS[delivered] >= SQUAD_ROLE_GOODNESS[promised];
  return { promised, delivered, fulfilled, minutesShareBp };
}

export type BuildSeasonResultInput = {
  /** 결산 직전(성장·경계 회귀 전) 상태. `season`·`contract`가 non-null이어야 한다. */
  state: CareerState;
  ruleset: Ruleset;
  attributeDeltas: SeasonResult['attributeDeltas'];
  baseOvr: SeasonResult['baseOvr'];
  stateDeltas: SeasonResult['stateDeltas'];
};

/**
 * D-39: `SeasonResult`를 만든다(hash 제외 — `hashSeasonResult`가 별도로 계산한다). `roleChanges`는
 * 이번 시즌의 timeline `ROLE_RESOLVED` 항목에서 뽑는다(career 전체 timeline 중 이번 시즌의
 * `SEASON_STARTED` revision 이후만 — 시즌은 한 번에 하나만 활성화되므로 그 이후 전부가 이번 시즌
 * 몫이다). `refId`는 `resolveRole`이 `${proposal.type}:${decision}`로 남긴다.
 */
export function buildSeasonResult(input: BuildSeasonResultInput): Omit<SeasonResult, 'hash'> {
  const { state, ruleset } = input;
  const season = state.season;
  if (season === null) {
    throw new RangeError('buildSeasonResult: state.season이 null이다.');
  }
  assertSeasonLeagueLedgerInvariant(ruleset, season);
  const contract = state.contract;
  if (contract === null) {
    throw new RangeError('buildSeasonResult: state.contract가 null이다.');
  }
  // 정상 START_SEASON 경로에서는 manager가 항상 존재한다. 기존 결산 순수 함수 테스트의 축약 시즌
  // 리터럴도 유지할 수 있도록, 축약 입력에서만 예약 감독·안전 식별자로 보완한다.
  const managerId = season.manager?.id ?? state.nextManager?.id ?? 'UNKNOWN-MANAGER';

  const stats = season.playerStats;
  const possibleMinutes = season.schedule.filter((entry) => entry.skipped === undefined).length * 90;

  const player = season.selection.candidates.find((candidate) => candidate.id === 'PLAYER');
  if (player === undefined) {
    throw new RangeError('buildSeasonResult: selection에 PLAYER 후보가 없다.');
  }

  const promiseFulfilment = computePromiseFulfilment(
    contract.rolePromise,
    stats.minutes,
    possibleMinutes,
    ruleset.contractRules.promiseMinutesShareBp,
  );

  const seasonStartEntry = [...state.timeline].reverse().find((entry) => entry.kind === 'SEASON_STARTED');
  if (seasonStartEntry === undefined) {
    throw new RangeError('buildSeasonResult: timeline에 SEASON_STARTED가 없다.');
  }
  const roleChanges = state.timeline
    .filter((entry) => entry.kind === 'ROLE_RESOLVED' && entry.revision > seasonStartEntry.revision)
    .map((entry) => {
      const [type, decision] = (entry.refId ?? '').split(':');
      return { step: entry.step, type: type as RoleProposal['type'], decision: decision as 'ACCEPT' | 'DECLINE' };
    });

  const stepSummaries = season.steps
    .filter((seasonStep) => seasonStep.summary !== null)
    .map((seasonStep) => ({
      step: seasonStep.index,
      phase: seasonStep.phase,
      matchesPlayed: seasonStep.summary!.matchesPlayed,
      decisionsOpened: seasonStep.summary!.decisionsOpened,
      passedAtRevision: seasonStep.summary!.passedAtRevision,
    }));

  return {
    ...(season.legacyContext === undefined ? {} : { legacy: {
      policyVersion: '1.0.0' as const,
      incomeMinor: 'serviceStatus' in state.nationalityRuleState && state.nationalityRuleState.serviceStatus === 'SERVING' && state.nationalityRuleState.route === 'CAREER_BREAK' ? 0 : season.legacyContext.wageMinorPerWeek * 52 + season.legacyContext.signingBonusMinor,
      contractId: season.legacyContext.contractId,
      relationships: { ...state.relationships },
      promotion: season.competitions.some((competition) => competition.kind === 'LEAGUE' && competition.position !== null && competition.position <= (ruleset.leagues.find((league) => league.id === (season.leagueLedger?.leagueId ?? competition.competitionId))?.promotionSlots ?? 0)),
      ageAtStart: seasonStartEntry.age,
      injuryMissedMatches: season.matches.filter((match) => match.outReason === 'INJURY').length,
    } }),
    index: season.index,
    simulationMode: season.simulationMode,
    teamId: season.teamId,
    managerId,
    captaincyAtEnd: state.captaincy,
    competitions: season.competitions,
    ...(season.leagueLedger === undefined ? {} : { finalLeagueTable: buildFinalLeagueTable(ruleset, season.leagueLedger) }),
    playerStats: stats,
    selectionSummary: {
      squadRoleAtStart: season.squadRoleAtStart,
      squadRoleAtEnd: season.squadRole,
      started: stats.appearances.started,
      sub: stats.appearances.sub,
      zeroMinute: stats.appearances.zeroMinute,
      out: stats.appearances.out,
      minutes: stats.minutes,
      possibleMinutes,
      finalRank: player.rank,
    },
    roleChanges,
    promiseFulfilment,
    attributeDeltas: input.attributeDeltas,
    baseOvr: input.baseOvr,
    stateDeltas: input.stateDeltas,
    chapters: season.chapters,
    stepSummaries,
  };
}

/** D-39: `hash` 필드를 제외한 result의 canonical JSON sha256Hex. */
export function hashSeasonResult(result: SeasonResult | Omit<SeasonResult, 'hash'>): string {
  const { hash: _hash, ...rest } = result as SeasonResult;
  void _hash;
  return sha256Hex(canonicalize(rest as unknown as JsonValue));
}
