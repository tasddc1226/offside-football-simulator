import type { RngState } from './rng.js';
import { rollInt, seedRng } from './rng.js';
import { compareCodePoints } from './canonical.js';
import { buildReplacementManager } from './manager.js';
import { applySettlementReputation } from './reputation.js';
import type { Ruleset } from './ruleset.js';
import type { CareerState, FootballSeason, SeasonResult } from './types.js';

function expectedLeagueRank(ruleset: Ruleset, teamId: string): number | null {
  const team = ruleset.teams.find((candidate) => candidate.id === teamId);
  if (team === undefined) return null;
  const leagueTeams = ruleset.teams
    .filter((candidate) => candidate.leagueId === team.leagueId)
    .sort((a, b) => b.squadStrength - a.squadStrength || compareCodePoints(a.id, b.id));
  const rank = leagueTeams.findIndex((candidate) => candidate.id === teamId);
  return rank === -1 ? null : rank + 1;
}

function actualLeagueRank(result: SeasonResult): number | null {
  return result.competitions.find((competition) => competition.kind === 'LEAGUE')?.position ?? null;
}

function isProSeason(ruleset: Ruleset, teamId: string): boolean {
  const team = ruleset.teams.find((candidate) => candidate.id === teamId);
  return team?.leagueTier !== undefined && team.leagueTier !== 'YOUTH';
}

function nextTimelineRevision(state: CareerState): number {
  return state.timeline.reduce((max, entry) => Math.max(max, entry.revision), 0) + 1;
}

type SettlementRelationsInput = {
  state: CareerState;
  season: FootballSeason;
  result: SeasonResult;
  ruleset: Ruleset;
  rng: RngState;
  /** settleSeason의 명령 revision. 결산에서 추가하는 timeline은 SEASON_SETTLED와 같은 revision이어야 한다. */
  timelineRevision?: number;
};

type SettlementRelationsResult = {
  state: CareerState;
  /** 후속 T-3 명령을 이동시키지 않도록 결산 manager roll은 main decision stream을 소비하지 않는다. */
  rng: RngState;
  /** manager 판정 전용 파생 stream. eligible manager만 정확히 1회 소비한다. */
  managerDecisionRng: RngState | null;
};

/** 결산 manager roll을 기존 파생-seed 관례의 전용 decision substream에서 정확히 1회 적용한다. */
function applyManagerDecision(input: SettlementRelationsInput): SettlementRelationsResult {
  let state = input.state;
  const relationTimelineRevision = input.timelineRevision ?? nextTimelineRevision(state);
  const currentManager = input.season.manager;
  if (currentManager === null) {
    return { state: { ...state, nextManager: null }, rng: input.rng, managerDecisionRng: null };
  }

  const expectedRank = expectedLeagueRank(input.ruleset, input.season.teamId);
  const finalRank = actualLeagueRank(input.result);
  const gap =
    expectedRank === null || finalRank === null ? 0 : Math.max(0, finalRank - expectedRank);
  const managerRules = input.ruleset.managerRules.changeProbability;
  let rng = input.rng;
  let shouldChange = false;
  let managerDecisionRng: RngState | null = null;
  if (currentManager.tenureSeasons >= managerRules.minTenureSeasons) {
    const managerStream = seedRng(
      `manager:${state.careerId}:${input.season.index}:${input.season.teamId}:${currentManager.id}`,
    );
    const rolled = rollInt(managerStream, 10000);
    managerDecisionRng = rolled.state;
    const probabilityBp = Math.min(
      Math.max(managerRules.baseBp + gap * managerRules.perRankGapBp, 0),
      managerRules.maxBp,
    );
    shouldChange = rolled.value < probabilityBp;
  }

  if (shouldChange) {
    const profile = state.player.profile;
    if (profile === null) throw new RangeError('onSettlementRelations: player.profile이 null이다.');
    const replacement = buildReplacementManager({
      teamId: input.season.teamId,
      primaryPosition: profile.primaryPosition,
      previousManager: currentManager,
      timeline: state.timeline,
      ruleset: input.ruleset,
    });
    state = {
      ...state,
      nextManager: replacement,
      timeline: [
        ...state.timeline,
        {
          revision: relationTimelineRevision,
          kind: 'MANAGER_CHANGED',
          refId: replacement.id,
          age: state.age,
          step: 12,
        },
      ],
    };
  } else {
    state = {
      ...state,
      nextManager: { ...currentManager, tenureSeasons: currentManager.tenureSeasons + 1 },
    };
  }

  return { state, rng, managerDecisionRng };
}

/** T-4-003 결산 후 관계·평판·감독·주장단을 정해진 순서로 갱신한다. */
export function onSettlementRelations(input: SettlementRelationsInput): SettlementRelationsResult {
  // 기존 훅 계약의 최소 mock(state/result)도 안전하게 통과시킨다. 실제 결산 결과는 아래 모든
  // 필드를 갖추므로 이 가드는 런타임 경로의 규칙에 영향을 주지 않는다.
  if (
    !input.result.playerStats ||
    !input.result.selectionSummary ||
    !input.ruleset.reputationRules
  ) {
    return { state: input.state, rng: input.rng, managerDecisionRng: null };
  }
  // 1) reputation: media는 이벤트 Effect만 바꾸고 결산에서는 유지한다.
  let state = applySettlementReputation(input.state, input.result, input.ruleset);
  const relationTimelineRevision = input.timelineRevision ?? nextTimelineRevision(input.state);

  // 2) 주장단: NONE에서는 누적을 0으로 유지하고, VICE/CAPTAIN 시즌만 누적한다.
  const captainRules = input.ruleset.relationshipRules.captainAppointment;
  const proSeasons = state.seasonHistory.filter((summary) =>
    isProSeason(input.ruleset, summary.teamId),
  ).length;
  // SeasonResult가 기록한 실제 종료 직책을 기준으로 센다. 새 시즌 직책이 NONE으로 끝난
  // 경우에는 이전 구단에서 누적된 값도 이 경계에서 끊어야 하며, VICE/CAPTAIN으로 실제 마친
  // 시즌만 다음 직책 승격을 위한 누적에 포함한다.
  let captaincy = input.result.captaincyAtEnd;
  const captaincySeasons = captaincy === 'NONE' ? 0 : state.captaincySeasons + 1;
  const canAdvanceCaptaincy =
    proSeasons >= captainRules.minSeasons &&
    input.result.selectionSummary.squadRoleAtEnd === 'STARTER' &&
    state.relationships.captain >= captainRules.minCaptain;
  if (canAdvanceCaptaincy && captaincy !== 'CAPTAIN') {
    captaincy = captaincy === 'NONE' ? 'VICE' : 'CAPTAIN';
    state = {
      ...state,
      timeline: [
        ...state.timeline,
        {
          revision: relationTimelineRevision,
          kind: 'CAPTAIN_APPOINTED',
          refId: captaincy,
          age: state.age,
          step: 12,
        },
      ],
    };
  }
  state = { ...state, captaincy, captaincySeasons };

  return applyManagerDecision({ ...input, state });
}
