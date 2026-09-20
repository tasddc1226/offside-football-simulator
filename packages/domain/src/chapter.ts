import { weightMatchOutcomes, recordMatchLesson } from './development.js';
import { compareCodePoints } from './canonical.js';
import { clamp } from './clamp.js';
import { applyEffects } from './effects.js';
import { computeRatingTenths } from './match.js';
import { rollInt } from './rng.js';
import { isRivalOpponent } from './schedule.js';
import type { ChapterSelectionRules, League, Ruleset } from './ruleset.js';
import type {
  CareerState,
  ChapterOutcomeKind,
  ChapterRecord,
  ChapterTrigger,
  CompetitionRecord,
  Effect,
  MatchRecord,
  NationalDebutReservation,
  Pending,
  SeasonStep,
  SimulationMode,
} from './types.js';

/** T-2-004 D-38: 웹이 콘텐츠 팩 `chapters[]`에서 요약해 `ADVANCE.payload.chapterCandidates`로 보내는 후보 하나. */
export type ChapterCandidateInput = {
  chapterId: string;
  version: number;
  importance: 'MAJOR' | 'MINOR';
  trigger: ChapterTrigger;
  weight: number;
  /** 같은 경기 의미를 공유하는 변형 묶음. 옵트인 룰셋에서만 회전에 사용한다. */
  rotationGroup?: string;
  decisionsTotal: number;
};

export type ChapterOpenResult = {
  chapterId: string;
  version: number;
  importance: 'MAJOR' | 'MINOR';
  matchId: string;
  decisionsTotal: number;
  // T-2-014 D-42: 이긴 후보의 trigger kind(전체 ChapterTrigger가 아니라 판별 리터럴만 — Pending.CHAPTER·
  // ChapterRecord가 그대로 옮겨 담는다).
  trigger: ChapterTrigger['kind'];
  virtualOpponent?: NationalDebutReservation;
};

export type SelectChapterInput = {
  /** 지금 결정 슬롯을 확인 중인 step(경기는 이미 반영된 뒤). */
  step: SeasonStep;
  /** 시즌 전체 step 목록(DECIDER의 "리그 마지막 step" 판정용). */
  steps: readonly SeasonStep[];
  seasonIndex: number;
  mode: SimulationMode;
  /** 이 step에서 방금 재생된 경기 기록(순서 무관하게 넘겨도 된다 — order로 다시 정렬한다). */
  matchesThisStep: readonly MatchRecord[];
  /** 이 step 전까지 이번 시즌에 쌓인 경기 기록(DEBUT의 "커리어 첫 출전" 판정용). */
  matchesBeforeThisStep: readonly MatchRecord[];
  competitions: readonly CompetitionRecord[];
  candidates: readonly ChapterCandidateInput[];
  tags: readonly string[];
  resolvedChapterIds: readonly string[];
  /** `season.chapters[].chapterId`(이번 시즌에 이미 확정된 챕터, 재열림 방지). */
  existingChapterIds: readonly string[];
  league: League;
  /** PR #208 리뷰 후속: 선수 소속 팀의 `Team.rivalTeamId`(정의됐으면 DERBY 판정에 쓴다 — 없으면
   * isRivalOpponent가 기존 이름 없는 상대 로직으로 폴백한다). */
  rivalTeamId?: string | undefined;
  /** 첫 회복 후 실제 출전 경기 id. 없으면 INJURY_RETURN 후보는 열리지 않는다. */
  injuryReturnMatchId?: string | null;
  /** 최초 수락 뒤 유지되는 NATIONAL_DEBUT 예약. null/undefined면 대표팀 데뷔 후보를 열지 않는다. */
  nationalDebutReservation?: NationalDebutReservation | null;
  /** 없으면 역사적 MAJOR > weight > id 선택 경로를 그대로 사용한다. */
  chapterSelectionRules?: ChapterSelectionRules | undefined;
};

function isReservedChapterTrigger(trigger: ChapterTrigger): boolean {
  return (
    trigger.kind === 'NATIONAL_DEBUT' ||
    trigger.kind === 'INJURY_RETURN' ||
    trigger.kind === 'DEBUT'
  );
}

