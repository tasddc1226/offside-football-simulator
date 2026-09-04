import careerFixtureRaw from './career-03-underdog.json';
import seasonRaw from './career-03-underdog-season.json';
import { runCareerFixture, rulesetProto, type CareerFixture } from './career-01.js';
import type { Command, SimulationResult } from '../simulate.js';
import { simulate } from '../simulate.js';
import type { ConditionState } from '../condition.js';
import { familiarityOf } from '../selection.js';
import type { Competitor, DomainSnapshot, MatchRecord, Position, SeasonPlayerStats, SquadRole } from '../types.js';

export const careerUnderdogFixture = careerFixtureRaw as CareerFixture;
export { rulesetProto };

type SeasonCommandLog = {
  commands: Array<{ type: Command['type']; payload: unknown }>;
};

const underdogSeasonLog = seasonRaw as SeasonCommandLog;

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
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
  });
  if (!result.ok) {
    throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

/**
 * T-3-003 §5: 이 fixture의 첫 계약이 룰셋 min(1시즌)으로 뽑혀 시즌 중 step 7이 재계약 사전 협상
 * (CONTRACT, 제안 있음)을 연다. 더 이상 ADVANCE로 자동 통과하지 않으므로(응답 필수) 재계약 없이
 * 시즌을 그대로 이어가는 `REJECT_OFFER(null)`로 자동 응답한다.
 */
function autoRejectContractIfOpen(snapshot: DomainSnapshot): DomainSnapshot {
  const pending = snapshot.state.pending;
  if (pending !== null && pending.kind === 'CONTRACT' && pending.offers.length > 0) {
    return runOrThrow(
      snapshot,
      buildCommand('REJECT_OFFER', `underdog-auto-reject-${snapshot.revision}`, snapshot.revision, { offerId: null }),
    );
  }
  return snapshot;
}

/** T-2-011 4번 shadow-replay가 rankPositionForPlayer를 다시 부르는 데 필요한, RESOLVE_ROLE 직후(첫
 * ADVANCE 전) 시즌 내내 고정되는 입력값. tacticalFit·managerTrust·positionProficiency·baseOvr·
 * rolePromise(계약 값, RESOLVE_ROLE이 건드리지 않는다)·competitors(시즌 시작 시 1회 생성, 이후 form만
 * 드리프트)는 이 시점 이후 시즌이 끝날 때까지 변하지 않는다(선수 본인 폼·체력·사기·squadStatus만
 * step·경기마다 갱신된다 — season.matches로 재구성한다). */
export type UnderdogFixedInputs = {
  styleId: string;
  position: Position;
  playerName: string;
  baseOvr: number;
  tacticalFit: number;
  managerTrust: number;
  familiarity: number;
  rolePromiseForSquadStatus: SquadRole;
  /** RESOLVE_ROLE(ROLE_CHANGE)이 계산한 시즌 첫 경기용 squadStatus(계약 rolePromise가 아니라 제안
   * 수락 결과 기준 — 두 번째 경기부터는 매 경기 `rolePromiseForSquadStatus` 기준으로 다시 계산된다). */
  initialSquadStatus: number;
  initialCondition: ConditionState;
  initialCompetitors: readonly Competitor[];
};

export type UnderdogSeasonRun = {
  snapshot: DomainSnapshot;
  fixedInputs: UnderdogFixedInputs;
  beforeSettlement: {
    matchesPlayed: number;
    playerStats: SeasonPlayerStats;
    averageRatingTenths: number | null;
    matches: MatchRecord[];
  };
};

/** career-03-underdog(이미 명령 로그 마지막이 START_SEASON이라 활성 시즌 상태로 끝난다)을 이어서 새
 * season 명령 로그(RESOLVE_ROLE ACCEPT → ADVANCE ×2 → SETTLE_SEASON)로 끝까지 돌린다. RESOLVE_ROLE
 * 직후 스냅샷에서 shadow-replay용 고정 입력을 뽑아 함께 돌려준다. */
export function runUnderdogSeasonFixture(): UnderdogSeasonRun {
  let snapshot = runCareerFixture(careerUnderdogFixture);

  let fixedInputs: UnderdogFixedInputs | null = null;
  let beforeSettlement: UnderdogSeasonRun['beforeSettlement'] | null = null;

  underdogSeasonLog.commands.forEach((rawCommand, index) => {
    if (rawCommand.type === 'RESOLVE_ROLE') {
      snapshot = autoRejectContractIfOpen(
        runOrThrow(snapshot, buildCommand(rawCommand.type, `underdog-season-${index}`, snapshot.revision, rawCommand.payload)),
      );
      const state = snapshot.state;
      const profile = state.player.profile;
      const season = state.season;
      if (profile === null || season === null) {
        throw new RangeError('runUnderdogSeasonFixture: RESOLVE_ROLE 직후 profile 또는 season이 null이다.');
      }
      fixedInputs = {
        styleId: season.styleId,
        position: profile.primaryPosition,
        playerName: profile.name,
        baseOvr: profile.baseOvr,
        tacticalFit: state.context.tacticalFit,
        managerTrust: state.relationships.managerTrust,
        familiarity: familiarityOf(state.context.positionProficiency, rulesetProto.selectionRules),
        rolePromiseForSquadStatus: state.contract!.rolePromise,
        initialSquadStatus: state.context.squadStatus,
        initialCondition: { form: state.state.form, fitness: state.state.fitness, morale: state.state.morale },
        initialCompetitors: season.squad.competitors,
      };
      return;
    }
    if (rawCommand.type === 'SETTLE_SEASON') {
      const season = snapshot.state.season!;
      beforeSettlement = {
        matchesPlayed: season.matches.length,
        playerStats: season.playerStats,
        averageRatingTenths:
          season.playerStats.ratedMatches > 0
            ? Math.round(season.playerStats.ratingSumTenths / season.playerStats.ratedMatches)
            : null,
        matches: season.matches,
      };
    }
    snapshot = autoRejectContractIfOpen(
      runOrThrow(snapshot, buildCommand(rawCommand.type, `underdog-season-${index}`, snapshot.revision, rawCommand.payload)),
    );
  });

  if (fixedInputs === null || beforeSettlement === null) {
    throw new RangeError('runUnderdogSeasonFixture: RESOLVE_ROLE 또는 SETTLE_SEASON 지점을 찾지 못했다.');
  }
  return { snapshot, fixedInputs, beforeSettlement };
}
