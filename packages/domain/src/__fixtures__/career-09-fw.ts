import careerFwRaw from './career-09-fw.json';
import seasonRaw from './career-09-fw-season.json';
import { runCareerFixture, rulesetProto, type CareerFixture } from './career-01.js';
import type { Command, SimulationResult } from '../simulate.js';
import { simulate } from '../simulate.js';
import type { CompetitionRecord, DomainSnapshot, MatchRecord, SeasonPlayerStats } from '../types.js';

export const careerFwFixture = careerFwRaw as CareerFixture;

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
    rulesetVersion: careerFwFixture.rulesetVersion,
    contentPackVersion: careerFwFixture.contentPackVersion,
  });
  if (!result.ok) {
    throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

export type FwFixtureRun = {
  snapshot: DomainSnapshot;
  /** SETTLE_SEASON 직전(season이 null이 되기 전) 경기·시즌 통계·대회 기록 스냅샷. */
  beforeSettlement: {
    matchesPlayed: number;
    playerStats: SeasonPlayerStats;
    averageRatingTenths: number | null;
    competitions: CompetitionRecord[];
    matches: MatchRecord[];
  };
};

/**
 * T-2-011 1번: ST 아키타입(`st-poacher`) 선수가 계약(`career-09-fw.json`)한 뒤 FAST 시즌 전체를
 * 치른다(`career-09-fw-season.json`, seed `fw-search-st-poacher-118` — `st-poacher-1`부터 순차
 * 탐색해 118번째로 0분(UNUSED_SUB)·교체 투입·교체 아웃·퇴장(레드+SUSPENSION 결장)·부상 이탈이 한
 * 시즌 안에 나온 seed). FW 전용 통계(goals·assists·xgCenti·shots·offsides)를 고정한다.
 */
export function runFwFixture(): FwFixtureRun {
  let snapshot = runCareerFixture(careerFwFixture);

  snapshot = runOrThrow(
    snapshot,
    buildCommand('START_SEASON', 'fw-season-start', snapshot.revision, seasonCommandLog.startSeason),
  );

  let beforeSettlement: FwFixtureRun['beforeSettlement'] | null = null;

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
        matches: season.matches,
      };
    }
    const command = buildCommand(rawCommand.type, `fw-season-${index}`, snapshot.revision, rawCommand.payload);
    snapshot = runOrThrow(snapshot, command);
  });

  return { snapshot, beforeSettlement: beforeSettlement! };
}