function resolvedSeasonsForChapter(
  resolvedChapterIds: readonly string[],
  chapterId: string,
): number[] {
  const prefix = `${chapterId}@`;
  return resolvedChapterIds.flatMap((resolvedId) => {
    if (!resolvedId.startsWith(prefix)) return [];
    const season = Number(resolvedId.slice(prefix.length));
    return Number.isInteger(season) && season >= 1 ? [season] : [];
  });
}

function latestResolvedSeason(
  resolvedChapterIds: readonly string[],
  chapterId: string,
): number | null {
  const seasons = resolvedSeasonsForChapter(resolvedChapterIds, chapterId);
  return seasons.length === 0 ? null : Math.max(...seasons);
}

function isWithinChapterCooldown(
  candidate: ChapterCandidateInput,
  seasonIndex: number,
  resolvedChapterIds: readonly string[],
  rules: ChapterSelectionRules,
): boolean {
  if (candidate.rotationGroup === undefined || isReservedChapterTrigger(candidate.trigger))
    return false;
  return resolvedSeasonsForChapter(resolvedChapterIds, candidate.chapterId).some(
    (resolvedSeason) => {
      const delta = seasonIndex - resolvedSeason;
      return delta >= 1 && delta <= rules.repeatCooldownSeasons;
    },
  );
}

function stepAllowsImportance(step: SeasonStep, importance: 'MAJOR' | 'MINOR'): boolean {
  return step.decisionSlots.some(
    (slot) => slot.kind === 'CHAPTER' && !slot.skippedByBudget && (slot.importance === undefined || slot.importance === importance),
  );
}

/** DECIDER 경계: 승격 마지노선(promotionSpots)·강등 마지노선(teamCount - relegationSpots + 1) 중 하나에서 maxRankGap 이내. */
function isNearPromotionOrRelegation(league: League, position: number | null, maxRankGap: number): boolean {
  if (position === null) return false;
  const nearPromotion = league.promotionSpots > 0 && Math.abs(position - league.promotionSpots) <= maxRankGap;
  const relegationBoundary = league.teamCount - league.relegationSpots + 1;
  const nearRelegation = league.relegationSpots > 0 && Math.abs(position - relegationBoundary) <= maxRankGap;
  return nearPromotion || nearRelegation;
}

function lastLeagueStepIndex(steps: readonly SeasonStep[]): number {
  let last = -1;
  for (const step of steps) {
    if (step.phase === 'LEAGUE') last = Math.max(last, step.index);
  }
  return last;
}

type TriggerContext = {
  seasonIndex: number;
  isFirstCareerAppearance: boolean;
  isLastLeagueStep: boolean;
  league: League;
  leaguePosition: number | null;
  tags: readonly string[];
  /** PR #208 리뷰 후속: 선수 소속 팀의 `Team.rivalTeamId`. isRivalOpponent에 그대로 넘긴다. */
  rivalTeamId?: string | undefined;
  injuryReturnMatchId?: string | null;
  nationalDebutReservation?: NationalDebutReservation | null;
};

/**
 * `trigger`가 `match`에 맞는지 본다. 모든 트리거는 그 경기에 실제로 출전(minutes > 0)했을 때만
 * 맞는다 — 판단이 그 경기에서 선수가 겪은 순간을 다루므로 0분 경기는 대상이 아니다.
 */
export function matchesTrigger(trigger: ChapterTrigger, match: MatchRecord, ctx: TriggerContext): boolean {
  if (match.minutes <= 0) return false;
  switch (trigger.kind) {
    case 'DEBUT':
      return ctx.seasonIndex === 1 && ctx.isFirstCareerAppearance;
    case 'DERBY':
      return match.kind === 'LEAGUE' && isRivalOpponent(ctx.league, match.opponent.id, ctx.rivalTeamId);
    case 'CUP_FINAL':
      return match.kind === 'CUP' && match.round === 'FINAL';
    case 'DECIDER':
      return ctx.isLastLeagueStep && isNearPromotionOrRelegation(ctx.league, ctx.leaguePosition, trigger.maxRankGap);
    case 'INJURY_RETURN':
      return ctx.injuryReturnMatchId === match.id;
    case 'NATIONAL_DEBUT':
      return ctx.nationalDebutReservation !== null && ctx.nationalDebutReservation !== undefined;
    case 'TAG':
      return ctx.tags.includes(trigger.tag);
  }
}

