import type { Translation } from '@offside/contracts/i18n';
import type { GTrainingMsgs } from '../ko/gTraining';

export const gTraining: Translation<GTrainingMsgs> = {
  attrTraining: (p) => `${p.attr} training`,
  rest: 'Rest and recovery',
  coach: 'Personal coach',
  media: 'Media work',
  condition: (p) => `Condition ${p.v}`,
  morale: (p) => `Morale ${p.v}`,
  allAttrsUp: 'All attributes ▲ (slightly)',
  cost: (p) => `Cost ${p.money}`,
  fameRange: (p) => `Fame +${p.lo}-${p.hi}`,
  income: (p) => `Income +${p.money}`,
  attrUp: (p) => `${p.attr} ▲`,
  attrPairUp: (p) => `${p.a}, ${p.b} ▲`,
  focusGrowth: (p) => `Focus growth +${p.pct}%`,
  tooFarAhead: (p) => `Too far ahead: growth −${p.pct}%`,
  helpRest: (p) =>
    `Skip training and recover. Below ${p.low} condition your injury risk rises sharply, and below ${p.start} you will struggle to start.`,
  helpCoach:
    'Builds every attribute that counts towards OVR a little. If funds run short, it becomes a light session that restores condition.',
  helpMedia: (p) =>
    `Get your name out through interviews and adverts. The higher your fame, the better your chances of call-ups, transfer offers and endorsements.${p.contract ? ' You are under contract, so you also get an appearance fee.' : ''}`,
  helpAttrMain: (p) =>
    `${p.attr} rises a lot, and there is a 50% chance one other attribute rises a little too.`,
  helpPhy: (p) => `${p.pac} rises as well, but your condition drops further.`,
  helpFocus: (p) => `It is a focus attribute, so it grows ${p.pct}% faster.`,
  helpOffFocus: (p) => `It is not a focus attribute, so it grows ${p.pct}% slower.`,
  helpLopsided: (p) =>
    `It is too far ahead of your other key attributes, so growth is down ${p.pct}%. Build the others up to lift the limit.`,
  helpWeightLow: 'It barely counts towards OVR in your current position.',
  helpWeight: (p) => `${p.attr} makes up ${p.pct}% of OVR in your current position.`,
  coachBroke: 'You could not afford a personal coach and trained on your own instead.',
  investBroke: (p) => `You could not afford the “${p.label}” investment, so it was cancelled.`,
  investNone: 'No investment',
  investWeak: 'Weakness camp',
  investBest: 'Strength camp',
  investMedical: 'Medical care',
  investMental: 'Mental coaching',
  investSaveMoney: 'Save your money',
  investMedicalInjury: (p) => `Injury layoff −${p.games} ${p.games === 1 ? 'match' : 'matches'}`,
  investShort: 'Not enough funds',
  helpInvestNone: 'You spend nothing this period.',
  helpInvestMedical: (p) =>
    `A dedicated medical team looks after your body. Condition rises, and if you are injured you return ${p.games} ${p.games === 1 ? 'match' : 'matches'} sooner.`,
  helpInvestMental:
    'You talk with a sports psychologist. The higher your morale, the better your form and growth.',
  helpInvestWeak: (p) => `Lifts your lowest key attribute (${p.attr}) separately.`,
  helpInvestBest: (p) => `Sharpens your highest key attribute (${p.attr}) further.`,
  helpInvestGain: (p) =>
    `On top of your training, it adds about ${p.pct}% of the gain from one attribute session.`,
  helpInvestLopsided: (p) =>
    `It is too far ahead of your other attributes, so growth is down ${p.pct}%.`,
  helpInvestSkip: 'If funds run short, the investment is skipped and set to “No investment”.',
};
