import careerChapterRaw from './career-05-chapter.json';
import { runCareerFixture, rulesetProto } from './career-01.js';
import type { Command, SimulationResult } from '../simulate.js';
import { simulate } from '../simulate.js';
import type { ChapterRecord, CompetitionRecord, DomainSnapshot, Pending, SeasonPlayerStats, SimulationMode } from '../types.js';

type CareerChapterFixture = {
  rulesetVersion: string;
  contentPackVersion: string;
  startSeason: { simulationMode: SimulationMode; serviceSeasonId: string };
  commands: Array<{ type: Command['type']; payload: unknown }>;
};

export const careerChapterFixture = careerChapterRaw as CareerChapterFixture;

function buildCommand(
  type: Command['type'],
  commandId: string,
  expectedRevision: number,
  payload: unknown,
): Command & { commandId: string; expectedRevision: number } {
  return { type, commandId, expectedRevision, payload } as Command & { commandId: string; expectedRevision: number };
}

function runOrThrow(snapshot: DomainSnapshot, command: Command & { commandId: string; expectedRevision: number }): DomainSnapshot {
  const result: SimulationResult = simulate({
    snapshot,
    command,
    ruleset: rulesetProto,
    rulesetVersion: careerChapterFixture.rulesetVersion,
    contentPackVersion: careerChapterFixture.contentPackVersion,
  });
  if (!result.ok) {
    throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

export type ChapterFixtureRun = {
  snapshot: DomainSnapshot;
  /** T-2-004 D-38: 판단 1(D1) 확정 직후, 판단 2가 아직 남아 pending CHAPTER가 유지되는 스냅샷
   * (브리프: "데뷔전 판단 도중에 멈춘 pending 스냅샷"). */
  pendingAfterFirstDecision: {
    revision: number;
    stateHash: string;
    rngStateDraws: number;
    pending: Pending;
    matchRatingTenths: number | null;
  };
  /** 판단 2(마지막)까지 확정된 뒤 season.chapters에 남는 기록. */
  chapterRecord: ChapterRecord;
  beforeSettlement: {
    matchesPlayed: number;
    playerStats: SeasonPlayerStats;
    averageRatingTenths: number | null;
    competitions: CompetitionRecord[];
  };
};

/**
 * T-2-004 D-38 golden 절차: career-01 fixture(계약 체결까지)를 그대로 실행한 뒤 CHAPTER 모드로
 * 시즌을 시작해, step 3(유스 첫 시즌 첫 출전)에서 데뷔전 챕터(CHP-MATCH-001, MAJOR, 판단 2개)를 열고
 * 판단 2개를 순서대로 확정한 다음 시즌 결산까지 간다. `chapterCandidates`는 이 fixture가 직접
 * 고정값으로 보낸다(웹 연결은 T-2-008, `select-chapter-candidates.ts`는 packages/content 몫).
 */
export function runChapterFixture(): ChapterFixtureRun {
  let snapshot = runCareerFixture();
  snapshot = runOrThrow(
    snapshot,
    buildCommand('START_SEASON', 'chapter-season-start', snapshot.revision, careerChapterFixture.startSeason),
  );

  let pendingAfterFirstDecision: ChapterFixtureRun['pendingAfterFirstDecision'] | null = null;
  let chapterRecord: ChapterRecord | null = null;
  let beforeSettlement: ChapterFixtureRun['beforeSettlement'] | null = null;

  careerChapterFixture.commands.forEach((rawCommand, index) => {
    if (rawCommand.type === 'SETTLE_SEASON') {
      const season = snapshot.state.season!;
      beforeSettlement = {
        matchesPlayed: season.matches.length,
        playerStats: season.playerStats,
        averageRatingTenths:
          season.playerStats.ratedMatches > 0
            ? Math.round(season.playerStats.ratingSumTenths / season.playerStats.ratedMatches)
            : null,
        competitions: season.competitions,
      };
    }

    const command = buildCommand(rawCommand.type, `chapter-${index}`, snapshot.revision, rawCommand.payload);
    snapshot = runOrThrow(snapshot, command);

    if (command.type === 'RESOLVE_CHAPTER') {
      const payload = command.payload as { decisionId: string };
      if (payload.decisionId === 'D1') {
        const match = snapshot.state.season!.matches.find((m) => m.chapterId === 'CHP-MATCH-001')!;
        pendingAfterFirstDecision = {
          revision: snapshot.revision,
          stateHash: snapshot.stateHash,
          rngStateDraws: snapshot.state.rngState.draws,
          pending: snapshot.state.pending,
          matchRatingTenths: match.ratingTenths,
        };
      } else if (payload.decisionId === 'D2') {
        chapterRecord = snapshot.state.season!.chapters.find((c) => c.chapterId === 'CHP-MATCH-001')!;
      }
    }
  });

  return {
    snapshot,
    pendingAfterFirstDecision: pendingAfterFirstDecision!,
    chapterRecord: chapterRecord!,
    beforeSettlement: beforeSettlement!,
  };
}
