import type { Translation } from '../core';
import type { OwnerMsgs } from '../ko/owner';
import { plural } from './_util';

export const owner: Translation<OwnerMsgs> = {
  title: 'Owner',
  summaryLabel: 'Owner summary',
  avatarInitial: 'O',
  guestName: 'Guest owner',
  guestSub: 'Records are saved only on this device',
  signedInSubWeb: 'Logged in with your Google account',
  signedInSubApp: 'Logged in',
  emptySummary:
    'Finish your first career and your retired players and Legend Score will show up here.',
  statClubValue: 'Club value',
  statRetired: 'Retired players',
  statLegend: 'Legend Score',
  statRetiredNumbers: 'Retired numbers',
  playersCount: (p) => `${p.text} ${p.n === 1 ? 'player' : 'players'}`,
  numbersCount: (p) => `${p.n}`,
  fundsLine: (p) => `Club funds ${p.funds}`,
  myTeam: 'My team',
  manager: (p) => `Manager ${p.manager} · ${p.formation}`,
  teamOvr: (p) => `Team OVR ${p.ovr}`,
  statRecord: 'Record',
  statRating: 'Rating',
  statToday: 'Matches today',
  play: 'Play match',
  teamFailed:
    'Build a team from your retired players each season. Compete for live rankings and club achievements.',
  loading: 'Loading…',
  buildTeam: 'Build a team',
  teamBtnApp: 'My team · season achievements',
  marketTitle: 'Transfer market',
  marketSub: (p) => `Club funds ${p.funds} · Buy and sell this season's players`,
  open: 'Open',
  lockBadge: '\u{1F512}︎ Unlocks when you log in',
  accountSection: 'Account',
  adminTools: 'Admin tools',
  teamEmptyWith: (p) =>
    `You can build a team from your ${plural(p.n, 'player')} who retired in ${p.season}. Youth players fill any empty spots.`,
  teamEmptyNone: (p) =>
    `Once you have a player who played and retired in ${p.season}, you can build a team.`,
  locked: (p) =>
    `Log in to build a team from ${p.players > 0 ? `your ${p.players} retired ${p.players === 1 ? 'player' : 'players'}` : 'your retired players'} and compete against other owners. Daily matches, live rankings and season achievements open up.`,
};
