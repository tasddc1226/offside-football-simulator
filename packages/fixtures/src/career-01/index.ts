import careerRaw from './career-01.json';
import goldenRaw from './career-01.golden.json';
import rulesetProtoRaw from './ruleset-proto.json';
import type { AttributeKey, Command, Ruleset, SimulationMode } from '@offside/domain';

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
  rngStateDraws: number;
  baseOvr: number;
  attributes: Record<AttributeKey, number>;
  scoutedPotential: { min: number; max: number };
};

const fixtureJson = careerRaw as CareerFixtureJson;

export const career01 = {
  rulesetVersion: fixtureJson.rulesetVersion,
  contentPackVersion: fixtureJson.contentPackVersion,
  createCareer: fixtureJson.createCareer,
  commands: fixtureJson.commands,
  golden: goldenRaw as GoldenJson,
};

/** T-1-001 `src/__fixtures__/ruleset-proto.json`과 같은 내용의 최소 테스트 룰셋. */
export const rulesetProto = rulesetProtoRaw as Ruleset;

/** CREATE_CAREER + UPDATE_PLAYER_DRAFT×2 + CONFIRM_PLAYER + ADVANCE/RESOLVE_EVENT×2. */
export function career01EngineCommands(newId: () => string): EngineCommand[] {
  const createCommand: EngineCommand = {
    type: 'CREATE_CAREER',
    commandId: newId(),
    expectedRevision: 0,
    payload: {
      careerId: career01.createCareer.careerId,
      seed: career01.createCareer.seed,
      simulationMode: career01.createCareer.simulationMode,
      rulesetVersion: career01.rulesetVersion,
      contentPackVersion: career01.contentPackVersion,
    },
  };

  const rest = career01.commands.map(
    (rawCommand, index) =>
      ({
        ...(rawCommand as Command),
        commandId: newId(),
        expectedRevision: index + 1,
      }) as EngineCommand,
  );

  return [createCommand, ...rest];
}
