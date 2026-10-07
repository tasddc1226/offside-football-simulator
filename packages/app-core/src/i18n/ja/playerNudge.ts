import type { Translation } from '../core';
import type { PlayerNudgeMsgs } from '../ko/playerNudge';

export const playerNudge: Translation<PlayerNudgeMsgs> = {
  readyTitle: 'ポテンシャル強化に挑戦できます',
  scoutTitle: '今シーズンのスカウト評価が出ました',
  readyText: (p) => `${p.cost} · 成功確率${p.chance}%。失敗すると資金は戻りません。`,
  scoutText: '選手タブで今シーズンの評価を見られます。本当のポテンシャルは引退時に公開されます。',
  aria: '選手タブの案内',
  open: '選手タブを見る',
  closeAria: '選手タブの案内を閉じる',
  close: '閉じる',
  tabHint: 'ポテンシャルの案内',
};
