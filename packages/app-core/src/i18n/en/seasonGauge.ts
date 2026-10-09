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
};
