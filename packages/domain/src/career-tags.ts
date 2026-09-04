import { compareCodePoints } from './canonical.js';
import { CAREER_TAG_IDS, type CareerState, type CareerTagId, type SeasonResult } from './types.js';
import type { Ruleset } from './ruleset.js';

export { CAREER_TAG_IDS, type CareerTagId };

export type CareerTagRarity = 'COMMON' | 'RARE' | 'EPIC';
export type CareerTagEvaluateAt = 'SEASON_SETTLED' | 'RETIREMENT';

export type CareerTagDefinition = {
  label: string;
  rarity: CareerTagRarity;
  evaluateAt: CareerTagEvaluateAt;
  ownerPhase: 2 | 3 | 4 | 5;
};

/**
 * T-2-014 D-42: 14 "커리어 태그 카탈로그" 표 그대로(라벨·희귀도). `evaluateAt`·`ownerPhase`는 이
 * 브리프(ADR-010)가 확정한다 — 상세 근거는 ADR-010의 "태그 평가 시점·소유 Phase" 표. 요약: 핵심 경기
 * 챕터(이미 구현된 Phase 2 개념)에 의존하는 세 태그만 `evaluateAt: 'SEASON_SETTLED'`로 이번 브리프가
 * 실제 평가기(`CAREER_TAG_EVALUATORS`)를 등록한다. 나머지 13종은 카탈로그 메타데이터만 두고(라벨·
 * 희귀도·평가 시점·소유 Phase) 평가기는 그 Phase 작업이 등록한다(`CAREER_TAG_EVALUATORS`에 없는
 * 태그는 `evaluateCareerTags`가 건너뛴다).
 */
export const CAREER_TAGS: Record<CareerTagId, CareerTagDefinition> = {
  'TAG-ONE-CLUB': { label: '원클럽맨', rarity: 'RARE', evaluateAt: 'SEASON_SETTLED', ownerPhase: 3 },
  'TAG-JOURNEYMAN': { label: '저니맨', rarity: 'COMMON', evaluateAt: 'SEASON_SETTLED', ownerPhase: 3 },
  'TAG-LOAN-LEGEND': { label: '임대 신화', rarity: 'RARE', evaluateAt: 'SEASON_SETTLED', ownerPhase: 3 },
  'TAG-BIG-GAME': { label: '빅게임 플레이어', rarity: 'RARE', evaluateAt: 'SEASON_SETTLED', ownerPhase: 2 },
  'TAG-GLASS-GENIUS': { label: '유리몸 천재', rarity: 'RARE', evaluateAt: 'SEASON_SETTLED', ownerPhase: 4 },
  'TAG-MANAGER-FAVOURITE': { label: '감독의 애제자', rarity: 'COMMON', evaluateAt: 'SEASON_SETTLED', ownerPhase: 4 },
  'TAG-LOCKER-LEADER': { label: '라커룸 리더', rarity: 'RARE', evaluateAt: 'SEASON_SETTLED', ownerPhase: 4 },
  'TAG-PROMOTION-EXPERT': { label: '승격 전문가', rarity: 'RARE', evaluateAt: 'SEASON_SETTLED', ownerPhase: 3 },
  'TAG-DERBY-HERO': { label: '더비의 영웅', rarity: 'RARE', evaluateAt: 'SEASON_SETTLED', ownerPhase: 2 },
  'TAG-TRAITOR': { label: '배신자', rarity: 'COMMON', evaluateAt: 'SEASON_SETTLED', ownerPhase: 3 },
  'TAG-LATE-BLOOMER': { label: '대기만성', rarity: 'RARE', evaluateAt: 'RETIREMENT', ownerPhase: 5 },
  'TAG-IRONMAN': { label: '철인', rarity: 'EPIC', evaluateAt: 'SEASON_SETTLED', ownerPhase: 2 },
  'TAG-COMEBACK': { label: '컴백', rarity: 'RARE', evaluateAt: 'SEASON_SETTLED', ownerPhase: 4 },
  'TAG-MENTOR': { label: '멘토', rarity: 'COMMON', evaluateAt: 'RETIREMENT', ownerPhase: 5 },
  'TAG-CONTROVERSIAL': { label: '논란의 인물', rarity: 'COMMON', evaluateAt: 'SEASON_SETTLED', ownerPhase: 4 },
  'TAG-UNCROWNED': { label: '무관', rarity: 'RARE', evaluateAt: 'RETIREMENT', ownerPhase: 5 },
};

