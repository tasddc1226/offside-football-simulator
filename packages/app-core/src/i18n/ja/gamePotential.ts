import type { Translation } from '../core';
import type { GamePotentialMsgs } from '../ko/gamePotential';

export const gamePotential: Translation<GamePotentialMsgs> = {
  peekLocked: '最初のシーズンを終えるとスカウト評価を見られます。',
  peekAvailable: '本当のポテンシャルは引退時に公開されます。',
  peekShown: (p) => `${p.grade}ランク · ${p.year}シーズンのスカウト評価`,
  peekBtnFree: '今シーズンの評価を見る',
  peekBtnAd: '広告を見て今シーズンの評価を見る',
  peekBtnPay: (p) => `${p.cost}を払って今シーズンの評価を見る`,
  peekShort: (p) => `資金が足りません。今シーズンの評価を見るには${p.cost}が必要です。`,
};
