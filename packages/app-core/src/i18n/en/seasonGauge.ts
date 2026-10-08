import type { Translation } from '../core';
import type { SeasonGaugeMsgs } from '../ko/seasonGauge';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const seasonGauge: Translation<SeasonGaugeMsgs> = {
  title: (p) => `${p.season} progress`,
  aria: (p) => `${p.season} progress ${p.pct}%`,
  filled: (p) => `Full careers ${p.count} / ${p.target}`,
  owners: (p) => `${p.n} owners taking part`,
  howTo:
    'Careers played to the end (retired at 35+) fill the gauge. At 90%, the closing date is set.',
  window: (p) => `Ends no earlier than ${p.min} 00:00 KST and no later than ${p.max} 00:00 KST.`,
  endsIn: (p) => `Season ends in ${p.left}`,
  endsAt: (p) => `Closes ${p.date} 00:00 KST · Retirements after that don't count for this season.`,
  ended: 'The season is over. Final standings are being settled.',
  date: (p) => `${MONTHS[p.m - 1]} ${p.d}`,
  days: (p) => `${p.d}d ${p.h}h`,
  hours: (p) => `${p.h}h ${p.m}m`,
  minutes: (p) => `${p.m}m`,
};