export type GrantCareerTagSource = { seasonIndex: number; revision: number; refId: string };

/**
 * 태그 하나를 부여한다. 이미 있으면(`state.careerTags`) 무변경으로 그대로 돌려준다(멱등). 정렬은
 * `compareCodePoints` 오름차순(다른 정렬 필드들과 같은 규칙).
 */
export function grantCareerTag(state: CareerState, tagId: CareerTagId, source: GrantCareerTagSource): CareerState {
  if (state.careerTags.includes(tagId)) return state;
  return {
    ...state,
    careerTags: [...state.careerTags, tagId].sort(compareCodePoints),
    careerTagGrants: [
      ...state.careerTagGrants,
      { tagId, seasonIndex: source.seasonIndex, atRevision: source.revision, sourceRefId: source.refId },
    ],
  };
}

export type CareerTagEvaluator = (state: CareerState, result: SeasonResult, ruleset: Ruleset) => boolean;

function countChapterDecisionOutcomes(
  state: CareerState,
  filter: (chapter: SeasonResult['chapters'][number]) => boolean,
): number {
  let count = 0;
  for (const summary of state.seasonHistory) {
    for (const chapter of summary.result.chapters) {
      if (!filter(chapter)) continue;
      for (const decision of chapter.decisions) {
        if (decision.outcomeKind === 'SUCCESS') count += 1;
      }
    }
  }
  return count;
}

/**
 * T-2-014 D-42: 이번 브리프가 등록하는 세 평가기. `evaluateCareerTags`가 이미 부여된 태그를 먼저
 * 거르므로 여기서는 "지금 조건을 만족하는가"만 본다. 나머지 13종은 등록하지 않는다(Phase 3~5가
 * 자기 몫을 여기 추가한다).
 */
