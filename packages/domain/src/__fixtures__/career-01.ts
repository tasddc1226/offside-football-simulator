import careerFixtureRaw from './career-01.json';
import type { Command, SimulationResult } from '../simulate.js';
import { simulate } from '../simulate.js';
import type { AttributeKey, CareerStage, DomainSnapshot, SimulationMode } from '../types.js';

type CareerFixture = {
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

export const careerFixture = careerFixtureRaw as CareerFixture;

/**
 * career-01 fixture(CREATE_CAREER + 12개 명령)을 순서대로 실행해 최종 DomainSnapshot을 돌려준다.
 * 매 실행마다 새 commandId를 쓰지만 payload와 명령 순서는 fixture와 동일하므로 결과는 항상 같다.
 */
export function runCareerFixture(fixture: CareerFixture = careerFixture): DomainSnapshot {
  const createCommand: Command & { commandId: string; expectedRevision: number } = {
    type: 'CREATE_CAREER',
    commandId: 'fixture-create',
    expectedRevision: 0,
    payload: {
      careerId: fixture.createCareer.careerId,
      seed: fixture.createCareer.seed,
      stage: fixture.createCareer.stage,
      age: fixture.createCareer.age,
      attributes: fixture.createCareer.attributes,
      state: fixture.createCareer.state,
      context: fixture.createCareer.context,
      relationships: fixture.createCareer.relationships,
      simulationMode: fixture.createCareer.simulationMode,
      rulesetVersion: fixture.rulesetVersion,
      contentPackVersion: fixture.contentPackVersion,
    },
  };

  let result: SimulationResult = simulate({
    snapshot: null,
    command: createCommand,
    rulesetVersion: fixture.rulesetVersion,
    contentPackVersion: fixture.contentPackVersion,
  });
  if (!result.ok) {
    throw new Error(`CREATE_CAREER 실패: ${result.error.code} ${result.error.message}`);
  }
  let snapshot = result.snapshot;

  fixture.commands.forEach((rawCommand, index) => {
    const command = {
      ...(rawCommand as Command),
      commandId: `fixture-${index + 1}`,
      expectedRevision: snapshot.revision,
    } as Command & { commandId: string; expectedRevision: number };

    result = simulate({
      snapshot,
      command,
      rulesetVersion: fixture.rulesetVersion,
      contentPackVersion: fixture.contentPackVersion,
    });
    if (!result.ok) {
      throw new Error(`명령 ${index + 1}(${command.type}) 실패: ${result.error.code} ${result.error.message}`);
    }
    snapshot = result.snapshot;
  });

  return snapshot;
}
