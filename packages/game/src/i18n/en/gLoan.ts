import type { Translation } from '@offside/contracts/i18n';
import type { gLoanText } from '../ko/gLoan';
export const gLoan: Translation<typeof gLoanText> = {
  title: 'Talk about playing time',
  text: 'Your minutes are not going up. Your agent brings up a loan for next season.',
  askLabel: 'Ask the club for a loan',
  askResult: 'The club accepted your request. They will look for a loan club when the season ends.',
  stayLabel: 'Stay and fight for a starting spot',
  stayResult: 'You were first in and last out at training. The manager has started to take notice.',
  stayFail: 'You gritted your teeth, but your name was missing from the next squad list too.',
};
