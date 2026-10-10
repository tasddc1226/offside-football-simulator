import type { Translation } from '../core';
import type { LegendRnMsgs } from '../ko/legendRn';
import { plural } from './_util';

export const legendRn: Translation<LegendRnMsgs> = {
  missKicker: 'Retired number review',
  missSeasons: (p: { club: string; seasons: number; need: number }) =>
    `You played ${p.seasons} seasons at ${p.club}. A retired number needs ${p.need}+ seasons at one club.`,
  missScore: (p: { club: string; pct: number }) =>
    `Your contribution at ${p.club} reached ${p.pct}% of the retired number bar. You need to pass it to have your number retired.`,
  pending: 'The server is reviewing your retired number. Check the Hall of Fame in a moment.',
  lineNum: (p) => `No. ${p.number}`,
  lineNumAfter: ' now belongs to',
  lineNameAfter: '.',
  stats: (p) =>
    `${p.from}–${p.to} · ${plural(p.seasons, 'season')} · ${p.apps} apps, ${plural(p.goals, 'goal')}, ${plural(p.assists, 'assist')}`,
  foot: (p) => `${p.club} retired number · server retirement No. ${p.seq}`,
  takenA: (p) => `No. ${p.number} is already held by`,
  anonLegend: 'an anonymous legend',
  takenB: ',',
  takenC: 'so the club has put',
  takenD: ' on the Wall of Honor.',
  anonA: 'Make your name public and',
  anonSlot: (p) => `${p.club} No. ${p.number}`,
  anonTail: 'will be retired for you.',
  anonNote: 'The first player to make their name public gets the number.',
  publish: 'Go public and claim the number',
  alertTitle: (p) => `👑 ${p.name}: No. ${p.number} retired`,
  alertSub: (p) => `${p.club} · server retirement No. ${p.seq}`,
  alertLabel: (p) => `${p.name}, No. ${p.number} retired`,
  alertOpen: 'View',
  alertClose: 'Dismiss notification',
  jerseyLabel: (p) => `${p.name} retired No. ${p.number} jersey`,
  wallOfHonor: "You earned the ‘Wall of Honour’ title. It isn't a retired number.",
};
