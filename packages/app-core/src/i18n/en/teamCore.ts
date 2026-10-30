import type { Translation } from '../core';
import type { TeamCoreMsgs } from '../ko/teamCore';
import { plural } from './_util';

export const teamCore: Translation<TeamCoreMsgs> = {
  record: (p) => `${p.w}W ${p.d}D ${p.l}L`,
  outWin: 'W',
  outDraw: 'D',
  outLoss: 'L',
  titleWin: 'Victory',
  titleDraw: 'Draw',
  titleLoss: 'Defeat',
  sortFit: 'Position rating',
  sortScore: 'Legend Score',
  sortPeak: 'Peak OVR',
  attrEstimated: 'Estimated attributes · ',
  hintNoTeam: 'Save your team to play matches.',
  hintDirty: 'Save your lineup changes to play matches.',
  hintNoStarters: 'Add at least one retired player to play matches.',
  hintNoMatches: "You've played all of today's matches. They reopen at midnight Korea time.",
  hintRest: 'The off-season break. You can play once the next season opens.',
  hintPast: 'Past-season teams are view only. Pick the current season to play.',
  achOneClubHint:
    'Checked after a player you raised retires: at least 10 total pro seasons and exactly one regular club. Sangmu and active-duty service are excluded from the club count.',
  achLongServiceHint:
    'Checked after a player you raised retires: at least 10 cumulative seasons at one regular club. Return spells count together; Sangmu and active-duty seasons do not.',
  achTeamFitHint: 'All 11 players need a fit of 1.00, with no youth players',
  achLevel: (p) => `Level ${p.level} · ${p.cur}`,
  achNext: (p) => ` · NEXT ${p.next}`,
  achMaxLevel: ' · Max level',
  achDone: 'Completed',
  achUndone: 'Not yet',
  achMissing: (p) => `Still to get: ${p.names}`,
  achUndoneHint: (p) => `Not yet · ${p.hint}`,
  achPointsGot: (p) => `+${p.n} pts`,
  achPointsWorth: (p) => `${p.n} pts`,
  achRewardNext: (p) => `Reward: ${p.items}`,
  achRewardGot: (p) => `Received: ${p.items}`,
  achRewardBoost: (p) => plural(p.n, 'potential boost ticket'),
  achRewardScout: (p) => plural(p.n, 'premium scout ticket'),
  achRewardReroll: (p) => plural(p.n, 'reroll ticket'),
  achRankNone: 'Complete an achievement to join the ranking',
  achRank: (p) => `#${p.rank} of ${p.ranked}`,
  achCatPlayer: 'Player achievements',
  achCatTeam: 'Team achievements',
  achCatOwner: 'Owner achievements',
  achCatManager: 'Manager achievements',
  achCatShortPlayer: 'Player',
  achCatShortTeam: 'Team',
  achCatShortOwner: 'Owner',
  achCatShortManager: 'Manager',
  gradeRookie: 'Rookie',
  gradeBronze: 'Bronze',
  gradeSilver: 'Silver',
  gradeGold: 'Gold',
  gradePlatinum: 'Platinum',
  gradeDiamond: 'Diamond',
  gradeLegend: 'Legend',
  cupTeamNote: (p: { season: string }) =>
    `Your ${p.season} team is playing in the OFFSIDE Cup. You can change its lineup until the cup ends.`,
  cupTeamLink: (p: { season: string }) => `Edit your ${p.season} cup team`,
  preseasonTeamNote:
    'Built from the preseason players you still own. This team only plays friendlies with friends, and your preseason ranking and achievements stay as they are.',
  hintCupTeam:
    'This team only plays in the OFFSIDE Cup. Ranked matches use your current-season team.',
  hintPreseason:
    'Your preseason team only plays friendlies with friends. Use your current season team for ranked matches.',
  salaryBar: (p) => `Past-season salaries ${p.n} / ${p.max}`,
  salaryFull: (p) =>
    `This player's salary (${p.salary}) is more than your remaining budget (${p.left}). Bench a past-season player or use this season's players.`,
  salaryChip: (p) => `Salary ${p.n}`,
  salaryOver: 'Over budget',
  // T-11-571 리그 체력
  staminaLabel: 'Stamina',
  staminaAria: (p: { left: number; total: number; pct: number }) =>
    p.pct
      ? `Stamina ${p.left}/${p.total} · next league match −${p.pct}%`
      : `Stamina ${p.left}/${p.total} · fresh`,
  fatigueHint:
    'Players who start 3 league matches in a row get tired and play a little worse. One match of rest brings them back.',
  salaryLeft: (p) => `${p.n} left`,
  salaryOpen: 'Open salary guide',
  salaryOverSave: (p) =>
    `Past-season salaries are over budget (${p.n}/${p.max}), so the team can't be saved. Swap in lower-salary or this-season players.`,
  salaryLabel: 'Salary',
  salaryLater: (p) => `None this season · ${p.n} from next season`,
};
