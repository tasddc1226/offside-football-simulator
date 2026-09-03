import careerChapterRaw from './career-05-chapter.json';
import goldenRaw from './career-05-chapter.golden.json';
import pendingGoldenRaw from './career-05-chapter-pending.json';
import type { ChapterRecord, Command, CompetitionRecord, Pending, SeasonPlayerStats, SeasonSummary, SimulationMode } from '@offside/domain';

/**
 * fixtures는 `@offside/engine-client`를 import할 수 없으므로(ADR-005: fixtures → domain, content만
 * 허용) `EngineCommand`를 여기서 다시 정의한다. engine-client의 `EngineCommand`와 구조가 같다.
 */
export type EngineCommand = Command & { commandId: string; expectedRevision: number };

type CareerChapterFixtureJson = {
  rulesetVersion: string;
  contentPackVersion: string;
  startSeason: { simulationMode: SimulationMode; serviceSeasonId: string };
  commands: Array<{ type: Command['type']; payload: unknown }>;
};

type GoldenJson = {
  revision: number;
  stateHash: string;
  rngStateDraws: number;
  age: number;
  seasonHistory: SeasonSummary[];
  chapterRecord: ChapterRecord;
  beforeSettlement: {
    matchesPlayed: number;
    playerStats: SeasonPlayerStats;
    averageRatingTenths: number | null;
    competitions: CompetitionRecord[];
  };
};

// T-2-004 D-38: 데뷔전 챕터 판단 1(D1) 확정 직후, 판단 2가 남아 pending CHAPTER가 유지되는 스냅샷.
type PendingGoldenJson = {
  revision: number;
  stateHash: string;
  rngStateDraws: number;
  pending: Pending;
  matchRatingTenths: number | null;
};

const fixtureJson = careerChapterRaw as CareerChapterFixtureJson;

export const career05Chapter = {
  rulesetVersion: fixtureJson.rulesetVersion,
  contentPackVersion: fixtureJson.contentPackVersion,
  startSeason: fixtureJson.startSeason,
  commands: fixtureJson.commands,
  golden: goldenRaw as GoldenJson,
  pendingGolden: pendingGoldenRaw as PendingGoldenJson,
};

/**
 * `career01EngineCommands()`가 만든 명령 뒤에 이어 붙이는 START_SEASON → RESOLVE_ROLE → ADVANCE
 * (chapterCandidates 포함) → RESOLVE_CHAPTER×2 → ADVANCE×2 → SETTLE_SEASON 명령 목록.
 * `startExpectedRevision`은 이 시즌 명령 앞에 이미 적용된 마지막 revision(career-01 golden 기준 10)이다.
 */
export function career05ChapterEngineCommands(newId: () => string, startExpectedRevision: number): EngineCommand[] {
  const startCommand: EngineCommand = {
    type: 'START_SEASON',
    commandId: newId(),
    expectedRevision: startExpectedRevision,
    payload: career05Chapter.startSeason,
  };

  const rest = career05Chapter.commands.map(
    (rawCommand, index) =>
      ({
        ...(rawCommand as Command),
        commandId: newId(),
        expectedRevision: startExpectedRevision + 1 + index,
      }) as EngineCommand,
  );

  return [startCommand, ...rest];
}
