import type { Translation } from '@offside/contracts/i18n';
import type { careerMomentText } from '../ko/careerMoment';
export const careerMoment: Translation<typeof careerMomentText> = {
  rank: (p: { rank: number }) => `予想リーグ順位 ${p.rank}位`,
  competition: (p: { competition: string }) => `来季 ${p.competition}`,
  noCompetition: '来季の大陸大会出場なし',
  estimateNote: 'クラブ戦力に基づく予想です。現在の順位とは異なります。',
  trophies: 'シーズンの優勝',
};