/**
 * T-2-004 D-38 규칙 2·3: 후보를 필터(step 슬롯 존재·importance 일치·FAST는 MAJOR만·중복 제외)한 뒤
 * 이 step의 경기 중 트리거가 맞는 첫 경기(order 오름차순)를 찾고, 남은 후보를 MAJOR > weight > id
 * 순으로 정렬해 하나를 고른다. roll을 소비하지 않는다.
 */
export function selectChapter(input: SelectChapterInput): ChapterOpenResult | null {
  const isFirstCareerAppearanceAtStepStart = !input.matchesBeforeThisStep.some((match) => match.minutes > 0);
  const isLastLeagueStep = input.step.index === lastLeagueStepIndex(input.steps);
  const leaguePosition = input.competitions.find((c) => c.competitionId === 'LEAGUE')?.position ?? null;
  const orderedMatches = [...input.matchesThisStep].sort((a, b) => a.order - b.order);

  const eligibleCandidates = input.candidates.filter((candidate) => {
    if (input.mode === 'FAST' && candidate.importance !== 'MAJOR') return false;
    if (!stepAllowsImportance(input.step, candidate.importance)) return false;
    if (input.resolvedChapterIds.includes(`${candidate.chapterId}@${input.seasonIndex}`)) return false;
    if (input.existingChapterIds.includes(candidate.chapterId)) return false;
    if (candidate.trigger.kind === 'NATIONAL_DEBUT' && input.nationalDebutReservation === null) return false;
    if (candidate.trigger.kind === 'NATIONAL_DEBUT' && input.nationalDebutReservation === undefined) return false;
    return true;
  });

  const opened: Array<{ candidate: ChapterCandidateInput; matchId: string; virtualOpponent?: NationalDebutReservation }> = [];
  for (const candidate of eligibleCandidates) {
    let isFirstCareerAppearance = isFirstCareerAppearanceAtStepStart;
    for (const match of orderedMatches) {
      if (
        matchesTrigger(
          candidate.trigger,
          match,
          {
            seasonIndex: input.seasonIndex,
            isFirstCareerAppearance,
            isLastLeagueStep,
            league: input.league,
            leaguePosition,
            tags: input.tags,
            rivalTeamId: input.rivalTeamId,
            ...(input.injuryReturnMatchId === undefined ? {} : { injuryReturnMatchId: input.injuryReturnMatchId }),
            ...(input.nationalDebutReservation === undefined ? {} : { nationalDebutReservation: input.nationalDebutReservation }),
          },
        )
      ) {
        opened.push({
          candidate,
          matchId: match.id,
          ...(candidate.trigger.kind === 'NATIONAL_DEBUT' && input.nationalDebutReservation !== null && input.nationalDebutReservation !== undefined
            ? { virtualOpponent: input.nationalDebutReservation }
            : {}),
        });
        break;
      }
      if (match.minutes > 0) isFirstCareerAppearance = false;
    }
  }

  if (opened.length === 0) return null;

  // Historical rulesets intentionally retain this exact no-roll comparator. The 1.7.4 policy is
  // a separate branch so adding content cannot perturb old pair selection or RNG/state hashes.
  if (input.chapterSelectionRules === undefined) {
    opened.sort((a, b) => {
      const aNationalDebut = a.candidate.trigger.kind === 'NATIONAL_DEBUT';
      const bNationalDebut = b.candidate.trigger.kind === 'NATIONAL_DEBUT';
      if (aNationalDebut !== bNationalDebut) return aNationalDebut ? -1 : 1;
      if (a.candidate.importance !== b.candidate.importance)
        return a.candidate.importance === 'MAJOR' ? -1 : 1;
      if (a.candidate.weight !== b.candidate.weight) return b.candidate.weight - a.candidate.weight;
      return compareCodePoints(a.candidate.chapterId, b.candidate.chapterId);
    });

    const winner = opened[0]!;
    return {
      chapterId: winner.candidate.chapterId,
      version: winner.candidate.version,
      importance: winner.candidate.importance,
      matchId: winner.matchId,
      decisionsTotal: winner.candidate.decisionsTotal,
      trigger: winner.candidate.trigger.kind,
      ...(winner.virtualOpponent === undefined ? {} : { virtualOpponent: winner.virtualOpponent }),
    };
  }

  // Opt-in policy: first identify the winning family with the historical
  // NATIONAL_DEBUT > importance > weight > chapterId comparator, then rotate only among eligible
  // members of that same group/importance/weight tier. A mismatched lower-weight member cannot
  // bypass historical weight priority. Unseen variants win, followed by the least recently
  // resolved; no simulation RNG is consumed and a fully cooled-down group stays unavailable.
  opened.sort((a, b) => {
    const aNationalDebut = a.candidate.trigger.kind === 'NATIONAL_DEBUT';
    const bNationalDebut = b.candidate.trigger.kind === 'NATIONAL_DEBUT';
    if (aNationalDebut !== bNationalDebut) return aNationalDebut ? -1 : 1;
    if (a.candidate.importance !== b.candidate.importance) return a.candidate.importance === 'MAJOR' ? -1 : 1;
    if (a.candidate.weight !== b.candidate.weight) return b.candidate.weight - a.candidate.weight;
    return compareCodePoints(a.candidate.chapterId, b.candidate.chapterId);
  });

  const leader = opened[0]!;
  const rotationGroup = leader.candidate.rotationGroup;
  const rotationCandidates =
    rotationGroup === undefined || isReservedChapterTrigger(leader.candidate.trigger)
      ? [leader]
      : opened.filter(
          (entry) =>
            entry.candidate.rotationGroup === rotationGroup &&
            !isReservedChapterTrigger(entry.candidate.trigger) &&
            entry.candidate.importance === leader.candidate.importance &&
            entry.candidate.weight === leader.candidate.weight,
        ).filter(
          (entry) =>
            !isWithinChapterCooldown(
              entry.candidate,
              input.seasonIndex,
              input.resolvedChapterIds,
              input.chapterSelectionRules!,
            ),
        );
  if (rotationCandidates.length === 0) return null;
  rotationCandidates.sort((a, b) => {
    const aLastSeason = latestResolvedSeason(input.resolvedChapterIds, a.candidate.chapterId);
    const bLastSeason = latestResolvedSeason(input.resolvedChapterIds, b.candidate.chapterId);
    if (aLastSeason === null && bLastSeason !== null) return -1;
    if (aLastSeason !== null && bLastSeason === null) return 1;
    if (aLastSeason !== null && bLastSeason !== null && aLastSeason !== bLastSeason)
      return aLastSeason - bLastSeason;
    return compareCodePoints(a.candidate.chapterId, b.candidate.chapterId);
  });

  const winner = rotationCandidates[0]!;
  return {
    chapterId: winner.candidate.chapterId,
    version: winner.candidate.version,
    importance: winner.candidate.importance,
    matchId: winner.matchId,
    decisionsTotal: winner.candidate.decisionsTotal,
    trigger: winner.candidate.trigger.kind,
    ...(winner.virtualOpponent === undefined ? {} : { virtualOpponent: winner.virtualOpponent }),
  };
}

