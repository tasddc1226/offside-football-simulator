import { HOMEGROWN_MIN, NATIONAL_MIN } from '@offside/contracts/owner-team';
import type { Translation } from '../core';
import type { TeamSynergyMsgs } from '../ko/teamSynergy';

const NAMES: Record<string, readonly [string, string]> = {
  cross: ['Cross and head', 'Target man striker + a winger or attacking fullback out wide'],
  engine: ['Midfield engine', 'Box-to-box + playmaker together in midfield'],
  wall: ['Brick wall', 'Shot-stopper goalkeeper + two stopper center-backs'],
  cb_pair: ['Center-back pair', 'Stopper + ball-playing center-back together at center-back'],
  buildup: ['Build from the back', 'Sweeper keeper + ball-playing center-back'],
  counter: ['Counterpunch', 'Speedster forward + a playmaker threading passes from behind'],
  overlap: ['Overlapping run', 'Attacking fullback + winger on the same flank'],
  killpass: ['Killer pass', 'Poacher striker + a playmaker at attacking or central midfield'],
  guardian: ['Guardian angel', 'Super-saver goalkeeper + stopper center-back'],
  homegrown: ['Homegrown XI', `${HOMEGROWN_MIN}+ players you raised in the starting lineup`],
  national: ['National team lineup', `${NATIONAL_MIN}+ starters from the same country`],
  foot: ['Strong-foot fit', 'Fullbacks on their strong side, wingers on the opposite foot'],
};

export const teamSynergy: Translation<TeamSynergyMsgs> = {
  capped: 'No effect (cap reached)',
  noEffect: 'No match effect',
  applies: 'Every active synergy counts in matches',
  notApplied: 'Did not count in preseason matches',
  footChip: (p) => `${p.name} ×${p.n}`,
  fitEffect: (p) => `Position rating ${p.v}`,
  fitEffectBoth: (p) => `Position rating ${p.v} (two-footed ${p.both})`,
  badgeOnly: 'Badge only (no match effect)',
  title: 'Team synergy',
  chipApplied: 'Active',
  chipViewing: 'Showing',
  chipHint: 'Tap a chip to show its players on the pitch. It does not change what applies.',
  pitchAll: (p) => `All ${p.n} synergies active`,
  pitchFocus: (p) => `Showing ${p.name} · all ${p.n} active`,
  pitchMemberAria: 'In an active synergy',
  empty: 'No synergies active yet. Line up players whose types work together.',
  tableToggle: (p) => (p.open ? 'Hide synergy table' : 'Show synergy table'),
  capNote: (p) =>
    `Duo effects are capped at +${p.line} per line and +${p.total} in total. Youth players don't count toward synergies.`,
  synName: (p) => NAMES[p.id]?.[0] ?? p.ko,
  synDesc: (p) => NAMES[p.id]?.[1] ?? p.ko,
};
