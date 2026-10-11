import { HOMEGROWN_MIN, NATIONAL_MIN } from '@offside/contracts/owner-team';
import type { Translation } from '../core';
import type { TeamSynergyMsgs } from '../ko/teamSynergy';

const NAMES: Record<string, readonly [string, string]> = {
  cross: [
    'Cross and head',
    'Target man type at ST / CF / SS + Winger or Attacking fullback type at W / LW / RW / FB / LB / RB / LWB / RWB',
  ],
  engine: ['Midfield engine', 'Box-to-box + Playmaker types, both at DM / CM / AM / LM / RM'],
  wall: ['Brick wall', 'The wall type at GK + two Stopper types at CB / SW'],
  cb_pair: ['Center-back pair', 'Stopper + Ball-playing center-back types, both at CB / SW'],
  buildup: [
    'Build from the back',
    'Sweeper keeper type at GK + Ball-playing center-back type at CB / SW',
  ],
  counter: [
    'Counterpunch',
    'Speedster type at ST / CF / SS / W / LW / RW + Playmaker type at DM / CM / LM / RM',
  ],
  overlap: [
    'Overlapping run',
    'Same flank: Attacking fullback type at FB / LB / RB / LWB / RWB + Winger type at W / LW / RW',
  ],
  killpass: ['Killer pass', 'Poacher type at ST / CF / SS + Playmaker type at AM / CM / LM / RM'],
  guardian: ['Guardian angel', 'Shot-stopper type at GK + Stopper type at CB / SW'],
  homegrown: ['Homegrown XI', `${HOMEGROWN_MIN}+ players you raised in the starting lineup`],
  national: ['National team lineup', `${NATIONAL_MIN}+ starters from the same country`],
  foot: [
    'Strong-foot fit',
    'FB / LB / RB / LWB / RWB: same-side foot. W / LW / RW: opposite foot. Any player type.',
  ],
};

export const teamSynergy: Translation<TeamSynergyMsgs> = {
  noEffect: 'No match effect',
  applies: 'All synergies with match effects count',
  notApplied: 'Did not count in preseason matches',
  footChip: (p) => `${p.name} ×${p.n}`,
  fitEffect: (p) => `Position rating ${p.v}`,
  fitEffectBoth: (p) => `Position rating ${p.v} (two-footed ${p.both})`,
  badgeOnly: 'Badge only (no match effect)',
  requirementsHint:
    'Duos need both the player type and a listed position. Tap a player card to check the type. A Speedster at W / LW / RW does not meet the Winger type requirement.',
  title: 'Team synergy',
  chipApplied: 'Active',
  chipViewing: 'Showing',
  chipNoEffect: 'No effect',
  chipOff: 'Inactive',
  chipHint:
    'Tap a synergy to show its players. Match effects apply regardless of selection. National team lineup is a badge only.',
  pitchAll: (p) => `All ${p.n} synergies active`,
  pitchFocus: (p) => `Showing ${p.name} · all ${p.n} active`,
  pitchMemberAria: 'In an active synergy',
  moreOff: (p) => `Show more · ${p.n} inactive`,
  lessOff: 'Hide inactive',
  empty: 'No synergies active yet.',
  youthNote:
    'Each duo applies once, even with multiple matching pairs. Different synergy effects add up. Youth players are excluded.',
  synName: (p) => NAMES[p.id]?.[0] ?? p.ko,
  synDesc: (p) => NAMES[p.id]?.[1] ?? p.ko,
};
