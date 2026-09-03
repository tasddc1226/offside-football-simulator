import careerRaw from './career-03-underdog.json';
import goldenRaw from './career-03-underdog.golden.json';
import type {
  CheckpointType,
  Command,
  Position,
  RoleProposal,
  SelectionAppearance,
  SimulationMode,
  SquadRole,
} from '@offside/domain';

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
  checkpoint: CheckpointType;
  baseOvr: number;
  contract: { id: string; teamId: string; leagueTier: 'YOUTH' | 1 | 2 | 3; rolePromise: SquadRole };
  season: { styleId: string; squadRole: SquadRole; competitorsCount: number };
  context: { tacticalFit: number; squadStatus: number; positionProficiency: number };
  pending: { kind: 'ROLE_PROPOSAL'; step: number; proposal: RoleProposal };
  selection: {
    position: Position;
    slots: number;
    benchSlots: number;
    candidates: Array<{
      id: string;
      baseOvr: number;
      tacticalFit: number;
      expectedPerformance: number;
      squadStatus: number;
      score: number;
      rank: number;
      appearance: SelectionAppearance;
    }>;
    playerReason: { component: string; delta: number } | null;
  };
};

const fixtureJson = careerRaw as CareerFixtureJson;

export const career03Underdog = {
  rulesetVersion: fixtureJson.rulesetVersion,
  contentPackVersion: fixtureJson.contentPackVersion,
  createCareer: fixtureJson.createCareer,
  commands: fixtureJson.commands,
  golden: goldenRaw as GoldenJson,
};

/**
 * career-01과 같은 형태(자체 CREATE_CAREER + UPDATE_PLAYER_DRAFT×2 + CONFIRM_PLAYER + START_SEASON…)의
 * 독립 시나리오 — "OVR이 낮아도 Tactical Fit이 높으면 선발된다"(phase-2 완료 조건).
 */
export function career03UnderdogEngineCommands(newId: () => string): EngineCommand[] {
  const createCommand: EngineCommand = {
    type: 'CREATE_CAREER',
    commandId: newId(),
    expectedRevision: 0,
    payload: {
      careerId: career03Underdog.createCareer.careerId,
      seed: career03Underdog.createCareer.seed,
      simulationMode: career03Underdog.createCareer.simulationMode,
      rulesetVersion: career03Underdog.rulesetVersion,
      contentPackVersion: career03Underdog.contentPackVersion,
    },
  };

  const rest = career03Underdog.commands.map(
    (rawCommand, index) =>
      ({
        ...(rawCommand as Command),
        commandId: newId(),
        expectedRevision: index + 1,
      }) as EngineCommand,
  );

  return [createCommand, ...rest];
}
