import type { Translation } from '@offside/contracts/i18n';
import type { careerMomentText } from '../ko/careerMoment';
export const careerMoment: Translation<typeof careerMomentText> = {
  visitIntro: (p: { club: string; seasons: number; apps: number }) =>
    `You played ${p.apps} matches over ${p.seasons} seasons at ${p.club}.`,
  visitQuestion: (p: { rd: number }) =>
    `Before round ${p.rd}, a reporter asks, “Will you celebrate if you score today?”`,
  respect: '“I’ll keep it low-key.”',
  fans: '“I’ll celebrate with our travelling fans.”',
  later: '“Ask me after the match.”',
  visitRecall: (p: { rd: number; reply: string }) => `Before round ${p.rd}, you said: ${p.reply}`,
  visitGoal: (p: { club: string }) =>
    `You scored away at ${p.club}. The travelling fans are singing your name.`,
  hands: 'Raise both hands',
  run: 'Run to the away end',
  visitAssist: (p: { club: string }) => `Set up a teammate’s goal away at ${p.club}.`,
  visitPlayed: (p: { club: string }) =>
    `Applauded the familiar stands at full time away at ${p.club}.`,
  visitUnused: (p: { club: string }) => `You stayed on the bench away at ${p.club}.`,
  visitInjured: (p: { club: string }) => `You missed the match away at ${p.club} through injury.`,
  visitBench: (p: { club: string }) =>
    `Did not play away at ${p.club} and caught up with former teammates after the match.`,
  rank: (p: { rank: number }) => `Estimated league finish: ${p.rank}`,
  competition: (p: { competition: string }) => `Next season: ${p.competition}`,
  noCompetition: 'No continental competition next season',
  estimateNote: 'Estimated from club strength, rather than current standings.',
  trophies: 'Season trophies',
};
