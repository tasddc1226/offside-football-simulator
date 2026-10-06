import type { Translation } from '../core';
import type { GamePlayerMsgs } from '../ko/gamePlayer';
import { plural } from './_util';

export const gamePlayer: Translation<GamePlayerMsgs> = {
  profile: 'Player info',
  nation: 'Nationality',
  body: 'Build',
  foot: 'Preferred foot',
  trait: 'Growth trait',
  potential: 'Potential rating',
  peakOvr: 'Peak OVR',
  trust: 'Manager trust',
  trustHigh: 'Strong',
  trustMid: 'Average',
  trustLow: 'Cold',
  contract: 'Contract',
  contractLeft: (p) => `${p.years} yr left · ${p.salary}/yr`,
  amateur: 'Amateur',
  money: 'Funds',
  value: 'Est. market value',
  nationalTitle: 'National team',
  caps: 'Caps',
  goals: 'Goals',
  assists: 'Assists',
  captain: 'Captain',
  debut: 'International debut',
  notCalled: 'Not called up',
  military: 'Military service',
  nextWc: 'Next World Cup',
  hostTbd: 'Host to be decided',
  tourLine: (p) => `${p.stage} · ${plural(p.apps, 'app')}, ${plural(p.goals, 'goal')}`,
  retire: 'Announce retirement',
};
