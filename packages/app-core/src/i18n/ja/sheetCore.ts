import type { Translation } from '../core';
import type { SheetCoreMsgs } from '../ko/sheetCore';

export const sheetCore: Translation<SheetCoreMsgs> = {
  skip: 'スキップ',
  tallyApps: '出場',
  tallyGoals: 'ゴール',
  tallyCleanSheets: '無失点',
  tallyAssists: 'アシスト',
  tallyRating: '評価点',
  wdl: (p) => `${p.w}勝${p.d}分${p.l}敗`,
  tickerMins: (p) => `${p.n}分`,
  tickerGoals: (p) => `${p.n}ゴール`,
  tickerAssists: (p) => `${p.n}アシスト`,
  tickerInjured: '負傷欠場',
  tickerNone: '出場なし',
  judging: '判定中',
  judgeOk: (p) => `成功 ${p.pct}%`,
  judgeFail: (p) => `失敗 ${p.pct}%`,
};
