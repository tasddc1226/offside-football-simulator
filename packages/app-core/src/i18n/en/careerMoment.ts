import type { Translation } from '@offside/contracts/i18n';
import type { careerMomentText } from '../ko/careerMoment';
export const careerMoment: Translation<typeof careerMomentText> = {
  rank: (p: { rank: number }) => `Estimated league finish: ${p.rank}`,
  competition: (p: { competition: string }) => `Next season: ${p.competition}`,
  noCompetition: 'No continental competition next season',
  estimateNote: 'Estimated from club strength, rather than current standings.',
  trophies: 'Season trophies',
};
