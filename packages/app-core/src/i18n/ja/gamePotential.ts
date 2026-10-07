import type { Translation } from '../core';
import type { GamePotentialMsgs } from '../ko/gamePotential';

export const gamePotential: Translation<GamePotentialMsgs> = {
  peekLocked: '最初のシーズンを終えるとスカウト評価を見られます。',
  peekAvailable:
    '本当のポテンシャルは引退時に公開されます。評価を見るだけではポテンシャルは変わりません。',
  peekShown: (p) => `${p.grade}ランク · ${p.year}シーズンのスカウト評価`,
  peekBtnFree: '今シーズンの評価を見る',
  peekBtnAd: '広告を見て今シーズンの評価を見る',
  peekBtnPay: (p) => `${p.cost}を払って今シーズンの評価を見る`,
  peekShort: (p) => `資金が足りません。今シーズンの評価を見るには${p.cost}が必要です。`,
  flowTitle: 'ポテンシャルが変わった過程',
  flowStart: (p) => `最初の本当のポテンシャル ${p.grade} (${p.value})`,
  flowDrift: (p) => `25歳までの成長期の変動 ${p.d}`,
  flowBoost: (p) => `ポテンシャル強化 +${p.n}`,
  flowEnd: (p) => `引退時の本当のポテンシャル ${p.grade} (${p.value})`,
  seedLine: (p) => `キャリアシード ${p.seed} · バランスバージョン ${p.v}`,
  balLine: (p) => `バランスバージョン ${p.v}`,
  seedNote:
    'このキャリアの試合とイベントの判定は、このシードから続いています。シードとバランス、選択が同じなら結果も同じです。',
};
