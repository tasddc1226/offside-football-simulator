import type { Translation } from '../core';
import type { GamePrimeMsgs } from '../ko/gamePrime';

export const gamePrime: Translation<GamePrimeMsgs> = {
  title: '全盛期延長',
  rolling: '延長に挑戦中…',
  stepsLabel: (p) => `延長${p.max}段階中${p.lv}段階`,
  lineReady: (p) =>
    `今は${p.peak}歳のシーズンが終わると能力値が下がり始めます。成功すれば${p.next}歳まで持ちこたえます（成功${p.chance}%・${p.cost}）。`,
  lineShort: (p) =>
    `${p.peak}歳のシーズンが終わると能力値が下がり始めます。次の挑戦には${p.cost}が必要です。`,
  lineDone: (p) =>
    `今シーズンの挑戦は終わりました。能力値は${p.peak}歳のシーズン終了後から下がります。`,
  lineMax: (p) =>
    `全盛期を最大まで延ばしました。能力値は${p.peak}歳のシーズン終了後から下がります。`,
  button: '延長に挑戦',
  confirm: (p) => `${p.cost}を使い、成功確率は${p.chance}%です。失敗しても戻りません。`,
  confirmBtn: '挑戦する',
  cancel: 'キャンセル',
  adCost: '広告',
  adNote: (p) => `資金が足りなければ広告を見て挑戦できます（キャリアで残り${p.left}回）。`,
  adNoteFree: (p) => `広告削除で資金なしに挑戦できます（キャリアで残り${p.left}回）。`,
  adWatch: '広告を最後まで見ると挑戦できます。',
  note: (p) =>
    `ピーク年齢の1年前のシーズンから、シーズンごとに1回、最大${p.max}段階まで挑戦できます。失敗するたびに次の確率が${p.pct}%p上がります。`,
  noteGreat: (p) => `成功のうち${p.pct}%は2年まとめて延びる大成功です。`,
  historyOk: (p) => `${p.y}年 +${p.lv}段階 成功（${p.pct}%・${p.cost}）`,
  historyGreat: (p) => `${p.y}年 +${p.lv}段階 大成功（${p.pct}%・${p.cost}）`,
  historyFail: (p) => `${p.y}年 +${p.lv}段階 失敗（${p.pct}%・${p.cost}）`,
  resultOkTitle: '全盛期延長に成功',
  resultGreatTitle: '大成功！2年延長',
  resultFailTitle: '延長に失敗',
  resultOk: (p) => `${p.peak}歳のシーズンが終わってから能力値が下がり始めます。`,
  resultFail: (p) => `次の挑戦の確率が${p.pct}%p上がります。`,
};
