import type { Translation } from '@offside/contracts/i18n';
import type { gLifeText } from '../ko/gLife';
export const gLife: Translation<typeof gLifeText> = {
  ntTitle: 'Thinking about international retirement',
  ntText: (p) =>
    `You are back from your ${p.caps}th cap. With club fixtures piling up, your body feels heavy. A reporter asks about your plans with the national team.`,
  ntRetireLabel: 'Announce your international retirement',
  ntRetireResult: (p) =>
    `You hung up your national team shirt after ${p.caps} caps. From now on you only play for your club.`,
  ntStayLabel: 'Say you will answer the next call-up',
  ntStayResult: '"I will go whenever they call." You kept it short and went back to club training.',
  ntRetiredLog: (p) => `Retired from international football (${p.caps} caps)`,
  wagsTitle: 'A message after the party',
  wagsText:
    'A singer turned TV host you met at the party sent you a message. They want to have dinner next week.',
  wagsPublicLabel: 'Meet openly at a restaurant',
  wagsPublicResult:
    'Photos of the dinner made the news. You are now a public couple, and the broadcast caught them cheering in the stands.',
  wagsPublicFail:
    'The photos got out first and dating rumors flooded the news. Reporters crowded the training ground the next day.',
  wagsQuietLabel: 'Meet quietly somewhere private',
  wagsQuietResult:
    'You found a spot only the two of you know. You feel at ease even the night before a match.',
  wagsDeclineLabel: 'Politely decline because it is mid-season',
  wagsDeclineResult:
    '"I will get in touch after the season." You sent the reply and headed to the video room.',
};
