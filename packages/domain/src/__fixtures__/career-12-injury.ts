import careerRaw from './career-12-injury.json';
import seasonRaw from './career-12-injury-season.json';
import { runCareerFixture, rulesetProto, type CareerFixture } from './career-01.js';
import type { Command, SimulationResult } from '../simulate.js';
import { simulate } from '../simulate.js';
import type { DomainSnapshot, MatchRecord, SeasonPlayerStats } from '../types.js';

export const careerInjuryFixture = careerRaw as CareerFixture;

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
    rulesetVersion: careerInjuryFixture.rulesetVersion,
    contentPackVersion: careerInjuryFixture.contentPackVersion,
  });
  if (!result.ok) {
    throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

export type InjuryFixtureRun = {
  snapshot: DomainSnapshot;
  beforeSettlement: {
    matchesPlayed: number;
    playerStats: SeasonPlayerStats;
    matches: MatchRecord[];
  };
};

/**
 * T-4-002 §4 seed 탐색 결과(`career-12-fixed-search-59`): 실제 1.0.0 룰셋으로 첫 MODERATE 부상과
 * 재활(STANDARD)을 거친 뒤 RECOVERED 상태에서 같은 부위 MAJOR 재발까지 한 시즌 안에
 * 재생한다. 탐색은 테스트에 넣지 않고 이 고정 seed와 명령 log만 fixture로 남긴다.
 */
export function runInjuryFixture(): InjuryFixtureRun {
  let snapshot = runCareerFixture(careerInjuryFixture);
  snapshot = runOrThrow(snapshot, buildCommand('START_SEASON', 'injury-season-start', snapshot.revision, seasonCommandLog.startSeason));

  let beforeSettlement: InjuryFixtureRun['beforeSettlement'] | null = null;
  seasonCommandLog.commands.forEach((rawCommand, index) => {
    if (rawCommand.type === 'SETTLE_SEASON') {
      const season = snapshot.state.season!;
      beforeSettlement = { matchesPlayed: season.matches.length, playerStats: season.playerStats, matches: season.matches };
    }
    snapshot = runOrThrow(snapshot, buildCommand(rawCommand.type, `injury-season-${index}`, snapshot.revision, rawCommand.payload));
  });

  return { snapshot, beforeSettlement: beforeSettlement! };
}
