import type { Translation } from '@offside/contracts/i18n';
import type { GRecordsMsgs } from '../ko/gRecords';

export const gRecords: Translation<GRecordsMsgs> = {
  chGoals: 'Career-high goals',
  chAssists: 'Career-high assists',
  chApps: 'Career-high appearances',
  chRating: 'Career-high rating',
  chCs: 'Career-high clean sheets',
  msApps: (p) => `${p.n} career appearances`,
  msCaps: (p) => `${p.n} international caps`,
  msTrophy: (p) => `${p.n} ${p.n === 1 ? 'trophy' : 'trophies'}`,
  msGoals: (p) => `${p.n} career goals`,
  msAssists: (p) => `${p.n} career assists`,
  storyEnding: (p) => `"${p.name}": ${p.ending}`,
};
