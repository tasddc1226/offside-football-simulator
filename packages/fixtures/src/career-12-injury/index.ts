import careerRaw from './career-12-injury.json';
import goldenRaw from './career-12-injury.golden.json';
import seasonRaw from './career-12-injury-season.json';
import type { Command, InjuryEpisode, SimulationMode } from '@offside/domain';

/** fixtures는 engine-client를 import할 수 없으므로 domain Command 형태만 재사용한다. */
export type EngineCommand = Command & { commandId: string; expectedRevision: number };

type CareerFixtureJson = {
  rulesetVersion: string;
  contentPackVersion: string;
  createCareer: { careerId: string; seed: string; simulationMode: SimulationMode };
  commands: Array<{ type: Command['type']; payload: unknown }>;
};

type SeasonCommandLogJson = {
  startSeason: { simulationMode: SimulationMode; serviceSeasonId: string };
  commands: Array<{ type: Command['type']; payload: unknown }>;
};

type GoldenJson = {
  revision: number;
  stateHash: string;
  rngStateDraws: number;
  age: number;
  seasonHistoryLength: number;
  episodes: Array<Pick<InjuryEpisode, 'id' | 'severity' | 'bodyPart' | 'status' | 'rehab' | 'recurrenceChecksRemaining' | 'permanentDelta'>>;
};

const careerJson = careerRaw as CareerFixtureJson;
const seasonJson = seasonRaw as SeasonCommandLogJson;

export const career12Injury = {
  rulesetVersion: careerJson.rulesetVersion,
  contentPackVersion: careerJson.contentPackVersion,
  createCareer: careerJson.createCareer,
  commands: careerJson.commands,
  startSeason: seasonJson.startSeason,
  seasonCommands: seasonJson.commands,
  golden: goldenRaw as GoldenJson,
};

export function career12InjuryEngineCommands(newId: () => string): EngineCommand[] {
  const createCommand: EngineCommand = {
    type: 'CREATE_CAREER',
    commandId: newId(),
    expectedRevision: 0,
    payload: {
      careerId: career12Injury.createCareer.careerId,
      seed: career12Injury.createCareer.seed,
      simulationMode: career12Injury.createCareer.simulationMode,
      rulesetVersion: career12Injury.rulesetVersion,
      contentPackVersion: career12Injury.contentPackVersion,
    },
  };

  const careerCommands = career12Injury.commands.map(
    (rawCommand, index) =>
      ({ ...rawCommand, commandId: newId(), expectedRevision: index + 1 }) as EngineCommand,
  );
  const startCommand: EngineCommand = {
    type: 'START_SEASON',
    commandId: newId(),
    expectedRevision: careerCommands.length + 1,
    payload: career12Injury.startSeason,
  };
  const seasonCommands = career12Injury.seasonCommands.map(
    (rawCommand, index) =>
      ({ ...rawCommand, commandId: newId(), expectedRevision: careerCommands.length + 2 + index }) as EngineCommand,
  );
  return [createCommand, ...careerCommands, startCommand, ...seasonCommands];
}
