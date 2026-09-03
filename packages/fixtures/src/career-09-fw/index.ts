import careerRaw from './career-09-fw.json';
import seasonRaw from './career-09-fw-season.json';
import goldenRaw from './career-09-fw.golden.json';
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

export const career09Fw = {
  rulesetVersion: careerJson.rulesetVersion,
  contentPackVersion: careerJson.contentPackVersion,
  createCareer: careerJson.createCareer,
  commands: careerJson.commands,
  startSeason: seasonJson.startSeason,
  seasonCommands: seasonJson.commands,
  golden: goldenRaw as GoldenJson,
};

/**
 * T-2-011 1번: FW 포지션군(ST 아키타입 `st-poacher`) fixture. career-04-gk와 같은 형태(자체
 * CREATE_CAREER + UPDATE_PLAYER_DRAFT×2 + CONFIRM_PLAYER + ACCEPT_OFFER)에 이어 START_SEASON부터
 * SETTLE_SEASON까지(FAST)를 한 번에 잇는다.
 */
export function career09FwEngineCommands(newId: () => string): EngineCommand[] {
  const createCommand: EngineCommand = {
    type: 'CREATE_CAREER',
    commandId: newId(),
    expectedRevision: 0,
    payload: {
      careerId: career09Fw.createCareer.careerId,
      seed: career09Fw.createCareer.seed,
      simulationMode: career09Fw.createCareer.simulationMode,
      rulesetVersion: career09Fw.rulesetVersion,
      contentPackVersion: career09Fw.contentPackVersion,
    },
  };

  const careerCommands = career09Fw.commands.map(
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
    payload: career09Fw.startSeason,
  };

  const seasonCommands = career09Fw.seasonCommands.map(
    (rawCommand, index) =>
      ({
        ...(rawCommand as Command),
        commandId: newId(),
        expectedRevision: careerCommands.length + 2 + index,
      }) as EngineCommand,
  );

  return [createCommand, ...careerCommands, startCommand, ...seasonCommands];
}
