import type { Translation } from '../core';
import type { FairnessMsgs } from '../ko/fairness';

export const fairness: Translation<FairnessMsgs> = {
  title: 'Odds and fairness',
  intro:
    'Under the same conditions, every player gets the same rules and the same odds. The numbers below are calculated straight from the game code.',
  promiseSameTerm: 'Same rules',
  promiseSame:
    'Watching ads, buying ad removal, linking an account and your language never affect odds. Ads or club funds can give extra potential boost tries in a season when you are short of funds, but the success chance stays the same. The only paid item that changes odds is the premium scout ticket, and its odds are all shown below.',
  promiseDeviceTerm: 'Decided on your device',
  promiseDevice:
    'Every roll in your career happens on this device. The server only receives records and never decides results.',
  promiseShownTerm: 'Shown odds are real odds',
  promiseShown:
    'The percentage on a choice is its real success chance. Only timing-gauge choices are decided by where you stop the needle.',
  promiseVersionTerm: 'Changes are versioned',
  promiseVersion:
    'When values are tuned, every player gets the same values under a new version. Careers in progress switch over at the next season.',
  potTitle: 'Potential grade odds',
  potNote:
    "A new player's real potential is drawn with these odds. Viewing the grade range with an ad never changes it.",
  gradeHead: 'Grade',
  colSeason: 'Mid-season start',
  colPre: 'Preseason start',
  atLeastOne: (p) =>
    `The chance that at least 1 of 3 candidates is grade ${p.grade} is ${p.season} mid-season and ${p.pre} in preseason.`,
  premium: (p) =>
    `With a premium scout ticket, 1 of the 3 candidates is guaranteed grade A or higher. Every candidate's chance of S is doubled: ${p.season} mid-season and ${p.pre} in preseason. The other candidates keep the A–D ratios in the table above.`,
  boostTitle: 'Potential boost odds',
  boostLv: (p) => `Step +${p.lv}`,
  boostNote: (p) =>
    `Each failure at the same step raises the next chance by ${p.pity}. Trying with an ad or club funds uses the same odds.`,
  hiddenTitle: 'What stays hidden and why',
  hiddenPotTerm: 'Real potential',
  hiddenPot: 'Revealed when you retire. Scouting ratings can differ a little from the real value.',
  hiddenBloomTerm: 'Late bloomers',
  hiddenBloom:
    'Real potential drifts up or down until age 25 and is applied at the re-evaluations at 21 and 24. The rule is the same for every player.',
  hiddenStoryTerm: 'Story and special events',
  hiddenStory:
    'They unlock in the guide only after you experience them, to avoid spoilers. Their odds follow the same rules.',
  historyTitle: 'Balance change history',
  historyLoading: 'Loading history…',
  historyError: "Couldn't load the history.",
  historyEmpty: 'Nothing has changed yet. Every career runs on the default balance.',
  historyVersion: (p) => `Version ${p.v} · ${p.day}`,
  historyActive: 'Current',
  historySame: 'No values changed.',
  historyNote:
    'Each item shows the previous version value and the new value. Dates are in Korea time.',
  version: (p) =>
    p.v
      ? `New careers currently use balance version ${p.v}.`
      : 'New careers currently use the default balance (version 0).',
};
