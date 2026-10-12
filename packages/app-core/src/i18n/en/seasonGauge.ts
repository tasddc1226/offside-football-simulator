import type { Translation } from '../core';
import type { SeasonGaugeMsgs } from '../ko/seasonGauge';

export const seasonGauge: Translation<SeasonGaugeMsgs> = {
  title: (p) => `${p.season} progress`,
  aria: (p) => `${p.season} progress ${p.pct}%`,
  endsIn: (p) => `Season ends in ${p.left}`,
  ended: 'The season is over. Final standings are being settled.',
  days: (p) => `${p.d}d ${p.h}h`,
  hours: (p) => `${p.h}h ${p.m}m`,
  minutes: (p) => `${p.m}m`,
  date: (p) =>
    `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][p.w]}, ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][p.m - 1]} ${p.d}`,
  endsOn: (p) => `Open through ${p.date}`,
  endsBy: (p) => `Open through ${p.date} at the latest`,
  endsBetween: (p) => `Open through ${p.from} at the earliest, ${p.to} at the latest`,
};
