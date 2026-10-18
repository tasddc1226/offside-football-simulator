import type { Translation } from '../core';
import type { SalaryMsgs } from '../ko/salary';

export const salary: Translation<SalaryMsgs> = {
  title: 'Salary guide',
  close: 'Close',
  intro:
    'Past-season players in your starting 11 draw a salary. Their salaries must add up to no more than the budget before you can save the team.',
  free: "This season's players have no salary. Start as many as you like.",
  budget: 'Budget',
  used: 'In use',
  left: 'Remaining',
  tableTitle: 'Salary table',
  tableNote:
    "Set by the card's peak OVR. It doesn't matter whether you raised or signed the player.",
  tableOvr: 'Peak OVR',
  tableSalary: 'Salary',
  bandLow: (p) => `${p.n} or lower`,
  bandRange: (p) => `${p.a}–${p.b}`,
  bandHigh: (p) => `${p.n} or higher`,
  examplesTitle: (p) => `Examples within a budget of ${p.budget}`,
  example: (p) => `${p.n} players at OVR ${p.band} (salary ${p.sum})`,
  examplesNote: 'You can mix them. Only the total has to fit the budget.',
  howTitle: 'When you pick',
  how1: 'Players who would go over budget show "Over budget" in the pick list. Bench a past-season player to free up that much.',
  how2: 'Swapping two starters keeps the total the same.',
  how3: 'Auto-fill picks the strongest lineup within the budget.',
  whyTitle: 'Why salaries?',
  why1: "To keep raising new players fun every season. This season's players are always the cheapest strength.",
  why2: 'You used to be able to start only three past-season players. With salaries you can also start several mid-level players instead.',
  why3: 'The top salary is 20, so three past-season players always fit a budget of 60. Lineups you built before still work.',
  why4: "Club funds and purchases can't raise the budget.",
};
