import careerFixtureRaw from './career-01.json';
import rulesetProtoRaw from './ruleset-proto.json';
import type { Command, SimulationResult } from '../simulate.js';
import { simulate } from '../simulate.js';
import type { DomainSnapshot, SimulationMode } from '../types.js';
import type { Ruleset } from '../ruleset.js';

type CareerFixture = {
  rulesetVersion: string;
  contentPackVersion: string;
  createCareer: { careerId: string; seed: string; simulationMode: SimulationMode };
  commands: Array<{ type: Command['type']; payload: unknown }>;
};

export const careerFixture = careerFixtureRaw as CareerFixture;
export const rulesetProto = rulesetProtoRaw as Ruleset;

/**
 * career-01 fixture(CREATE_CAREER + UPDATE_PLAYER_DRAFT×2 + CONFIRM_PLAYER + ADVANCE/RESOLVE_EVENT×2)를
 * 순서대로 실행해 최종 DomainSnapshot을 돌려준다. 매 실행마다 새 commandId를 쓰지만 payload와
 * 명령 순서는 fixture와 동일하므로 결과는 항상 같다.
 */
export function runCareerFixture(fixture: CareerFixture = careerFixture, ruleset: Ruleset = rulesetProto): DomainSnapshot {
  const createCommand: Command & { commandId: string; expectedRevision: number } = {
    type: 'CREATE_CAREER',
    commandId: 'fixture-create',
    expectedRevision: 0,
    payload: {
      careerId: fixture.createCareer.careerId,
      seed: fixture.createCareer.seed,
      simulationMode: fixture.createCareer.simulationMode,
      rulesetVersion: fixture.rulesetVersion,
      contentPackVersion: fixture.contentPackVersion,
    },
  };

  let result: SimulationResult = simulate({
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
    const command = {
      ...(rawCommand as Command),
      commandId: `fixture-${index + 1}`,
      expectedRevision: snapshot.revision,
    } as Command & { commandId: string; expectedRevision: number };

    result = simulate({
      snapshot,
      command,
      ruleset,
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
