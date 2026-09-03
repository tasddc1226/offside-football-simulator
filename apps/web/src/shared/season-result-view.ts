// SCR-015 프로 시즌 결과(+SCR-006 유소년 변형): `seasonHistory[index].result`를 화면이 바로 쓸 수
// 있는 형태로 파생하는 순수 함수(단위 테스트). 포지션에 무관한 지표는 애초에 만들지 않는다 —
// `PositionCardView`가 group별 판별 유니온이라 UI가 다른 그룹 필드를 참조할 수 없다(SCR-015 인수
// 조건).
import {
  type AttributeKey,
  type CareerState,
  type ChapterRecord,
  type GrowthCause,
  type PositionStatsTotals,
  type Ruleset,
  type SeasonResult,
  type SquadRole,
} from '@offside/domain';
import { attributeGroups, type AttributeGroupId } from './attribute-groups.js';
import { CUP_ROUND_LABEL_KO } from './labels.js';

export type CommonMetrics = {
  started: number;
  sub: number;
  zeroMinute: number;
  out: number;
  total: number;
  minutes: number;
  /** `ratedMatches === 0`이면 null(미집계 — "—"로 표시, `ratingText`로 포맷). 반올림한 tenths(×10). */
  avgRatingTenths: number | null;
  yellow: number;
  red: number;
  injuries: number;
};

export type PositionCardView =
  | { group: 'FW'; goals: number; assists: number; xgCenti: number; shots: number; offsides: number }
  | {
      group: 'MF';
      assists: number;
      chancesCreated: number;
      progressivePasses: number;
      passesAttempted: number;
      passesCompleted: number;
      /** `passesAttempted === 0`이면 null(미집계). 반올림 퍼센트 정수. */
      passSuccessRatePercent: number | null;
      ballRecoveries: number;
    }
  | { group: 'DF'; tackles: number; interceptions: number; aerialsWon: number; goalsConcededInvolved: number; cleanSheet: number }
  | { group: 'GK'; saves: number; psxgMinusGoalsCenti: number; cleanSheet: number; crossesClaimed: number; buildUpPasses: number };

export type TeamRecordView = {
  competitionId: string;
  kind: 'LEAGUE' | 'CUP';
  label: string;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  /** 리그면 "N위/M팀"(순위 미확정 "—"), 컵이면 라운드 라벨("—"는 기록 없음). */
  standingText: string;
};

export type AttributeDeltaGroupView = {
  id: AttributeGroupId;
  entries: Array<{ key: AttributeKey; delta: number; causes: Array<{ cause: GrowthCause; centi: number }> }>;
};

export type SeasonResultView = {
  historyIndex: number;
  seasonNumber: number;
  isYouth: boolean;
  teamId: string;
  common: CommonMetrics;
  positionCard: PositionCardView;
  teamRecords: TeamRecordView[];
  selection: {
    roleAtStart: SquadRole;
    roleAtEnd: SquadRole;
    finalRank: number;
    minutes: number;
    possibleMinutes: number;
  };
  promise: SeasonResult['promiseFulfilment'];
  /** `contractRules.promiseMinutesShareBp[promised]` — CompareCards "계약 약속" 세그먼트의 목표치. */
  promiseThresholdBp: number;
  roleChanges: SeasonResult['roleChanges'];
  chapters: ChapterRecord[];
  attributeDeltaGroups: AttributeDeltaGroupView[];
  baseOvr: { before: number; after: number };
  /** 원인별 centi 합의 절대값이 가장 큰 원인. 원인이 전혀 없으면 null. */
  topCause: GrowthCause | null;
  stateDeltas: SeasonResult['stateDeltas'];
  scoutedPotentialMin: number;
  scoutedPotentialMax: number;
  hash: string;
  result: SeasonResult;
  /** CompareCards "지난 시즌" 세그먼트용. 없으면(첫 시즌) null. */
  previousResult: SeasonResult | null;
};

function buildPositionCard(totals: PositionStatsTotals): PositionCardView {
  if (totals.group === 'MF') {
    const passSuccessRatePercent =
      totals.passesAttempted === 0 ? null : Math.round((totals.passesCompleted / totals.passesAttempted) * 100);
    return { ...totals, passSuccessRatePercent };
  }
  return totals;
}