export type ResolveChapterOutcome = {
  id: string;
  kind: ChapterOutcomeKind;
  weight: number;
  effects: Effect[];
  ratingDeltaTenths: number;
  addTags?: string[];
  removeTags?: string[];
};

export type ResolveChapterInput = {
  state: CareerState;
  ruleset: Ruleset;
  chapterId: string;
  definitionVersion: number;
  decisionId: string;
  optionId: string;
  outcomes: ResolveChapterOutcome[];
};

export type ResolveChapterFailureReason = 'NO_PENDING_CHAPTER' | 'PENDING_CHAPTER_MISMATCH' | 'DECISION_ALREADY_RESOLVED';

// 브리프가 정한 reason 값은 3개뿐이다(가중치 검사 실패는 `resolveEvent`처럼 reason 없이 message만
// 돌려준다 — simulate.ts는 reason이 없으면 fail()에 details를 붙이지 않는다).
export type ResolveChapterResult =
  | { ok: false; message: string; reason?: ResolveChapterFailureReason }
  | { ok: true; state: CareerState; roll: number; outcomeId: string; appliedEffects: Effect[] };

function sortUniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags)).sort(compareCodePoints);
}

/**
 * T-2-004 D-38 "판단 resolver 규칙": 판단 하나를 검증·roll·적용한다. `resolveEvent`(simulate.ts)와
 * 같은 누적 가중치 선택을 쓰되, roll은 `state.rngState`(경기 전용 `matchRngState`가 아니다 — 경기
 * 결과는 이미 확정됐다)에서 뽑는다. season.ts·simulate.ts는 이 함수를 command 분기·revision·
 * timeline 조립에만 쓴다(명령 검증·roll·Effect·평점·통계 재계산은 전부 여기서 끝낸다).
 */
