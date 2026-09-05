import careerRaw from './career-13-integration.json';
import goldenRaw from './career-13-integration.golden.json';
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
  seasonHistoryLength: number;
  seasonResultHashes: string[];
  clubHistory: Array<{ teamId: string; kind: ContractKind; fromSeasonIndex: number; toSeasonIndex: number | null; endReason: string | null; contractId?: string }>;
  clubHistoryLength: number;
  healthEpisodesCount: number;
  careerTags: string[];
};

const fixtureJson = careerRaw as CareerFixtureJson;

/**
 * T-4-006 §1 골든: Phase 3·4 통합 검증용 3시즌 career fixture(첫 계약 → 시즌1 MODERATE 부상·감독
 * 교체 → tier1→tier2 이적 → 시즌2(EVT-REL-010) → 시즌3 재계약 협상). domain __fixtures__와 같은
 * 원본을 그대로 복제한다(fixtures.test.ts가 드리프트를 확인).
 */
export const career13Integration = {
  rulesetVersion: fixtureJson.rulesetVersion,
  contentPackVersion: fixtureJson.contentPackVersion,
  createCareer: fixtureJson.createCareer,
  commands: fixtureJson.commands,
  golden: goldenRaw as GoldenJson,
};

export function career13IntegrationEngineCommands(newId: () => string): EngineCommand[] {
  const createCommand: EngineCommand = {
    type: 'CREATE_CAREER',
    commandId: newId(),
    expectedRevision: 0,
    payload: {
      careerId: career13Integration.createCareer.careerId,
      seed: career13Integration.createCareer.seed,
      simulationMode: career13Integration.createCareer.simulationMode,
      rulesetVersion: career13Integration.rulesetVersion,
      contentPackVersion: career13Integration.contentPackVersion,
    },
  };

  const rest = career13Integration.commands.map(
    (rawCommand, index) =>
      ({
        ...(rawCommand as Command),
        commandId: newId(),
        expectedRevision: index + 1,
      }) as EngineCommand,
  );

  return [createCommand, ...rest];
}
