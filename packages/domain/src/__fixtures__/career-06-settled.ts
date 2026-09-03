import careerRaw from './career-06-settled.json';
import seasonRaw from './career-06-settled-season.json';
import { runCareerFixture, rulesetProto, type CareerFixture } from './career-01.js';
import type { Command, SimulationResult } from '../simulate.js';
import { simulate } from '../simulate.js';
import type { CompetitionRecord, DomainSnapshot, SeasonPlayerStats } from '../types.js';

export const careerSettledFixture = careerRaw as CareerFixture;

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
    rulesetVersion: careerSettledFixture.rulesetVersion,
    contentPackVersion: careerSettledFixture.contentPackVersion,
  });
  if (!result.ok) {
    throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

export type SettledFixtureRun = {
  snapshot: DomainSnapshot;
  /** SETTLE_SEASON 직전(season이 null이 되기 전) 경기·시즌 통계·대회 기록 스냅샷. */
  beforeSettlement: {
    matchesPlayed: number;
    playerStats: SeasonPlayerStats;
    averageRatingTenths: number | null;
    competitions: CompetitionRecord[];
  };
};

/**
 * T-2-005 D-39: career-01과 같은 seed(`offside-fixture-01`, careerId만 다르다 — seedRng는 seed만
 * 쓴다)로 만든 유스 첫 커리어에, career-02-season의 FAST 시즌 명령 로그를 그대로 이어 SETTLE_SEASON까지
 * 간다. `seasonHistory[0].result`가 포함된 골든을 contracts golden 순회·api cross-runtime 해시
 * 테스트가 다른 fixture와 체이닝하지 않고 단독으로 재생할 수 있게 하는 게 목적이다.
 */
export function runSettledFixture(): SettledFixtureRun {
  let snapshot = runCareerFixture(careerSettledFixture);

  snapshot = runOrThrow(
    snapshot,
    buildCommand('START_SEASON', 'settled-season-start', snapshot.revision, seasonCommandLog.startSeason),
  );

  let beforeSettlement: SettledFixtureRun['beforeSettlement'] | null = null;

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
    const command = buildCommand(rawCommand.type, `settled-season-${index}`, snapshot.revision, rawCommand.payload);
    snapshot = runOrThrow(snapshot, command);
  });

  return { snapshot, beforeSettlement: beforeSettlement! };
}
