import type { Translation } from '../core';
import type { RatingReportMsgs } from '../ko/ratingReport';

export const ratingReport: Translation<RatingReportMsgs> = {
  partsTitle: '評価点の内訳 · 1試合平均',
  partBase: '基本',
  partGoals: 'ゴール',
  partAssists: 'アシスト',
  partOvrEdge: 'OVR優位',
  partCond: 'コンディション',
  partMorale: '士気',
  partForm: 'その日の出来',
  partCs: '無失点',
  partDef: '守備貢献',
  partResult: 'チーム結果',
  partLuck: 'その他のブレ',
  partsAria: (p) => `評価点の内訳: ${p.list}`,
  dirTitle: '成長の方向',
  dirGoal: (p) =>
    `ゴールには${p.attr}の比重が${p.pct}%でいちばん大きいです。今はリーグ平均より${p.n}${p.up ? '高いです' : '低いです'}。`,
  dirAssist: (p) =>
    `アシストには${p.attr}の比重が${p.pct}%でいちばん大きいです。今はリーグ平均より${p.n}${p.up ? '高いです' : '低いです'}。`,
  dirKnee:
    '攻撃能力がリーグ平均を十分上回っています。これ以上上げても、ゴールやアシストは少しずつしか増えません。',
  dirDef: (p) =>
    `守備能力がリーグ平均を上回るほど評価点に加わります。今は${p.n}${p.up ? '高いです' : '低いです'}。`,
};
