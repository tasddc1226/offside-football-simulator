import type { Translation } from '../core';
import type { SheetCoreMsgs } from '../ko/sheetCore';

export const sheetCore: Translation<SheetCoreMsgs> = {
  skip: '略過',
  tallyApps: '出賽',
  tallyGoals: '進球',
  tallyCleanSheets: '零失球',
  tallyAssists: '助攻',
  tallyRating: '評分',
  wdl: (p) => `${p.w}勝 ${p.d}和 ${p.l}負`,
  tickerMins: (p) => `${p.n} 分鐘`,
  tickerGoals: (p) => `${p.n} 球`,
  tickerAssists: (p) => `${p.n} 助攻`,
  tickerInjured: '傷停缺陣',
  tickerNone: '未出賽',
  judging: '判定中',
  judgeOk: (p) => `成功 ${p.pct}%`,
  judgeFail: (p) => `失敗 ${p.pct}%`,
};
