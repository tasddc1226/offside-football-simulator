import type { CareerMilestone, SeasonAward, SeasonResult } from '@offside/domain';

export const SEASON_AWARD_LABELS_KO: Record<SeasonAward['awardId'], string> = {
  SEASON_MVP: '시즌 MVP',
  BEST_XI: '베스트 일레븐',
  POSITION_LEADER: '포지션 우수상',
  SCORING_LEADER: '득점 선두',
  ROOKIE_OF_SEASON: '올해의 신인',
};

export const MILESTONE_LABELS_KO: Record<CareerMilestone['milestoneId'], string> = {
  FIRST_APPEARANCE: '프로 첫 실출전',
  HUNDRED_APPEARANCES: '100회 실출전',
  FIFTY_GOALS: '50골',
  FIRST_TITLE: '첫 우승',
  FIVE_SEASON_ONE_CLUB: '한 클럽 5시즌',
  NATIONAL_DEBUT: '대표팀 데뷔',
};

export function playerAwards(result: Pick<SeasonResult, 'awards'>): SeasonAward[] {
  return (result.awards ?? []).filter((award) => award.recipientId === 'PLAYER');
}

export function careerMilestones(
  history: readonly { result: Pick<SeasonResult, 'milestones'> }[],
): CareerMilestone[] {
  return history.flatMap((season) => season.result.milestones ?? []);
}
