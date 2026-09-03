import careerMfRaw from './career-08-mf.json';
import seasonRaw from './career-08-mf-season.json';
import { runCareerFixture, rulesetProto, type CareerFixture } from './career-01.js';
import type { Command, SimulationResult } from '../simulate.js';
import { simulate } from '../simulate.js';
import type { CompetitionRecord, DomainSnapshot, MatchRecord, SeasonPlayerStats } from '../types.js';

export const careerMfFixture = careerMfRaw as CareerFixture;

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
    rulesetVersion: careerMfFixture.rulesetVersion,
    contentPackVersion: careerMfFixture.contentPackVersion,
  });
  if (!result.ok) {
    throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

export type MfFixtureRun = {
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
 * T-2-011 1번: AM 아키타입(`am-playmaker`) 선수가 계약(`career-08-mf.json`)한 뒤 FAST 시즌 전체를
 * 치른다(`career-08-mf-season.json`, seed `mf-search-am-playmaker-170` — `am-playmaker-1`부터
 * 순차 탐색해 170번째로 NOT_SELECTED(전술 스타일 'possession'은 AM slots이 0이라 경쟁자 2명+선수
 * 3명 중 최소 2명이 항상 OUT)·UNUSED_SUB·퇴장(레드+SUSPENSION 결장)이 한 시즌 안에 나온 seed —
 * 이 seed는 부상이 안 나와 부상 사례는 career-07-df·career-09-fw·career-04-gk가 대신 맡는다).
 * MF 전용 통계(assists·chancesCreated·progressivePasses·passesAttempted·passesCompleted·
 * ballRecoveries)를 고정한다.
 */
export function runMfFixture(): MfFixtureRun {
  let snapshot = runCareerFixture(careerMfFixture);

  snapshot = runOrThrow(
    snapshot,
    buildCommand('START_SEASON', 'mf-season-start', snapshot.revision, seasonCommandLog.startSeason),
  );

  let beforeSettlement: MfFixtureRun['beforeSettlement'] | null = null;

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
    const command = buildCommand(rawCommand.type, `mf-season-${index}`, snapshot.revision, rawCommand.payload);
    snapshot = runOrThrow(snapshot, command);
  });

  return { snapshot, beforeSettlement: beforeSettlement! };
}