function buildTeamRecords(result: SeasonResult, ruleset: Ruleset): TeamRecordView[] {
  const team = ruleset.teams.find((candidate) => candidate.id === result.teamId);
  return result.competitions.map((record) => {
    if (record.kind === 'LEAGUE') {
      const league = team === undefined ? undefined : ruleset.leagues.find((candidate) => candidate.id === team.leagueId);
      const standingText = record.position === null ? '—' : `${record.position}위/${league?.teamCount ?? '—'}팀`;
      return {
        competitionId: record.competitionId,
        kind: 'LEAGUE',
        label: league?.name ?? '리그',
        won: record.won,
        drawn: record.drawn,
        lost: record.lost,
        goalsFor: record.goalsFor,
        goalsAgainst: record.goalsAgainst,
        standingText,
      };
    }
    const cup = team === undefined ? undefined : ruleset.cups.find((candidate) => candidate.tiers.includes(team.leagueTier));
    const standingText =
      record.cupRound === null ? '—' : (CUP_ROUND_LABEL_KO[record.cupRound as keyof typeof CUP_ROUND_LABEL_KO] ?? record.cupRound);
    return {
      competitionId: record.competitionId,
      kind: 'CUP',
      label: cup?.name ?? '컵',
      won: record.won,
      drawn: record.drawn,
      lost: record.lost,
      goalsFor: record.goalsFor,
      goalsAgainst: record.goalsAgainst,
      standingText,
    };
  });
}

function buildAttributeDeltaGroups(deltas: SeasonResult['attributeDeltas']): AttributeDeltaGroupView[] {
  return attributeGroups()
    .map((group) => ({
      id: group.id,
      entries: group.keys
        .map((key) => deltas.find((entry) => entry.key === key))
        .filter((entry): entry is SeasonResult['attributeDeltas'][number] => entry !== undefined)
        .map((entry) => ({ key: entry.key, delta: entry.delta, causes: entry.causes })),
    }))
    .filter((group) => group.entries.length > 0);
}

const GROWTH_CAUSE_ORDER: readonly GrowthCause[] = ['TRAINING', 'MINUTES', 'EXPERIENCE', 'AGE_DECLINE', 'POTENTIAL_CAP'];

/** 원인별 centi 합을 구해 절대값이 가장 큰 원인을 고른다(동률이면 GROWTH_CAUSE_ORDER 순). */
function findTopCause(deltas: SeasonResult['attributeDeltas']): GrowthCause | null {
  const sums: Record<GrowthCause, number> = { TRAINING: 0, MINUTES: 0, EXPERIENCE: 0, AGE_DECLINE: 0, POTENTIAL_CAP: 0 };
  for (const entry of deltas) {
    for (const cause of entry.causes) {
      sums[cause.cause] += cause.centi;
    }
  }
  let top: GrowthCause | null = null;
  let topAbs = 0;
  for (const cause of GROWTH_CAUSE_ORDER) {
    const abs = Math.abs(sums[cause]);
    if (abs > topAbs) {
      top = cause;
      topAbs = abs;
    }
  }
  return top;
}

export function deriveSeasonResultView(state: CareerState, index: number, ruleset: Ruleset): SeasonResultView | null {
  const summary = state.seasonHistory[index];
  if (summary === undefined) return null;
  const result = summary.result;
  const profile = state.player.profile;
  if (profile === null) return null;

  const stats = result.playerStats;
  const common: CommonMetrics = {
    started: stats.appearances.started,
    sub: stats.appearances.sub,
    zeroMinute: stats.appearances.zeroMinute,
    out: stats.appearances.out,
    total: stats.appearances.total,
    minutes: stats.minutes,
    avgRatingTenths: stats.ratedMatches === 0 ? null : Math.round(stats.ratingSumTenths / stats.ratedMatches),
    yellow: stats.yellow,
    red: stats.red,
    injuries: stats.injuries,
  };

  const team = ruleset.teams.find((candidate) => candidate.id === result.teamId);
  const isYouth = team?.leagueTier === 'YOUTH';

  return {
    historyIndex: index,
    seasonNumber: result.index,
    isYouth,
    teamId: result.teamId,
    common,
    positionCard: buildPositionCard(stats.totals),
    teamRecords: buildTeamRecords(result, ruleset),
    selection: {
      roleAtStart: result.selectionSummary.squadRoleAtStart,
      roleAtEnd: result.selectionSummary.squadRoleAtEnd,
      finalRank: result.selectionSummary.finalRank,
      minutes: result.selectionSummary.minutes,
      possibleMinutes: result.selectionSummary.possibleMinutes,
    },
    promise: result.promiseFulfilment,
    promiseThresholdBp: ruleset.contractRules.promiseMinutesShareBp[result.promiseFulfilment.promised],
    roleChanges: result.roleChanges,
    chapters: result.chapters,
    attributeDeltaGroups: buildAttributeDeltaGroups(result.attributeDeltas),
    baseOvr: result.baseOvr,
    topCause: findTopCause(result.attributeDeltas),
    stateDeltas: result.stateDeltas,
    scoutedPotentialMin: profile.scoutedPotentialMin,
    scoutedPotentialMax: profile.scoutedPotentialMax,
    hash: result.hash,
    result,
    previousResult: state.seasonHistory[index - 1]?.result ?? null,
  };
}
