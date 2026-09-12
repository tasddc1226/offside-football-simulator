import careerFixtureRaw from './career-11-loan.json';
import { rulesetProto } from './career-01.js';
import type { Command, SimulationResult } from '../simulate.js';
import { simulate } from '../simulate.js';
import type { DomainSnapshot, SimulationMode } from '../types.js';

export type LoanFixture = {
  rulesetVersion: string;
  contentPackVersion: string;
  createCareer: { careerId: string; seed: string; simulationMode: SimulationMode };
  commands: Array<{ type: Command['type']; payload: unknown }>;
};

export const careerLoanFixture = careerFixtureRaw as LoanFixture;
export { rulesetProto };

function buildCommand(
  type: Command['type'],
  commandId: string,
  expectedRevision: number,
  payload: unknown,
): Command & { commandId: string; expectedRevision: number } {
  return { type, commandId, expectedRevision, payload } as Command & { commandId: string; expectedRevision: number };
}

function runOrThrow(
  snapshot: DomainSnapshot,
  command: Command & { commandId: string; expectedRevision: number },
  ruleset: typeof rulesetProto = rulesetProto,
): DomainSnapshot {
  const result: SimulationResult = simulate({
    snapshot,
    command,
    ruleset,
    rulesetVersion: careerLoanFixture.rulesetVersion,
    contentPackVersion: careerLoanFixture.contentPackVersion,
  });
  if (!result.ok) {
    throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

export type LoanFixtureRun = { snapshot: DomainSnapshot };

export type RunLoanFixtureOptions = {
  /** 명령 로그를 잘라 중간 상태(예: LOAN_RETURN 직전)에서 멈춘다. 기본은 전체 재생. */
  fixture?: LoanFixture;
  /** 이슈 #148: 1.4.0 선택 키를 얹은 룰셋으로 같은 로그를 재생해 골든(키 없음)과 대조한다. */
  ruleset?: typeof rulesetProto;
};

/**
 * T-3-003 §8: 첫 계약 3시즌 → 시즌 1 완주·결산(계약 잔여 2, INTEREST 시장에 LOAN 제안 포함) →
 * `ACCEPT_OFFER`(LOAN, §4 LOAN 분기 — `parentContract` 보관) → 임대 구단에서 시즌 2 완주·결산
 * (`parentRemaining` 1 → `LOAN_RETURN` pending) → `LOAN_RETURN({decision:'RETURN'})`(원소속 계약·
 * stint 복원) → 시즌 3(원소속) 시작까지(seed `t11-search-15`, 탐색 근거: career-10-transfer와 같은
 * 첫 계약 이벤트 템플릿을 고정하고 seed 접미사만 순차 탐색해 15번째로 "첫 계약 3시즌 + 시즌1 결산
 * INTEREST에 LOAN 제안 + 임대 시즌 결산 뒤 parentRemaining>0(LOAN_RETURN 발생)"을 모두 만족했다).
 *
 * 브리프 §8은 "첫 계약 2시즌"을 예시로 들지만, `computeContractSeasonsRemaining`은 임대 시즌의
 * SEASON_STARTED도 원소속 잔여를 소비한다(§6) — 2시즌 계약이면 임대 시즌 뒤 곧장 잔여 0(FA 시장)이 되어
 * `LOAN_RETURN` 분기 자체가 열리지 않는다. 이 골든의 실제 목적(D-46 LOAN_RETURN 3분기 중 RETURN 분기
 * 검증)을 살리기 위해 3시즌으로 잡았다 — PR 본문 "결정 필요"에 기록.
 */
export function runLoanFixture(options: RunLoanFixtureOptions = {}): LoanFixtureRun {
  const fixture = options.fixture ?? careerLoanFixture;
  const ruleset = options.ruleset ?? rulesetProto;
  const createCommand: Command & { commandId: string; expectedRevision: number } = {
    type: 'CREATE_CAREER',
    commandId: 'loan-create',
    expectedRevision: 0,
    payload: {
      careerId: fixture.createCareer.careerId,
      seed: fixture.createCareer.seed,
      simulationMode: fixture.createCareer.simulationMode,
      rulesetVersion: fixture.rulesetVersion,
      contentPackVersion: fixture.contentPackVersion,
    },
  };

  const result = simulate({
    snapshot: null,
    command: createCommand,
    ruleset,
    rulesetVersion: fixture.rulesetVersion,
    contentPackVersion: fixture.contentPackVersion,
  });
  if (!result.ok) {
    throw new Error(`CREATE_CAREER 실패: ${result.error.code} ${result.error.message}`);
  }
  let snapshot = result.snapshot;

  fixture.commands.forEach((rawCommand, index) => {
    snapshot = runOrThrow(snapshot, buildCommand(rawCommand.type, `loan-${index + 1}`, snapshot.revision, rawCommand.payload), ruleset);
  });

  return { snapshot };
}
