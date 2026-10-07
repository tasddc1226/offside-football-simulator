import type { Translation } from '../core';
import type { GameReportMsgs } from '../ko/gameReport';

export const gameReport: Translation<GameReportMsgs> = {
  tallyApps: '出場',
  tallyGoals: 'ゴール',
  tallyCs: '無失点',
  tallyAssists: 'アシスト',
  tallyRating: '評価点',
  teamRank: (p) => `チーム${p.n}位`,
  dotsLabel: (p) => `試合結果 ${p.w}勝 ${p.d}分 ${p.l}敗`,
  win: '勝',
  draw: '分',
  loss: '敗',
  expectedRole: '予想される役割：',
  cups: 'カップ戦・大陸大会',
  notCalled: '今回の代表メンバーから外れました。',
  changes: '変化',
  noChange: '大きな変化なし',
  gamesSummary: (p) => `試合別記録 ${p.n}試合`,
};
