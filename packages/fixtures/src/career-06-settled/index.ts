import careerRaw from './career-06-settled.json';
import seasonRaw from './career-06-settled-season.json';
import goldenRaw from './career-06-settled.golden.json';
import type { Command, CompetitionRecord, SeasonPlayerStats, SeasonSummary, SimulationMode } from '@offside/domain';

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

type SeasonCommandLogJson = {
  startSeason: { simulationMode: SimulationMode; serviceSeasonId: string };
  commands: Array<{ type: Command['type']; payload: unknown }>;
};

type GoldenJson = {
  revision: number;
  stateHash: string;
  rngStateDraws: number;
  age: number;
  seasonHistory: SeasonSummary[];
  beforeSettlement: {
    matchesPlayed: number;
    playerStats: SeasonPlayerStats;
    averageRatingTenths: number | null;
    competitions: CompetitionRecord[];
  };
};

const careerJson = careerRaw as CareerFixtureJson;
const seasonJson = seasonRaw as SeasonCommandLogJson;

/**
 * T-2-005 D-39: `career-01`과 같은 seed(`offside-fixture-01`)로 만든 유스 첫 커리어(careerId만
 * 다르다 — seedRng는 seed만 쓰고 careerId는 쓰지 않는다)에, `career-02-season`의 FAST 시즌 명령
 * 로그를 그대로 이어 SETTLE_SEASON까지 간다. `seasonHistory[0].result`가 포함된, 다른 fixture와
 * 체이닝하지 않는 단일 독립 골든이 필요한 contracts golden 순회·api cross-runtime 해시 테스트용이다.
 */
export const career06Settled = {
  rulesetVersion: careerJson.rulesetVersion,
  contentPackVersion: careerJson.contentPackVersion,
  createCareer: careerJson.createCareer,
  commands: careerJson.commands,
  startSeason: seasonJson.startSeason,
  seasonCommands: seasonJson.commands,
  golden: goldenRaw as GoldenJson,
};

export function career06SettledEngineCommands(newId: () => string): EngineCommand[] {
  const createCommand: EngineCommand = {
    type: 'CREATE_CAREER',
    commandId: newId(),
    expectedRevision: 0,
    payload: {
      careerId: career06Settled.createCareer.careerId,
      seed: career06Settled.createCareer.seed,
      simulationMode: career06Settled.createCareer.simulationMode,
      rulesetVersion: career06Settled.rulesetVersion,
      contentPackVersion: career06Settled.contentPackVersion,
    },
  };

  const careerCommands = career06Settled.commands.map(
    (rawCommand, index) =>
      ({
        ...(rawCommand as Command),
        commandId: newId(),
        expectedRevision: index + 1,
      }) as EngineCommand,
  );

  const startCommand: EngineCommand = {
    type: 'START_SEASON',
    commandId: newId(),
    expectedRevision: careerCommands.length + 1,
    payload: career06Settled.startSeason,
  };

  const seasonCommands = career06Settled.seasonCommands.map(
    (rawCommand, index) =>
      ({
        ...(rawCommand as Command),
        commandId: newId(),
        expectedRevision: careerCommands.length + 2 + index,
      }) as EngineCommand,
  );

  return [createCommand, ...careerCommands, startCommand, ...seasonCommands];
}
