import careerRaw from './career-11-loan.json';
import goldenRaw from './career-11-loan.golden.json';
import type { CheckpointType, Command, ContractKind, SimulationMode } from '@offside/domain';

/**
 * fixtures는 `@offside/engine-client`를 import할 수 없으므로(ADR-005: fixtures → domain, content만
 * 허용) `EngineCommand`를 여기서 다시 정의한다. engine-client의 `EngineCommand`와 구조가 같다.
 */
export type EngineCommand = Command & { commandId: string; expectedRevision: number };

type CareerFixtureJson = {
  rulesetVersion: string;
  contentPackVersion: string;
  createCareer: { careerId: string; seed: string; simulationMode: SimulationMode };
  commands: Array<{ type: Command['type']; payload: unknown }>;
};

type GoldenJson = {
  revision: number;
  stateHash: string;
  checkpoint: CheckpointType;
  rngStateDraws: number;
  age: number;
  seasonHistoryLength: number;
  contract: { id: string; teamId: string; leagueTier: 'YOUTH' | 1 | 2 | 3; kind: ContractKind; lengthSeasons: number; suspended: boolean };
  clubHistory: Array<{ teamId: string; kind: ContractKind; fromSeasonIndex: number; toSeasonIndex: number | null; endReason: string | null; contractId?: string }>;
};

const fixtureJson = careerRaw as CareerFixtureJson;

/**
 * T-3-003 §8 골든 2: 첫 계약 3시즌 → 시즌1 완주·결산(INTEREST 시장, LOAN 제안) → ACCEPT_OFFER(LOAN) →
 * 임대 구단 시즌2 완주·결산(parentRemaining>0 → LOAN_RETURN pending) → LOAN_RETURN({decision:'RETURN'})
 * → 시즌3(원소속) 시작까지. career-01과 같은 형태의 독립 시나리오다.
 */
export const career11Loan = {
  rulesetVersion: fixtureJson.rulesetVersion,
  contentPackVersion: fixtureJson.contentPackVersion,
  createCareer: fixtureJson.createCareer,
  commands: fixtureJson.commands,
  golden: goldenRaw as GoldenJson,
};

export function career11LoanEngineCommands(newId: () => string): EngineCommand[] {
  const createCommand: EngineCommand = {
    type: 'CREATE_CAREER',
    commandId: newId(),
    expectedRevision: 0,
    payload: {
      careerId: career11Loan.createCareer.careerId,
      seed: career11Loan.createCareer.seed,
      simulationMode: career11Loan.createCareer.simulationMode,
      rulesetVersion: career11Loan.rulesetVersion,
      contentPackVersion: career11Loan.contentPackVersion,
    },
  };

  const rest = career11Loan.commands.map(
    (rawCommand, index) =>
      ({
        ...(rawCommand as Command),
        commandId: newId(),
        expectedRevision: index + 1,
      }) as EngineCommand,
  );

  return [createCommand, ...rest];
}