export function resolveChapter(input: ResolveChapterInput): ResolveChapterResult {
  const state = input.state;
  const pending = state.pending;
  if (pending === null || pending.kind !== 'CHAPTER') {
    return { ok: false, message: '해소할 pending 챕터가 없다.', reason: 'NO_PENDING_CHAPTER' };
  }
  if (pending.chapterId !== input.chapterId || pending.version !== input.definitionVersion) {
    return { ok: false, message: 'pending 챕터와 요청이 다르다.', reason: 'PENDING_CHAPTER_MISMATCH' };
  }
  if (pending.resolved.some((entry) => entry.decisionId === input.decisionId)) {
    return { ok: false, message: '이미 확정된 판단이다.', reason: 'DECISION_ALREADY_RESOLVED' };
  }

  const outcomes = weightMatchOutcomes(state, input.optionId, input.outcomes, input.ruleset);
  const weightSum = outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
  // resolveEvent(simulate.ts)와 같은 검사·같은 규칙(reason 없이 message만) — rollInt가
  // maxExclusive를 1 이상의 정수로 요구하는 프로그래밍 오류 가정을 여기서 미리 걸러낸다.
  if (!Number.isInteger(weightSum) || weightSum <= 0 || weightSum > 0xffffffff) {
    return { ok: false, message: 'outcome 가중치 합은 1 이상 2^32 이하의 정수여야 한다.' };
  }

  const rolled = rollInt(state.rngState, weightSum);
  let cumulative = 0;
  let chosen = outcomes[0];
  for (const outcome of outcomes) {
    cumulative += outcome.weight;
    if (rolled.value < cumulative) {
      chosen = outcome;
      break;
    }
  }
  if (chosen === undefined) {
    return { ok: false, message: 'outcomes가 비어 있다.' };
  }

  const lessonState = input.ruleset.developmentRules === undefined ? state : recordMatchLesson(state, input.optionId, outcomes, chosen.kind);
  const effectResult = applyEffects(lessonState, chosen.effects, { step: state.currentStep }, input.ruleset.relationshipRules);

  let tags = effectResult.state.tags;
  if (chosen.addTags && chosen.addTags.length > 0) tags = [...tags, ...chosen.addTags];
  if (chosen.removeTags && chosen.removeTags.length > 0) {
    const removeSet = new Set(chosen.removeTags);
    tags = tags.filter((tag) => !removeSet.has(tag));
  }
  tags = sortUniqueTags(tags);

  const season = effectResult.state.season;
  if (season === null) {
    throw new RangeError('resolveChapter: CHAPTER pending인데 season이 null이다.');
  }
  const matchIndex = season.matches.findIndex((candidate) => candidate.id === pending.matchId);
  if (matchIndex === -1) {
    throw new RangeError(`resolveChapter: season.matches에 matchId '${pending.matchId}'가 없다.`);
  }
  const match = season.matches[matchIndex]!;
  const beforeRating = match.ratingTenths;
  const isNationalDebut = pending.trigger === 'NATIONAL_DEBUT';
  const afterRating =
    isNationalDebut || beforeRating === null ? beforeRating : clamp(beforeRating + chosen.ratingDeltaTenths, 40, 100);

  const matches = isNationalDebut
    ? season.matches
    : season.matches.map((candidate, index) => (index === matchIndex ? { ...candidate, ratingTenths: afterRating } : candidate));

  const isLastMatchInSeason = matchIndex === season.matches.length - 1;
  const lastRatingTenths = isNationalDebut
    ? season.lastRatingTenths
    : isLastMatchInSeason && afterRating !== null
      ? afterRating
      : season.lastRatingTenths;

  const ratingSumDelta = isNationalDebut || beforeRating === null || afterRating === null ? 0 : afterRating - beforeRating;
  const playerStats = isNationalDebut
    ? season.playerStats
    : { ...season.playerStats, ratingSumTenths: season.playerStats.ratingSumTenths + ratingSumDelta };

  const resolvedEntry = {
    decisionId: input.decisionId,
    optionId: input.optionId,
    outcomeId: chosen.id,
    roll: rolled.value,
    outcomeKind: chosen.kind,
  };
  const resolved = [...pending.resolved, resolvedEntry];
  const isLastDecision = resolved.length >= pending.decisionsTotal;

  let chapters = season.chapters;
  let resolvedChapterIds = state.resolvedChapterIds;
  let nationalTeam = state.nationalTeam;
  let nextPending: Pending;

  if (isLastDecision) {
    // 챕터가 경기 평점에 더한 총합은 판단 이전 원래 평점(경기 통계에서 다시 계산 — 챕터로 바뀌지
    // 않는 값이라 순수 함수로 재도출할 수 있다)과 최종 평점의 차이다.
    const originalRating =
      match.minutes > 0 ? computeRatingTenths(match.stats.group, match.stats, match.result.outcome, match.cards, input.ruleset) : null;
    const chapterRatingDeltaTenths =
      isNationalDebut || originalRating === null || afterRating === null ? 0 : afterRating - originalRating;

    const chapterRecord: ChapterRecord = {
      chapterId: pending.chapterId,
      version: pending.version,
      step: pending.step,
      matchId: pending.matchId,
      importance: pending.importance,
      trigger: pending.trigger,
      decisions: resolved.map((entry) => ({
        decisionId: entry.decisionId,
        optionId: entry.optionId,
        outcomeId: entry.outcomeId,
        outcomeKind: entry.outcomeKind,
      })),
      ratingDeltaTenths: chapterRatingDeltaTenths,
      ...(pending.virtualOpponent === undefined ? {} : { virtualOpponent: pending.virtualOpponent }),
    };
    chapters = [...season.chapters, chapterRecord];
    resolvedChapterIds = sortUniqueTags([...state.resolvedChapterIds, `${pending.chapterId}@${season.index}`]);
    if (pending.trigger === 'NATIONAL_DEBUT') {
      if (nationalTeam.pendingDebut === null) {
        return { ok: false, message: 'NATIONAL_DEBUT 챕터에 소비할 대표팀 데뷔 예약이 없다.' };
      }
      nationalTeam = { ...nationalTeam, debuted: true, pendingDebut: null };
    }
    nextPending = null;
  } else {
    nextPending = { ...pending, resolved };
  }

  const nextState: CareerState = {
    ...effectResult.state,
    tags,
    resolvedChapterIds,
    nationalTeam,
    rngState: rolled.state,
    pending: nextPending,
    season: { ...season, matches, playerStats, lastRatingTenths, chapters },
  };

  return { ok: true, state: nextState, roll: rolled.value, outcomeId: chosen.id, appliedEffects: effectResult.applied };
}
