// SCR-031 핵심 경기 챕터: pending CHAPTER(진행 중) 또는 방금 끝난 챕터(결과 화면)의 화면 상태를
// state만으로 판정한다. appliedEffects(휘발성 mutation 응답)가 아니라 정의·기록에서 다시 읽으므로
// 새로고침·뒤로 가기가 같은 값을 낸다(event-result.ts resolveEventResultView와 같은 관례).
import type { CareerState, ChapterRecord, MatchRecord, NationalDebutReservation } from '@offside/domain';
import type { ChapterDefinition, ContentPack } from '@offside/content';

export type ChapterDecisionEntry = { decisionId: string; optionId: string; outcomeId: string };

export type ResolvedChapterDecision = {
  entry: ChapterDecisionEntry;
  decision: ChapterDefinition['decisions'][number];
  option: ChapterDefinition['decisions'][number]['options'][number];
  outcome: ChapterDefinition['decisions'][number]['options'][number]['outcomes'][number];
};

/**
 * SCR-031의 경기 맥락. NATIONAL_DEBUT은 실제 클럽 MatchRecord를 국가대표 경기로 위장하지 않고,
 * 도메인이 저장한 가상 상대를 별도 typed branch로 노출한다.
 */
export type ChapterContext =
  | { kind: 'CLUB'; competition: MatchRecord['kind']; opponent: MatchRecord['opponent']; home: boolean }
  | { kind: 'NATIONAL_TEAM'; competition: 'NATIONAL_TEAM'; opponent: NationalDebutReservation };

export type ChapterView = {
  definition: ChapterDefinition;
  match: MatchRecord;
  context: ChapterContext;
  decisionsTotal: number;
  /** 확정된 판단 수(= 다음에 열려야 할 판단의 0-based 인덱스). completed면 decisionsTotal과 같다. */
  currentDecisionIndex: number;
  /** 확정된 판단들(순서대로), 각각 팩 정의로 복원한 decision·option·outcome을 함께 갖는다. */
  resolved: ResolvedChapterDecision[];
  completed: boolean;
  /** completed일 때만 값이 있다(season.chapters의 마지막 기록). */
  chapterRecord: ChapterRecord | null;
};

function resolveDecisionEntry(definition: ChapterDefinition, entry: ChapterDecisionEntry): ResolvedChapterDecision | null {
  const decision = definition.decisions.find((candidate) => candidate.id === entry.decisionId);
  const option = decision?.options.find((candidate) => candidate.id === entry.optionId);
  const outcome = option?.outcomes.find((candidate) => candidate.id === entry.outcomeId);
  if (decision === undefined || option === undefined || outcome === undefined) return null;
  return { entry, decision, option, outcome };
}

function resolveAllEntries(definition: ChapterDefinition, entries: readonly ChapterDecisionEntry[]): ResolvedChapterDecision[] | null {
  const resolved: ResolvedChapterDecision[] = [];
  for (const entry of entries) {
    const resolvedEntry = resolveDecisionEntry(definition, entry);
    if (resolvedEntry === null) return null;
    resolved.push(resolvedEntry);
  }
  return resolved;
}

function buildChapterContext(
  match: MatchRecord,
  trigger: ChapterDefinition['trigger']['kind'],
  virtualOpponent: NationalDebutReservation | undefined,
): ChapterContext | null {
  if (trigger === 'NATIONAL_DEBUT') {
    if (virtualOpponent === undefined) return null;
    return { kind: 'NATIONAL_TEAM', competition: 'NATIONAL_TEAM', opponent: virtualOpponent };
  }
  return { kind: 'CLUB', competition: match.kind, opponent: match.opponent, home: match.home };
}

/**
 * 라우트 가드와 화면 렌더가 함께 쓰는 판정. pending.kind === 'CHAPTER'면 진행 중(판단 입력 가능),
 * 그게 아니면서 직전 timeline 항목이 CHAPTER_RESOLVED면 방금 끝난 챕터의 결과 화면
 * (season.chapters의 마지막 ChapterRecord로 복원), 그 외에는 null(이 화면에 있을 이유가 없다 —
 * 라우트가 screenForCareer로 돌려보낸다).
 */
export function deriveChapterView(state: CareerState, pack: ContentPack): ChapterView | null {
  const season = state.season;
  const pending = state.pending;

  if (pending !== null && pending.kind === 'CHAPTER') {
    if (season === null) return null;
    const definition = pack.chaptersById.get(pending.chapterId);
    const match = season.matches.find((candidate) => candidate.id === pending.matchId);
    const context = match === undefined ? null : buildChapterContext(match, pending.trigger, pending.virtualOpponent);
    if (definition === undefined || match === undefined || context === null) return null;
    const resolved = resolveAllEntries(definition, pending.resolved);
    if (resolved === null) return null;
    return {
      definition,
      match,
      context,
      decisionsTotal: pending.decisionsTotal,
      currentDecisionIndex: pending.resolved.length,
      resolved,
      completed: false,
      chapterRecord: null,
    };
  }

  const lastEntry = state.timeline.at(-1);
  if (season !== null && lastEntry !== undefined && lastEntry.kind === 'CHAPTER_RESOLVED') {
    const chapterRecord = season.chapters.at(-1);
    if (chapterRecord === undefined) return null;
    const definition = pack.chaptersById.get(chapterRecord.chapterId);
    const match = season.matches.find((candidate) => candidate.id === chapterRecord.matchId);
    const context = match === undefined ? null : buildChapterContext(match, chapterRecord.trigger, chapterRecord.virtualOpponent);
    if (definition === undefined || match === undefined || context === null) return null;
    const resolved = resolveAllEntries(definition, chapterRecord.decisions);
    if (resolved === null) return null;
    return {
      definition,
      match,
      context,
      decisionsTotal: definition.decisions.length,
      currentDecisionIndex: definition.decisions.length,
      resolved,
      completed: true,
      chapterRecord,
    };
  }

  return null;
}

// T-7-009 이슈 150: 대표팀 소집 챕터(NATIONAL_TEAM)는 도메인이 스코어·개인 기록을 만들지 않으므로,
// 리그 경기용 ChapterResultSection이 그리는 스코어보드 대신 이미 있는 데이터(상대 표기·판단 결과·
// 효과·태그·데뷔 확정 여부)만으로 요약 행을 만든다. CLUB 맥락이거나 아직 완료되지 않았으면(결과
// 화면 전) null — 호출부가 결과 화면에서만 쓴다.
export type NationalTeamResultSummary = {
  opponentName: string;
  decisions: ResolvedChapterDecision[];
  successCount: number;
  totalCount: number;
  /** true면 이 챕터의 확정으로 대표팀 데뷔가 확정됐다(ChapterRecord.trigger가 NATIONAL_DEBUT).
   * NATIONAL_DEBUT trigger는 예약 소비 시 한 번만 열리므로 이 요약이 존재하는 완료 뷰에서는
   * 항상 true지만, "없는 데이터를 만들어 보여주지 않는다" 원칙에 맞춰 기록에서 직접 읽는다. */
  debutConfirmed: boolean;
};

export function deriveNationalTeamResultSummary(view: ChapterView): NationalTeamResultSummary | null {
  if (view.context.kind !== 'NATIONAL_TEAM' || view.chapterRecord === null) return null;
  return {
    opponentName: view.context.opponent.opponentName,
    decisions: view.resolved,
    successCount: view.resolved.filter(({ outcome }) => outcome.kind === 'SUCCESS').length,
    totalCount: view.resolved.length,
    debutConfirmed: view.chapterRecord.trigger === 'NATIONAL_DEBUT',
  };
}
