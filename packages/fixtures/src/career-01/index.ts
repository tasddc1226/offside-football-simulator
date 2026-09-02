import careerRaw from './career-01.json';
import goldenRaw from './career-01.golden.json';
import type { AttributeKey, CareerStage, Command, SimulationMode } from '@offside/domain';

/**
 * fixtures는 `@offside/engine-client`를 import할 수 없으므로(ADR-005: fixtures → domain, content만
 * 허용) `EngineCommand`를 여기서 다시 정의한다. engine-client의 `EngineCommand`와 구조가 같다.
 */
export type EngineCommand = Command & { commandId: string; expectedRevision: number };

type CareerFixtureJson = {
  rulesetVersion: string;
  contentPackVersion: string;
  createCareer: {
    careerId: string;
    seed: string;
    stage: CareerStage;
    age: number;
    simulationMode: SimulationMode;
    attributes: Record<AttributeKey, number>;
    state: { form: number; fitness: number; morale: number };
    context: { tacticalFit: number; squadStatus: number; positionProficiency: number };
    relationships: { managerTrust: number; captain: number; rival: number; fans: number; agent: number };
  };
  commands: Array<{ type: Command['type']; payload: unknown }>;
};

type GoldenJson = { revision: number; stateHash: string; rngStateDraws: number };

const fixtureJson = careerRaw as CareerFixtureJson;

export const career01 = {
  rulesetVersion: fixtureJson.rulesetVersion,
  contentPackVersion: fixtureJson.contentPackVersion,
  createCareer: fixtureJson.createCareer,
  commands: fixtureJson.commands,
  golden: goldenRaw as GoldenJson,
};

/** CREATE_CAREER + 12개 명령. `expectedRevision`은 0부터 연속이다. */
export function career01EngineCommands(newId: () => string): EngineCommand[] {
  const createCommand: EngineCommand = {
    type: 'CREATE_CAREER',
    commandId: newId(),
    expectedRevision: 0,
    payload: {
      careerId: career01.createCareer.careerId,
      seed: career01.createCareer.seed,
      stage: career01.createCareer.stage,
      age: career01.createCareer.age,
      attributes: career01.createCareer.attributes,
      state: career01.createCareer.state,
      context: career01.createCareer.context,
      relationships: career01.createCareer.relationships,
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
