import type { Translation } from '../core';
import type { GameActionsMsgs } from '../ko/gameActions';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const gameActions: Translation<GameActionsMsgs> = {
  natDetail: (p) =>
    `${p.mins} min${p.g ? `, ${plural(p.g, 'goal')}` : ''}${p.a ? `, ${plural(p.a, 'assist')}` : ''} · rating ${p.rating}`,
  natBench: 'Bench',
  natNotInSquad: 'Not in squad',
  natNoMedal: 'No medal',
  natTourLine: (p) =>
    `${p.stage} · ${p.score}${p.mins ? ` · ${p.g ? plural(p.g, 'goal') + ', ' : ''}${p.a ? plural(p.a, 'assist') + ', ' : ''}rating ${p.rating}` : ''}`,
  preseasonDone: 'Preseason complete',
  phaseResult: (p) => `${p.phase} results`,
  stepComps: 'Tallying cup and continental results',
  stepNat: 'International squad announced',
  stepEvent: 'There is news…',
  phaseRunning: (p) => `${p.year} · ${p.phase} in progress`,
  blockTitle: (p) => `${p.range} · ${plural(p.n, 'match', 'matches')}`,
  preseasonRunning: (p) => `${p.year} · Preseason in progress`,
  stepCampPro: 'Arriving at training camp',
  stepCampAmateur: 'Winter training begins',
  stepFitness: 'Fitness test',
  stepTactics: 'Tactical training',
  stepFriendly: 'Friendly match',
  preseasonReady: "You're ready for the season",
  endRunning: (p) => `${p.year} · Wrapping up the season`,
  endTable: 'Finalising the league table',
  endTours: 'Adding international tournament results',
  endAwards: 'Season awards',
  endRecords: 'Filing career records',
  oddsSafe: 'Safe',
  oddsSafeHint: 'The result is certain, but the reward is smaller and there may be a cost',
  oddsSure: 'Sure',
  oddsMinigame: (p) => `One-tap · ${p.zone}`,
  oddsMinigameHint:
    'Tap when the needle is in the green zone to succeed. Your attributes set the zone width',
  outcomeOk: 'Success',
  outcomeFail: 'Failed',
  outcomeDecided: 'Decided',
  ok: 'OK',
  colCs: 'Clean sheets',
  colAssists: 'Assists',
  seasonTitle: (p) =>
    `${p.club} · ${p.league} ${p.rank}${typeof p.rank === 'number' ? ord(p.rank) : ''}`,
  compLine: (p) =>
    `${p.name} · ${p.stage} · ${plural(p.apps, 'match', 'matches')}, ${plural(p.g, 'goal')}, ${plural(p.a, 'assist')}`,
  toMarket: 'To the transfer window →',
  strLine: (p) => `${p.league} · Team strength ${p.str} (league average ${p.avg})`,
  feeAbout: (p) => `Fee about ${p.fee}`,
  freeAgent: 'Free agent',
  contractYears: (p) => `${plural(p.years, 'year')} contract`,
  renewExtension: (p) =>
    `1 year left · ${plural(p.ext, 'year')} extension · ${plural(p.total, 'year')} in total. ${p.desc}`,
  retireBtn: 'Retire',
  contractTitleExt: 'Sign the extension?',
  contractTitleRookie: 'Sign the pro contract?',
  contractTitleTransfer: 'Sign the transfer contract?',
  contractTextExt:
    'This adds time to your current contract. The new salary applies from this season.',
  contractTextStart: (p) =>
    p.rookie ? `Start your first pro season with ${p.club}.` : `Start a new season with ${p.club}.`,
  termSalary: 'Salary',
  termLeft: 'Time left',
  termLeftValue: '1 year',
  termExtra: 'Extension',
  termTotal: 'Total length',
  termPeriod: 'Length',
  termYears: (p) => plural(p.n, 'year'),
  termFee: 'Transfer fee',
  termFeeValue: (p) => `About ${p.fee}`,
  termRole: 'Role',
  ctaExt: 'Sign and extend',
  ctaRookie: 'Sign and join as a pro',
  ctaTransfer: 'Sign and transfer',
  flyingTo: (p) => `Flying to ${p.city}`,
  flightSub: (p) => `${p.country} · ${p.league} · about ${plural(p.hours, 'hour')} flight`,
  milEyebrow: 'Military service',
  milServe: 'Serve',
  milPass: 'Accepted',
  milDecided: 'Decided',
  startSeasonBtn: (p) => `Start ${p.year} season →`,
  startSeasonToast: (p) => `${p.year} season starts!`,
  newTitle: 'Start over?',
  newText: (p) =>
    `${p.name}'s career in progress will be lost. Only retired players stay in the Hall of Fame.`,
  newBtn: 'Start a new career',
  cancel: 'Cancel',
  retireTitle: 'Retire for real?',
  retireTextHof:
    "If you retire, this player's career is recorded in the Hall of Fame and you can't play on.",
  retireTextShort: (p) => `If you retire, you can't play on. ${p.note}`,
  retireYes: 'Retire',
  retireStay: 'Play on',
  careerStartToast: 'Your final high school season begins',
};

function ord(n: number): string {
  const m = n % 100;
  if (m >= 11 && m <= 13) return 'th';
  return n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
}
