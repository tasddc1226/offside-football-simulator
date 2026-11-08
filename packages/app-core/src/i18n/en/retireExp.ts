import type { Translation } from '../core';
import type { RetireExpMsgs } from '../ko/retireExp';
import { plural } from './_util';

export const retireExp: Translation<RetireExpMsgs> = {
  eyebrow: 'Key Scenes',
  title: 'Scenes from this career',
  note: 'Picked from your saved season records.',
  firstApps: 'First recorded appearance',
  peakRating: 'Best-rated season',
  lastApps: 'Last season with appearances',
  when: (p) => `${p.year} · age ${p.age} · ${p.club}`,
  stats: (p) =>
    `${plural(p.apps, 'app')}, ${plural(p.goals, 'goal')}, ${plural(p.assists, 'assist')}`,
  statsBack: (p) =>
    `${plural(p.apps, 'app')}, ${plural(p.goals, 'goal')}, ${plural(p.cs, 'clean sheet')}`,
  rating: (p) => `Rating ${p.rating}`,
  league: (p) => `${p.league} · OVR ${p.ovr}`,
  leagueRank: (p) => `${p.league}, finished ${p.rank} · OVR ${p.ovr}`,
  honors: (p) => `Trophies and awards this season: ${p.list}`,
  open: 'Details',
  close: 'Hide',
  nextEyebrow: 'My Club',
  nextTitle: 'At your club',
  nextTeam: 'The record reached the server. You can pick this player in your team lineup.',
  nextLogin:
    'The record reached the server. Sign in to build a team with this player and play other owners.',
  nextClub: 'Retired players that reach the server join your club roster.',
  nextWait: 'Sending the record to the server. Once it arrives, the player joins your club roster.',
  nextBlocked: 'The record did not reach the server, so this player cannot be used at your club.',
  ctaTeam: 'Open team lineup',
  ctaLogin: 'Sign in and build a team',
  ctaClub: 'View my club',
};
