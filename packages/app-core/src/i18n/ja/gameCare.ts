import type { Translation } from '../core';
import type { GameCareMsgs } from '../ko/gameCare';

export const gameCare: Translation<GameCareMsgs> = {
  title: 'コンディション管理',
  tier1: '基本ケア',
  tier2: '集中ケア',
  tier3: '専属メディカル',
  lineOpen:
    '今シーズンが終わると能力が下がります。コンディション管理を受けると下がり幅が小さくなります。',
  lineDone: (p) =>
    `今シーズンは${p.name}を受けています。シーズン終了時の低下が${p.cut}%小さくなります。`,
  option: (p) => `低下を${p.cut}%抑える`,
  short: '資金不足',
  confirm: (p) =>
    `${p.name}に${p.cost}を使います。今シーズン終了時の低下にだけ効果があり、取り消せません。`,
  confirmBtn: '受ける',
  cancel: 'キャンセル',
  note: 'シーズンごとに1回受けられます。ピークの年齢から離れるほど費用が上がります。',
  done: (p) => `${p.name}を始めました。`,
};
