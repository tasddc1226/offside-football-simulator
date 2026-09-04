import careerDfRaw from './career-07-df.json';
import seasonRaw from './career-07-df-season.json';
import { runCareerFixture, rulesetProto, type CareerFixture } from './career-01.js';
import type { Command, SimulationResult } from '../simulate.js';
import { simulate } from '../simulate.js';
import type { CompetitionRecord, DomainSnapshot, MatchRecord, SeasonPlayerStats } from '../types.js';

export const careerDfFixture = careerDfRaw as CareerFixture;

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
    rulesetVersion: careerDfFixture.rulesetVersion,
    contentPackVersion: careerDfFixture.contentPackVersion,
  });
  if (!result.ok) {
    throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

/**
 * T-3-003 §5: 이 fixture의 첫 계약이 룰셋 min(1시즌)으로 뽑혀 step 7이 재계약 사전 협상(CONTRACT,
 * 제안 있음)을 연다. 더 이상 ADVANCE로 자동 통과하지 않으므로(응답 필수) 재계약 없이 시즌을 그대로
 * 이어가는 `REJECT_OFFER(null)`로 자동 응답한다(revision +1, golden도 이 값을 반영한다).
 */
function autoRejectContractIfOpen(snapshot: DomainSnapshot): DomainSnapshot {
  const pending = snapshot.state.pending;
  if (pending !== null && pending.kind === 'CONTRACT' && pending.offers.length > 0) {
    return runOrThrow(
      snapshot,
      buildCommand('REJECT_OFFER', `df-auto-reject-${snapshot.revision}`, snapshot.revision, { offerId: null }),
    );
  }
  return snapshot;
}

export type DfFixtureRun = {
  snapshot: DomainSnapshot;
  /** SETTLE_SEASON 직전(season이 null이 되기 전) 경기·시즌 통계·대회 기록 스냅샷. 브리프 1번: DF
   * 포지션군(CB) 시즌 완주 골든과 0분·교체·퇴장·부상 집계 근거(season-aggregation.test.ts가
   * `runDfFixture().snapshot`의 이전 상태 대신 이 스냅샷의 `matches`를 직접 쓰지 않고, 시즌 진행
   * 중 캡처한 `beforeSettlement`와 별도로 `matches`를 노출한다). */
  beforeSettlement: {
    matchesPlayed: number;
    playerStats: SeasonPlayerStats;
    averageRatingTenths: number | null;
    competitions: CompetitionRecord[];
    matches: MatchRecord[];
  };
};

/**
 * T-2-011 1번: CB 아키타입(`cb-stopper`) 선수가 계약(`career-07-df.json`)한 뒤 FAST 시즌 전체를
 * 치른다(`career-07-df-season.json`, seed `df-search-cb-stopper-17` — `cb-stopper-1`부터 순차 탐색해
 * 17번째로 0분(UNUSED_SUB·INJURY)·교체 투입·교체 아웃·퇴장(레드+SUSPENSION 결장)·부상 이탈+복귀가
 * 모두 한 시즌 안에 나온 seed). DF 전용 통계(tackles·interceptions·aerialsWon·goalsConcededInvolved·
 * cleanSheet)를 고정한다.
 */
export function runDfFixture(): DfFixtureRun {
  let snapshot = runCareerFixture(careerDfFixture);

  snapshot = autoRejectContractIfOpen(
    runOrThrow(snapshot, buildCommand('START_SEASON', 'df-season-start', snapshot.revision, seasonCommandLog.startSeason)),
  );

  let beforeSettlement: DfFixtureRun['beforeSettlement'] | null = null;

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
    const command = buildCommand(rawCommand.type, `df-season-${index}`, snapshot.revision, rawCommand.payload);
    snapshot = autoRejectContractIfOpen(runOrThrow(snapshot, command));
  });

  return { snapshot, beforeSettlement: beforeSettlement! };
}
