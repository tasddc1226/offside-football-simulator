import type { Translation } from '@offside/contracts/i18n';
import type { gLoanText } from '../ko/gLoan';
export const gLoan: Translation<typeof gLoanText> = {
  returnTitle: 'Back from loan',
  returnRecord: (p: { club: string; apps: number }) =>
    `You are back after ${p.apps} appearances for ${p.club}. The manager asks, “Which number should we look at halfway through the season?”`,
  returnPrompt: 'The manager asks for your first-half target.',
  pickStarts: 'Promise five league starts',
  pickMinutes: 'Promise 450 league minutes',
  promiseStarts: 'The manager books a midseason meeting. Your target is five league starts.',
  promiseMinutes:
    'The manager books a midseason meeting. Minutes off the bench count towards the 450.',
  startsTitle: 'Midseason meeting: Starts',
  minutesTitle: 'Midseason meeting: Minutes',
  startsReport: (p: { actual: number }) =>
    `The manager lays out the team sheets. You promised five league starts and made ${p.actual}.`,
  minutesReport: (p: { actual: number }) =>
    `The manager opens the match log. You promised 450 league minutes and played ${p.actual}.`,
  roleLabel: 'Discuss my role for the second half',
  trainingLabel: 'Ask what to work on in training',
  roleMet: '“You kept your word.” The manager turns the tactics board towards you.',
  roleMiss: 'The manager points at an empty spot. “I can’t promise you a place yet.”',
  trainMet: 'You watch footage from the matches that got you there and pick something to practise.',
  trainMiss: 'You fell short. You and the coach agree on one thing to try at the next session.',
  title: 'Talk about playing time',
  text: 'Your minutes are not going up. Your agent brings up a loan for next season.',
  askLabel: 'Ask the club for a loan',
  askResult: 'The club accepted your request. They will look for a loan club when the season ends.',
  stayLabel: 'Stay and fight for a starting spot',
  stayResult: 'You were first in and last out at training. The manager has started to take notice.',
  stayFail: 'You gritted your teeth, but your name was missing from the next squad list too.',
};
