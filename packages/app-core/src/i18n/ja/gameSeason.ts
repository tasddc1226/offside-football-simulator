import type { Translation } from '../core';
import type { GameSeasonMsgs } from '../ko/gameSeason';

export const gameSeason: Translation<GameSeasonMsgs> = {
  preseason: 'プレシーズン',
  prepTitle: '次のフェーズの準備',
  condition: '体調',
  morale: '士気',
  fame: '人気',
  coachMemo: 'コーチのメモ',
  trainingTitle: 'トレーニング方針',
  trainHint: 'このフェーズのトレーニングを選ぶと次へ進みます',
  investTitle: '自己投資',
  funds: (p) => `所持 ${p.v}`,
  fundsAfter: (p) => `所持 ${p.v} → ${p.after}`,
  investHint: '投資を選ぶと次へ進みます · 節約するなら投資しない',
  phaseFirst: '前半戦',
  phaseSecond: '後半戦',
  totals: (p) =>
    `シーズン累計 · ${p.w}勝 ${p.d}分 ${p.l}敗 · 出場 ${p.apps} · ${p.goals}ゴール · ${p.col} ${p.colN} · 評価点 ${p.rating}`,
  colCs: '無失点',
  colAssists: 'アシスト',
  compsTitle: '今シーズンの大会',
  compSuper: '開幕前の一発勝負',
  compStart: '第1フェーズから',
  compAlive: '進行中',
  compLine: (p) => `${p.apps}試合 ${p.g}ゴール`,
  storiesTitle: '進行中のストーリー',
  storySoon: 'まもなく続く',
  storyWait: (p) => `約${p.n}フェーズ後`,
  feedTitle: '最近のニュース',
  feedLessAria: '最近のニュースを閉じる',
  feedMoreAria: '最近のニュースをもっと見る',
};
