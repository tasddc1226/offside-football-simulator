import type { Translation } from '../core';
import type { Best11Msgs } from '../ko/best11';
import { plural } from './_util';

export const best11: Translation<Best11Msgs> = {
  tab: 'BEST 11',
  title: (p) => `${p.season} BEST 11`,
  seasonAria: 'BEST 11 season',
  lead: 'Every season, the 11 brightest retired players take the pitch, one for each position.',
  provisional: 'Provisional',
  final: 'Final',
  provisionalUntil: (p) =>
    `During the season a slot changes hands whenever a better player retires. The team is final on ${p.when} (Korea time).`,
  provisionalOpen:
    'During the season a slot changes hands whenever a better player retires. The team is final when the season closes.',
  finalAt: (p) => `Final team, locked on ${p.day}.`,
  updated: (p) => `Updated ${p.when}`,
  loadFailed: "Couldn't load the BEST 11. Please try again in a moment.",
  empty: 'No retired player has qualified for the BEST 11 yet.',
  emptySlot: 'Open',
  slotAria: (p) => `${p.slot} · ${p.name} · BEST 11 index ${p.index}`,
  emptySlotAria: (p) => `${p.slot} · open`,
  pitchAria: 'BEST 11 pitch',
  pickHint: 'Tap a slot to see why the player was picked and the ranking for that slot.',
  index: 'BEST 11 index',
  pillarInd: 'Performance',
  pillarTeam: 'Team success',
  pillarAward: 'Awards',
  reasonTitle: 'Why this player',
  reasonPrime: (p) => `Best 5 seasons rating ${p.rating} · ${plural(p.apps, 'pro game')}`,
  leagues: (p) => `${plural(p.n, 'league title')}`,
  ucl: (p) => `${p.n}× Champions League`,
  wc: (p) => `${p.n}× World Cup`,
  noTeam: 'No team titles',
  ballon: (p) => `${p.n}× Ballon d'Or`,
  fifpro: (p) => `${p.n}× FIFPRO World 11`,
  posAwards: (p) => `${plural(p.n, 'position award')}`,
  noAward: 'No individual awards',
  since: (p) => `In this slot since ${p.when}`,
  openPlayer: 'View career',
  rankTitle: (p) => `${p.slot} ranking`,
  rankLead: 'Top 10 by index. Each owner holds one slot only.',
  cutline: (p) => `Current cut-off ${p.index}`,
  heldXi: (p) => `BEST 11 ${p.slot}`,
  heldOwner: 'Same owner',
  heldOwnerNote: 'Left out because another player from the same owner is in the BEST 11.',
  rankEmpty: 'No candidates for this slot yet.',
  changesTitle: 'Recent changes',
  changeIn: (p) => `${p.slot} ${p.out} → ${p.name}`,
  changeFirst: (p) => `${p.slot} first holder ${p.name}`,
  changeOut: (p) => `${p.slot} ${p.out} dropped`,
  hiddenName: 'Hidden player',
  criteriaTitle: 'How players are picked',
  criteria1:
    'Candidates are named players who retired that season with 300 pro games and five seasons of 20+ games.',
  criteria2:
    'The BEST 11 index is performance 50 · team success 30 · awards 20. In each pillar the best player in the slot scores 100.',
  criteria3:
    'Performance is the rating and positional stats of the best five seasons, adjusted for league strength.',
  criteria4:
    'Awards count the top three per season, and awards for your own position count double.',
  criteria5:
    'Each owner holds one slot only. Ties go to performance, then awards, then the earlier retirement.',
  reward: (p: { n: number; s: number; b: number }) =>
    `When the season is final, each slot's owner receives ${p.n} player reroll ticket(s), ${p.s} premium scout ticket(s) and ${p.b} potential boost ticket(s).`,
};
