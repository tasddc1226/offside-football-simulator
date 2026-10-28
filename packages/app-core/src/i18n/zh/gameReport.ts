import type { Translation } from '../core';
import type { GameReportMsgs } from '../ko/gameReport';

export const gameReport: Translation<GameReportMsgs> = {
  tallyApps: '出賽',
  tallyGoals: '進球',
  tallyCs: '零失球',
  tallyAssists: '助攻',
  tallyRating: '評分',
  teamRank: (p) => `球隊第${p.n}名`,
  dotsLabel: (p) => `比賽結果 ${p.w}勝 ${p.d}和 ${p.l}負`,
  win: '勝',
  draw: '和',
  loss: '負',
  expectedRole: '預期角色：',
  cups: '盃賽・洲際賽事',
  notCalled: '這次未入選國家隊名單。',
  changes: '變化',
  noChange: '沒有明顯變化',
  gamesSummary: (p) => `各場紀錄 ${p.n}場`,
};
