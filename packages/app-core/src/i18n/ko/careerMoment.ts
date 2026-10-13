import { ns } from '@offside/contracts/i18n';
const ko = {
  rank: (p: { rank: number }) => `예상 리그 ${p.rank}위`,
  competition: (p: { competition: string }) => `다음 시즌 ${p.competition}`,
  noCompetition: '다음 시즌 대륙 대회 없음',
  estimateNote: '구단 전력 기준 예상이에요. 현재 순위와는 달라요.',
  trophies: '시즌 우승',
};
export const careerMomentText = ns('careerMoment', ko);
