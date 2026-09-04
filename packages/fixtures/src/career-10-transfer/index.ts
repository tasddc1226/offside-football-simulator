import careerRaw from './career-10-transfer.json';
import goldenRaw from './career-10-transfer.golden.json';
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
  contract: { id: string; teamId: string; leagueTier: 'YOUTH' | 1 | 2 | 3; kind: ContractKind; lengthSeasons: number };
  clubHistory: Array<{ teamId: string; kind: ContractKind; fromSeasonIndex: number; toSeasonIndex: number | null; endReason: string | null }>;
  tags: string[];
};

const fixtureJson = careerRaw as CareerFixtureJson;

/**
 * T-3-003 §8 골든 1: 첫 계약 1시즌(min) → 시즌1 완주(step 7 RENEWAL은 REJECT_OFFER(null)) → 결산
 * (EXPIRED 시장) → NEGOTIATE(LENGTH, COUNTERED) → ACCEPT_OFFER(FREE_AGENT) → 새 구단 시즌2 완주·결산·관심 시장 거절 →
 * 시즌3 시작까지. career-01과 같은 형태(자체 CREATE_CAREER + UPDATE_PLAYER_DRAFT×2 + CONFIRM_PLAYER +
 * ACCEPT_OFFER + START_SEASON…)의 독립 시나리오다.
 */
export const career10Transfer = {
  rulesetVersion: fixtureJson.rulesetVersion,
  contentPackVersion: fixtureJson.contentPackVersion,
  createCareer: fixtureJson.createCareer,
  commands: fixtureJson.commands,
  golden: goldenRaw as GoldenJson,
};

export function career10TransferEngineCommands(newId: () => string): EngineCommand[] {
  const createCommand: EngineCommand = {
    type: 'CREATE_CAREER',
    commandId: newId(),
    expectedRevision: 0,
    payload: {
      careerId: career10Transfer.createCareer.careerId,
      seed: career10Transfer.createCareer.seed,
      simulationMode: career10Transfer.createCareer.simulationMode,
      rulesetVersion: career10Transfer.rulesetVersion,
      contentPackVersion: career10Transfer.contentPackVersion,
    },
  };

  const rest = career10Transfer.commands.map(
    (rawCommand, index) =>
      ({
        ...(rawCommand as Command),
        commandId: newId(),
        expectedRevision: index + 1,
      }) as EngineCommand,
  );

  return [createCommand, ...rest];
}
