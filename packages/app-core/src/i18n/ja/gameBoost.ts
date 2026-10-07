import type { Translation } from '../core';
import type { GameBoostMsgs } from '../ko/gameBoost';

export const gameBoost: Translation<GameBoostMsgs> = {
  title: 'ポテンシャル強化',
  stepsLabel: (p) => `${p.max}段階中 ${p.lv}段階`,
  rolling: '強化中…',
  chance: (p) => `成功確率 ${p.n}%`,
  confirmBtn: '強化する',
  cancel: 'キャンセル',
  close: 'OK',
  adLoading: '広告を読み込み中…',
  note: (p) =>
    `シーズンごとに1回、${p.age}歳まで挑戦できます。失敗すると資金だけを失い、次の確率が${p.pct}%p上がります。`,
  lineLocked: '最初のシーズンを終えると強化できます。',
  lineAged: (p) => `${p.age}歳を過ぎたため、もう強化できません。`,
  lineMax: (p) => `最高段階（+${p.lv}）に到達しました。`,
  lineDone: '今シーズンはすでに挑戦しました。次のシーズンにまた挑戦できます。',
  lineShort: (p) => `資金が足りません。次の段階には${p.cost}が必要です。`,
  lineReady: (p) => `次の段階 +${p.next} · 成功確率 ${p.chance}% · ${p.cost}`,
  button: (p) => `${p.cost}を払って強化する（${p.chance}%）`,
  confirm: (p) => `${p.cost}を使い、${p.chance}%の確率で挑戦します。失敗しても返金されません。`,
  historyOk: (p) => `${p.y} · +${p.lv}段階 ${p.pct}% · ${p.cost} · 成功`,
  historyFail: (p) => `${p.y} · +${p.lv}段階 ${p.pct}% · ${p.cost} · 失敗`,
  resultOkTitle: (p) => `+${p.lv}段階 成功`,
  resultFailTitle: '強化失敗',
  resultOkMax: '最高段階に到達しました。成長の上限がさらに少し上がりました。',
  resultOk: '成長の上限が少し上がりました。',
  resultFail: (p) =>
    `成功確率は${p.chance}%でした。資金は戻らず、次の挑戦の確率が${p.pct}%p上がります。`,
  adButton: (p) => `広告を見て強化する（${p.chance}%）`,
  adButtonFree: (p) => `資金なしで強化する（${p.chance}%）`,
  adNote:
    '広告を最後まで見ると、資金なしで1回挑戦できます。成功確率は資金で挑戦するときと同じです。',
  adNoteFree: '広告削除を購入済みなので、資金なしで1回挑戦できます。',
  adWatch: '広告を最後まで見ると強化に挑戦できます。',
  adCost: '広告',
  resultFailAd: (p) => `成功確率は${p.chance}%でした。次の挑戦の確率が${p.pct}%p上がります。`,
};
