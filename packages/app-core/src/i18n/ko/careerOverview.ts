import { ns } from '../core';
const ko = {
  calendarTitle: '대회 일정',
  calendarHint:
    '대표팀 대회는 시즌 결산 때 진행돼요. 참가 여부는 예선·나이·발탁·구단 허락에 따라 달라요.',
  currentYear: '현재 연도',
  endYear: '완료한 시즌',
  yearLabel: (p: { year: number }) => `${p.year}년`,
  calendarAge: '세',
  wildcard: '와일드카드 발탁 필요',
  youth: 'U-23 발탁 필요',
  senior: '대표팀 발탁 필요',
  qualified: '본선 진출 확정',
  eliminated: '본선 진출 실패',
  qualification: '예선 결과 대기',
  scoringTitle: '리그 선수 기록',
  scoringHint: '리그 경기만 집계해요. 공동 1위는 함께 득점왕·도움왕을 받아요.',
  scoringLegacy: '현재 시즌은 기존 수상 규칙을 유지해요. 다음 시즌부터 기록 순위가 표시돼요.',
  goalRank: '득점',
  assistRank: '도움',
  mine: '내 선수',
  rivalForward: '공격수',
  rivalCreator: '미드필더',
  rankLabel: (p: { rank: number }) => `${p.rank}위`,
  seasonOver: '시즌 종료',
};
export type CareerOverviewMsgs = typeof ko;
export const careerOverviewText = ns('careerOverview', ko);
