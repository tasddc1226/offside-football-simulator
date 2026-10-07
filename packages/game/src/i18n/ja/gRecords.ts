import type { Translation } from '@offside/contracts/i18n';
import type { GRecordsMsgs } from '../ko/gRecords';

export const gRecords: Translation<GRecordsMsgs> = {
  chGoals: 'キャリア最多ゴール',
  chAssists: 'キャリア最多アシスト',
  chApps: 'キャリア最多出場',
  chRating: 'キャリア最高評価点',
  chCs: 'キャリア最多無失点',
  msApps: (p) => `通算${p.n}試合出場`,
  msCaps: (p) => `Aマッチ${p.n}試合出場`,
  msTrophy: (p) => `優勝トロフィー${p.n}回`,
  msGoals: (p) => `通算${p.n}ゴール`,
  msAssists: (p) => `通算${p.n}アシスト`,
  storyEnding: (p) => `「${p.name}」 ${p.ending}`,
};
