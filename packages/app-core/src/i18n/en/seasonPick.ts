import type { Translation } from '../core';
import type { SeasonPickMsgs } from '../ko/seasonPick';

export const seasonPick: Translation<SeasonPickMsgs> = {
  live: 'Live',
  closed: 'Ended',
  upcoming: 'Upcoming',
  face: (p) => `${p.name} · ${p.status}`,
  row: (p) => `${p.name} · ${p.period} · ${p.status}`,
  detail: (p) => `${p.period} · ${p.status}`,
  periodFrom: (p) => `${p.from} ~`,
  periodRange: (p) => `${p.from} ~ ${p.to}`,
  periodUntil: (p) => `~ ${p.to}`,
};
