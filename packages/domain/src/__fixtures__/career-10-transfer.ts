import careerFixtureRaw from './career-10-transfer.json';
import { rulesetProto } from './career-01.js';
import type { Command, SimulationResult } from '../simulate.js';
import { simulate } from '../simulate.js';
import type { DomainSnapshot, SimulationMode } from '../types.js';

export type TransferFixture = {
  rulesetVersion: string;
  contentPackVersion: string;
  createCareer: { careerId: string; seed: string; simulationMode: SimulationMode };
  commands: Array<{ type: Command['type']; payload: unknown }>;
};

export const careerTransferFixture = careerFixtureRaw as TransferFixture;
export { rulesetProto };

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
    rulesetVersion: careerTransferFixture.rulesetVersion,
    contentPackVersion: careerTransferFixture.contentPackVersion,
  });
  if (!result.ok) {
    throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

export type TransferFixtureRun = { snapshot: DomainSnapshot };

/**
 * T-3-003 §8: 첫 계약 1시즌(`offerRules.lengthSeasons` min) → 시즌 1 완주(step 7 RENEWAL 제안은
 * `REJECT_OFFER(null)`로 그대로 이어간다) → 결산(EXPIRED 시장, 계약 잔여 0) → 안전 잔류가 아닌
 * 제안(FREE_AGENT)에 `NEGOTIATE(WAGE)`(성공 COUNTERED, 이 시드가 주는 대로) → `ACCEPT_OFFER`(FREE_AGENT,
 * §4 TRANSFER·FREE_AGENT 분기) → 새 구단에서 시즌 2 완주·결산(시드 특성상 결산 뒤 시장은 열리지 않는다)
 * → 시즌 3 시작까지(seed `t10-search-1`, 탐색 근거: `career-10-transfer.json`과 같은 첫 계약 이벤트
 * 템플릿을 고정하고 seed 접미사만 1부터 순차 탐색해 첫 시도에서 조건을 모두 만족했다).
 */
export function runTransferFixture(): TransferFixtureRun {
  const createCommand: Command & { commandId: string; expectedRevision: number } = {
    type: 'CREATE_CAREER',
    commandId: 'transfer-create',
    expectedRevision: 0,
    payload: {
      careerId: careerTransferFixture.createCareer.careerId,
      seed: careerTransferFixture.createCareer.seed,
      simulationMode: careerTransferFixture.createCareer.simulationMode,
      rulesetVersion: careerTransferFixture.rulesetVersion,
      contentPackVersion: careerTransferFixture.contentPackVersion,
    },
  };

  const result = simulate({
    snapshot: null,
    command: createCommand,
    ruleset: rulesetProto,
    rulesetVersion: careerTransferFixture.rulesetVersion,
    contentPackVersion: careerTransferFixture.contentPackVersion,
  });
  if (!result.ok) {
    throw new Error(`CREATE_CAREER 실패: ${result.error.code} ${result.error.message}`);
  }
  let snapshot = result.snapshot;

  careerTransferFixture.commands.forEach((rawCommand, index) => {
    snapshot = runOrThrow(snapshot, buildCommand(rawCommand.type, `transfer-${index + 1}`, snapshot.revision, rawCommand.payload));
  });

  return { snapshot };
}
