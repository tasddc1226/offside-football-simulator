import careerSeasonRaw from './career-02-season.json';
import { runCareerFixture, rulesetProto } from './career-01.js';
import type { Command, SimulationResult } from '../simulate.js';
import { simulate } from '../simulate.js';
import type { CompetitionRecord, DomainSnapshot, MatchRecord, SeasonPlayerStats, SimulationMode, StepSummary } from '../types.js';

type CareerSeasonFixture = {
  rulesetVersion: string;
  contentPackVersion: string;
  startSeason: Record<SimulationMode, { simulationMode: SimulationMode; serviceSeasonId: string }>;
  commands: Record<SimulationMode, Array<{ type: Command['type']; payload: unknown }>>;
};

export const careerSeasonFixture = careerSeasonRaw as CareerSeasonFixture;

function buildCommand(
  type: Command['type'],
  commandId: string,
  expectedRevision: number,
  payload: unknown,
): Command & { commandId: string; expectedRevision: number } {
  return { type, commandId, expectedRevision, payload } as Command & { commandId: string; expectedRevision: number };
}

function runOrThrow(snapshot: DomainSnapshot, command: Command & { commandId: string; expectedRevision: number }): DomainSnapshot {
  const result: SimulationResult = simulate({
    snapshot,
    command,
    ruleset: rulesetProto,
    rulesetVersion: careerSeasonFixture.rulesetVersion,
    contentPackVersion: careerSeasonFixture.contentPackVersion,
  });
  if (!result.ok) {
    throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

/** RESOLVE_ROLE 직후(commands[mode][0]) 시즌·선수 선발 상태 요약. 브리프 golden 절차 3. */
export type SeasonSelectionSnapshot = {
  competitorsCount: number;
  tacticalFit: number;
  squadStatus: number;
  selectionPosition: string;
  slots: number;
  benchSlots: number;
  playerRank: number;
  playerAppearance: string;
  playerReason: { component: string; delta: number } | null;
};

export type SeasonFixtureRun = {
  snapshot: DomainSnapshot;
  /** START_SEASON부터 SETTLE_SEASON까지, 명령 하나마다 남긴 checkpoint 종류(순서대로). */
  checkpoints: string[];
  /** SETTLE_SEASON 직전(season이 null이 되기 전) 각 step의 index·summary. */
  stepSummaries: Array<{ index: number; summary: StepSummary | null }>;
  /** RESOLVE_ROLE(commands[mode][0]) 직후의 경쟁자·selection 스냅샷. */
  afterRoleResolve: SeasonSelectionSnapshot;
  /** SETTLE_SEASON 직전(season이 null이 되기 전) 경기·시즌 통계·대회 기록 스냅샷. 브리프 golden
   * 절차: matches 수·playerStats.appearances·minutes·시즌 평균 평점·최종 competitions. */
  beforeSettlement: {
    matchesPlayed: number;
    playerStats: SeasonPlayerStats;
    averageRatingTenths: number | null;
    competitions: CompetitionRecord[];
    /** golden에는 안 남긴다(용량) — FAST·CHAPTER byte-identical 검증 전용(career-02-season.test.ts). */
    matches: MatchRecord[];
  };
};

/**
 * career-01 fixture(계약 체결까지)를 그대로 실행한 뒤, `career-02-season.json`에 미리 적어 둔
 * 고정 명령 로그(모드별 START_SEASON → ADVANCE/RESOLVE_EVENT... → SETTLE_SEASON)를 순서대로
 * 실행한다. eligibleEvents는 매 ADVANCE 후보 하나(EVT-SEASON-FIXTURE)로 고정(브리프: "eligibleEvents는
 * fixture 팩의 후보로 고정"). FAST 모드는 EVENT 슬롯을 열지 않으므로(RULE-TIME-003) 이 후보는 FAST
 * 명령 로그에서 그냥 무시된다.
 */
export function runSeasonFixture(mode: SimulationMode): SeasonFixtureRun {
  let snapshot = runCareerFixture();
  const checkpoints: string[] = [];

  snapshot = runOrThrow(
    snapshot,
    buildCommand('START_SEASON', 'season-start', snapshot.revision, careerSeasonFixture.startSeason[mode]),
  );
  checkpoints.push(snapshot.checkpoint);

  let stepSummaries: Array<{ index: number; summary: StepSummary | null }> = [];
  let afterRoleResolve: SeasonSelectionSnapshot | null = null;
  let beforeSettlement: SeasonFixtureRun['beforeSettlement'] | null = null;

  careerSeasonFixture.commands[mode].forEach((rawCommand, index) => {
    if (rawCommand.type === 'SETTLE_SEASON') {
      const season = snapshot.state.season!;
      stepSummaries = season.steps.map((step) => ({ index: step.index, summary: step.summary }));
      beforeSettlement = {
        matchesPlayed: season.matches.length,
        playerStats: season.playerStats,
        averageRatingTenths:
          season.playerStats.ratedMatches > 0
            ? Math.round(season.playerStats.ratingSumTenths / season.playerStats.ratedMatches)
            : null,
        competitions: season.competitions,
        matches: season.matches,
      };
    }
    const command = buildCommand(rawCommand.type, `season-${index}`, snapshot.revision, rawCommand.payload);
    snapshot = runOrThrow(snapshot, command);
    checkpoints.push(snapshot.checkpoint);

    if (rawCommand.type === 'RESOLVE_ROLE') {
      const season = snapshot.state.season!;
      const player = season.selection.candidates.find((candidate) => candidate.id === 'PLAYER')!;
      afterRoleResolve = {
        competitorsCount: season.squad.competitors.length,
        tacticalFit: snapshot.state.context.tacticalFit,
        squadStatus: snapshot.state.context.squadStatus,
        selectionPosition: season.selection.position,
        slots: season.selection.slots,
        benchSlots: season.selection.benchSlots,
        playerRank: player.rank,
        playerAppearance: player.appearance,
        playerReason: season.selection.playerReason,
      };
    }
  });

  return { snapshot, checkpoints, stepSummaries, afterRoleResolve: afterRoleResolve!, beforeSettlement: beforeSettlement! };
}
