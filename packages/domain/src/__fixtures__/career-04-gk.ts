import careerGkRaw from './career-04-gk.json';
import seasonRaw from './career-04-gk-season.json';
import { runCareerFixture, rulesetProto, type CareerFixture } from './career-01.js';
import type { Command, SimulationResult } from '../simulate.js';
import { simulate } from '../simulate.js';
import type { CompetitionRecord, DomainSnapshot, SeasonPlayerStats } from '../types.js';

export const careerGkFixture = careerGkRaw as CareerFixture;

type SeasonCommandLog = {
  startSeason: { simulationMode: 'FAST'; serviceSeasonId: string };
  commands: Array<{ type: Command['type']; payload: unknown }>;
};

const seasonCommandLog = seasonRaw as SeasonCommandLog;

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
    rulesetVersion: careerGkFixture.rulesetVersion,
    contentPackVersion: careerGkFixture.contentPackVersion,
  });
  if (!result.ok) {
    throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

export type GkFixtureRun = {
  snapshot: DomainSnapshot;
  /** SETTLE_SEASON 직전(season이 null이 되기 전) 경기·시즌 통계·대회 기록 스냅샷. GK 클린시트·선방
   * 집계와 평점 스케일(career-02-season의 FW 평점과 같은 40~100 범위)을 golden으로 고정한다. */
  beforeSettlement: {
    matchesPlayed: number;
    playerStats: SeasonPlayerStats;
    averageRatingTenths: number | null;
    competitions: CompetitionRecord[];
  };
};

/**
 * T-2-003 D-35 golden 절차 3: GK 아키타입(`gk-shot-stopper`) 선수가 계약(`career-04-gk.json`)한 뒤
 * FAST 시즌 전체를 치른다(`career-04-gk-season.json`, seed 탐색으로 골키퍼가 대부분 선발되도록 고정).
 * career-02-season과 달리 FW가 아닌 GK 전용 통계(saves·cleanSheet)와 rating 스케일을 고정한다.
 */
export function runGkFixture(): GkFixtureRun {
  let snapshot = runCareerFixture(careerGkFixture);

  snapshot = runOrThrow(
    snapshot,
    buildCommand('START_SEASON', 'gk-season-start', snapshot.revision, seasonCommandLog.startSeason),
  );

  let beforeSettlement: GkFixtureRun['beforeSettlement'] | null = null;

  seasonCommandLog.commands.forEach((rawCommand, index) => {
    if (rawCommand.type === 'SETTLE_SEASON') {
      const season = snapshot.state.season!;
      beforeSettlement = {
        matchesPlayed: season.matches.length,
        playerStats: season.playerStats,
        averageRatingTenths:
          season.playerStats.ratedMatches > 0
            ? Math.round(season.playerStats.ratingSumTenths / season.playerStats.ratedMatches)
            : null,
        competitions: season.competitions,
      };
    }
    const command = buildCommand(rawCommand.type, `gk-season-${index}`, snapshot.revision, rawCommand.payload);
    snapshot = runOrThrow(snapshot, command);
  });

  return { snapshot, beforeSettlement: beforeSettlement! };
}
