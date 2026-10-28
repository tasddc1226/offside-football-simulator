import type { Translation } from '@offside/contracts/i18n';
import type { GRecordsMsgs } from '../ko/gRecords';

export const gRecords: Translation<GRecordsMsgs> = {
  chGoals: '生涯最多進球',
  chAssists: '生涯最多助攻',
  chApps: '生涯最多出場',
  chRating: '生涯最高評分',
  chCs: '生涯最多零封',
  msApps: (p) => `生涯出場${p.n}場`,
  msCaps: (p) => `國際A級賽出場${p.n}場`,
  msTrophy: (p) => `冠軍獎盃${p.n}座`,
  msGoals: (p) => `生涯${p.n}球`,
  msAssists: (p) => `生涯${p.n}次助攻`,
  storyEnding: (p) => `「${p.name}」 ${p.ending}`,
};