export const CAREER_TAG_EVALUATORS: Partial<Record<CareerTagId, CareerTagEvaluator>> = {
  // 14: "핵심 경기 챕터 성공 5회 이상, 결승·더비 득점 관여 포함" — Phase 2는 챕터 SUCCESS 누계만 본다
  // (득점 관여 세부는 챕터 payload에 없다).
  'TAG-BIG-GAME': (state) => countChapterDecisionOutcomes(state, () => true) >= 5,
  // 14: "더비 챕터 결정적 기여 3회 이상" — DERBY trigger 챕터의 SUCCESS 판단 누계로 본다.
  'TAG-DERBY-HERO': (state) => countChapterDecisionOutcomes(state, (chapter) => chapter.trigger === 'DERBY') >= 3,
  // 14: "10시즌 이상 시즌당 출전 비율 80% 이상, 부상 결장 최소" — 조건은 코드화하되 Phase 2 커리어
  // 길이(10시즌 미만)에서는 항상 false다(테스트로 고정).
  'TAG-IRONMAN': (state) => {
    if (state.seasonHistory.length < 10) return false;
    return state.seasonHistory.every((summary) => {
      const possibleMinutes = summary.result.selectionSummary.possibleMinutes;
      if (possibleMinutes === 0) return false;
      const shareBp = Math.round((summary.result.playerStats.minutes * 10000) / possibleMinutes);
      return shareBp >= 8000;
    });
  },
  // T-3-003 D-48: clubHistory 중 kind PERMANENT 항목의 서로 다른 teamId가 1개(임대는 세지 않는다)이고
  // 커리어가 8시즌 이상이면 원클럽맨이다.
  'TAG-ONE-CLUB': (state) => {
    const permanentTeamIds = new Set(state.clubHistory.filter((stint) => stint.kind === 'PERMANENT').map((stint) => stint.teamId));
    return permanentTeamIds.size === 1 && state.seasonHistory.length >= 8;
  },
  // T-3-003 D-48: 완전 이적(TRANSFERRED)로 stint를 닫은 횟수 ≥5, 또는 clubHistory 전체(임대 포함)의
  // 서로 다른 teamId ≥6이면 저니맨이다.
  'TAG-JOURNEYMAN': (state) => {
    const transferredCount = state.clubHistory.filter((stint) => stint.endReason === 'TRANSFERRED').length;
    const distinctTeamIds = new Set(state.clubHistory.map((stint) => stint.teamId)).size;
    return transferredCount >= 5 || distinctTeamIds >= 6;
  },
  // T-3-003 D-48: 직전에 끝난 시즌이 LOAN stint에 속하고(그 시즌 index를 fromSeasonIndex~toSeasonIndex가
  // 포함), 그 시즌의 출전 비율 ≥7000bp·평균 평점 ≥70(tenths)이며, 복귀 뒤 이번 결산 시즌에
  // squadRoleAtEnd가 STARTER면 임대 신화다 — 즉 복귀 다음 시즌 결산에서만 판정된다.
  'TAG-LOAN-LEGEND': (state, result) => {
    if (result.selectionSummary.squadRoleAtEnd !== 'STARTER') return false;
    const previousIndex = state.seasonHistory.length - 2;
    if (previousIndex < 0) return false;
    const previousSummary = state.seasonHistory[previousIndex]!;
    const wasLoanSeason = state.clubHistory.some(
      (stint) =>
        stint.kind === 'LOAN' &&
        stint.fromSeasonIndex <= previousSummary.index &&
        (stint.toSeasonIndex === null || stint.toSeasonIndex >= previousSummary.index),
    );
    if (!wasLoanSeason) return false;
    const possibleMinutes = previousSummary.result.selectionSummary.possibleMinutes;
    if (possibleMinutes === 0) return false;
    const shareBp = Math.round((previousSummary.result.playerStats.minutes * 10000) / possibleMinutes);
    if (shareBp < 7000) return false;
    if (previousSummary.result.playerStats.ratedMatches === 0) return false;
    const avgRatingTenths = Math.round(previousSummary.result.playerStats.ratingSumTenths / previousSummary.result.playerStats.ratedMatches);
    return avgRatingTenths >= 70;
  },
  // T-3-003 D-48: 그 시즌 teamId가 속한 리그의 promotionSlots 이내 finalRank로 STARTER였던 시즌이
  // 2회 이상이면 승격 전문가다(리그는 시즌 teamId → ruleset.teams → leagueId로 찾는다).
  'TAG-PROMOTION-EXPERT': (state, _result, ruleset) => {
    let promotionStarterSeasons = 0;
    for (const summary of state.seasonHistory) {
      const team = ruleset.teams.find((candidate) => candidate.id === summary.teamId);
      if (team === undefined) continue;
      const league = ruleset.leagues.find((candidate) => candidate.id === team.leagueId);
      if (league === undefined) continue;
      const { finalRank, squadRoleAtEnd } = summary.result.selectionSummary;
      if (finalRank <= league.promotionSlots && squadRoleAtEnd === 'STARTER') promotionStarterSeasons += 1;
    }
    return promotionStarterSeasons >= 2;
  },
  // T-3-003 D-48: `배신_이적` 태그가 있고, 그 이적으로 연 stint가 바로 이번 결산 시즌(=이적 후 첫
  // 시즌)이며 팬 지표가 30 이하면 배신자다.
  'TAG-TRAITOR': (state, result) => {
    if (!state.tags.includes('배신_이적')) return false;
    if (state.relationships.fans > 30) return false;
    const currentStint = state.clubHistory.find((stint) => stint.toSeasonIndex === null);
    if (currentStint === undefined) return false;
    return currentStint.fromSeasonIndex === result.index;
  },
};

/**
 * T-2-005 `settleSeason`이 `seasonHistory`에 이번 시즌 `result`를 넣은 뒤 부르는 결산 훅. 이미 부여된
 * 태그·평가기가 없는 태그는 건너뛰고, 새로 조건을 만족하는 태그 ID만 순서대로(CAREER_TAG_IDS 순서)
 * 돌려준다 — 실제 `state.careerTags` 갱신은 호출자가 `grantCareerTag`로 한다(이 함수는 순수하게 판단만
 * 한다).
 */
export function evaluateCareerTags(state: CareerState, result: SeasonResult, ruleset: Ruleset): CareerTagId[] {
  const granted: CareerTagId[] = [];
  for (const tagId of CAREER_TAG_IDS) {
    if (state.careerTags.includes(tagId)) continue;
    const evaluator = CAREER_TAG_EVALUATORS[tagId];
    if (evaluator === undefined) continue;
    if (evaluator(state, result, ruleset)) granted.push(tagId);
  }
  return granted;
}
