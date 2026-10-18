import type { Translation } from '../core';
import type { RatingReportMsgs } from '../ko/ratingReport';

export const ratingReport: Translation<RatingReportMsgs> = {
  partsTitle: 'Rating breakdown · per match',
  partBase: 'Base',
  partGoals: 'Goals',
  partAssists: 'Assists',
  partOvrEdge: 'OVR edge',
  partCond: 'Condition',
  partMorale: 'Morale',
  partForm: 'Form on the day',
  partCs: 'Clean sheet',
  partDef: 'Defending',
  partResult: 'Team result',
  partLuck: 'Other swings',
  partsAria: (p) => `Rating breakdown: ${p.list}`,
  dirTitle: 'Growth direction',
  dirGoal: (p) =>
    `${p.attr} carries the most weight for goals at ${p.pct}%. It is ${p.n} ${p.up ? 'above' : 'below'} the league average.`,
  dirAssist: (p) =>
    `${p.attr} carries the most weight for assists at ${p.pct}%. It is ${p.n} ${p.up ? 'above' : 'below'} the league average.`,
  dirKnee:
    'Your attacking stats are well above the league average. Raising them further adds goals and assists only slowly.',
  dirDef: (p) =>
    `Defense above the league average adds to your rating. You are ${p.n} ${p.up ? 'above' : 'below'} it.`,
};
