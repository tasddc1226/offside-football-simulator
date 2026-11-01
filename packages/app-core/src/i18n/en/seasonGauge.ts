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
  why: (p) => `${p.n} players are filling it together. The goal grows as more players join.`,
  openLabel: (p) => `${p.aria}. Show how season progress works`,
  infoTitle: 'Season progress',
  infoWhatHead: 'Service seasons',
  infoWhat:
    'Records and rankings are kept separately for each service season. A season has no fixed length. It ends when everyone fills this gauge together.',
  infoFillHead: 'What fills the gauge',
  infoFill: (p) =>
    `Careers whose player retired at age ${p.age} or older fill the gauge. Each person can add up to ${p.cap} careers a day. The goal is ${p.per} careers per participant (anyone with at least one career played through to retirement), so it grows as more players join.`,
  infoEndHead: 'Closing',
  infoEnd: (p) =>
    `At ${p.lock}%, a closing time is set and a countdown appears. A season lasts at least ${p.min} days and at most ${p.max} days. If the Offside Cup is still running, the season continues until midnight KST on the day after the last match. The league plays until the day before the close and is settled then. The next season opens at the closing time.`,
  infoCareerHead: 'Careers in progress',
  infoCareer:
    'A career in progress keeps going after the season ends. A player belongs to the season in which their first season record reached the server, and that does not change when the next season opens. Season recap ranking badges and completion records only count players who retired before the close.',
  infoWhereHead: 'Rewards and achievements',
  infoWhere:
    'Find season recaps and record badges in the Hall of Honors under My club, and achievements in the Achievements tab of My team. In a new season you create a new owner team. Player cards, club funds and items carry over.',
  infoClose: 'Close',
};
