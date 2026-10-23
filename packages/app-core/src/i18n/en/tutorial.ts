import type { Translation } from '../core';
import type { TutorialMsgs } from '../ko/tutorial';

export const tutorial: Translation<TutorialMsgs> = {
  step: (p) => `${p.n} / ${p.total}`,
  skip: 'Skip',
  next: 'Next',
  done: 'Got it',
  tapHint: 'Tap the highlighted spot',
  label: 'First career guide',
  newTitle: 'Create your first player',
  newBody: 'Follow one player from high school to retirement. Tap here to start.',
  posTitle: 'Pick a position',
  posBody: 'Each position values different attributes and builds different records.',
  focusTitle: (p) => `Pick ${p.n} focus attributes`,
  focusBody: 'The combination sets your player type and tilts your starting attributes that way.',
  candidatesTitle: 'See the candidates',
  candidatesBody: 'Once you have picked your focus attributes, tap this button.',
  candsTitle: 'Pick one of three candidates',
  candsBody:
    'They share the same attribute total but differ in spread and potential. Rerolls draw new candidates, and premium scout tickets find better ones.',
  startTitle: 'Start your career',
  startBody: 'Your pick heads into the first season.',
  goTitle: 'Play the season',
  goBody:
    'Each tap moves the season one step forward. Change training and self-investment in the cards above.',
  choiceTitle: 'An event has come up',
  choiceBody: 'Pick one. Your answer changes your attributes and popularity.',
  seasonTitle: 'Your first season is over',
  seasonBody: 'The year is summed up here. See how your attributes grew on the Player tab.',
  retireTitle: 'Retire into the Hall of Fame',
  retireBody:
    'Records, trophies and awards raise your legend score. Now carry on with your career.',
  replay: 'Replay the tutorial',
};
