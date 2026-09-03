import careerSeasonRaw from './career-02-season.json';
import goldenRaw from './career-02-season.golden.json';
import type { Command, SeasonSummary, SimulationMode, StepSummary } from '@offside/domain';

/**
 * fixtures는 `@offside/engine-client`를 import할 수 없으므로(ADR-005: fixtures → domain, content만
 * 허용) `EngineCommand`를 여기서 다시 정의한다. engine-client의 `EngineCommand`와 구조가 같다.
 */
export type EngineCommand = Command & { commandId: string; expectedRevision: number };

type CareerSeasonFixtureJson = {
  rulesetVersion: string;
  contentPackVersion: string;
  startSeason: Record<SimulationMode, { simulationMode: SimulationMode; serviceSeasonId: string }>;
  commands: Record<SimulationMode, Array<{ type: Command['type']; payload: unknown }>>;
};

type GoldenPerMode = {
  revision: number;
  stateHash: string;
  rngStateDraws: number;
  age: number;
  seasonHistory: SeasonSummary[];
  checkpoints: string[];
  stepSummaries: Array<{ index: number; summary: StepSummary | null }>;
};

type GoldenJson = Record<SimulationMode, GoldenPerMode>;

const fixtureJson = careerSeasonRaw as CareerSeasonFixtureJson;

export const career02Season = {
  rulesetVersion: fixtureJson.rulesetVersion,
  contentPackVersion: fixtureJson.contentPackVersion,
  startSeason: fixtureJson.startSeason,
  commands: fixtureJson.commands,
  golden: goldenRaw as GoldenJson,
};

/**
 * `career01EngineCommands()`가 만든 명령 뒤에 이어 붙이는 START_SEASON → ADVANCE/RESOLVE_EVENT… →
 * SETTLE_SEASON 명령 목록. `startExpectedRevision`은 이 시즌 명령 앞에 이미 적용된 마지막 revision
 * (career-01 golden 기준 10)이다.
 */
export function career02SeasonEngineCommands(
  mode: SimulationMode,
  newId: () => string,
  startExpectedRevision: number,
): EngineCommand[] {
  const startCommand: EngineCommand = {
    type: 'START_SEASON',
    commandId: newId(),
    expectedRevision: startExpectedRevision,
    payload: career02Season.startSeason[mode],
  };

  const rest = career02Season.commands[mode].map(
    (rawCommand, index) =>
      ({
        ...(rawCommand as Command),
        commandId: newId(),
        expectedRevision: startExpectedRevision + 1 + index,
      }) as EngineCommand,
  );

  return [startCommand, ...rest];
}
