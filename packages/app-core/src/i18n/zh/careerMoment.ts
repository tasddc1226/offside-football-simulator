import type { Translation } from '@offside/contracts/i18n';
import type { careerMomentText } from '../ko/careerMoment';
export const careerMoment: Translation<typeof careerMomentText> = {
  rank: (p: { rank: number }) => `預估聯賽第 ${p.rank} 名`,
  competition: (p: { competition: string }) => `下賽季 ${p.competition}`,
  noCompetition: '下賽季無洲際賽事',
  estimateNote: '依球隊戰力預估，與目前排名不同。',
  trophies: '賽季冠軍',
};
