import type { Translation } from '../core';
import type { PlayerEditMsgs } from '../ko/playerEdit';

export const playerEdit: Translation<PlayerEditMsgs> = {
  title: '選手情報を直す',
  entry: '直す',
  entryLabel: (p) => `${p.name}の選手情報を直す`,
  hint: '最初のシーズン決算までは、名前・利き足・体格を無料で直せます。',
  lead: '最初のシーズン決算までは無料で、何回でも直せます。決算が終わると、名前は変更券でのみ変えられます。',
  name: '名前',
  nameRule: (p) => `${p.max}文字まで使えます。リンク・不適切な言葉・< > 記号は使えません。`,
  nameEmpty: '名前を入れてください。',
  nameInvalid: '使えない名前です。別の名前を入れてください。',
  body: '体格',
  height: '身長',
  weight: '体重',
  heightRange: (p) => `身長は${p.min}〜${p.max}cmの間で入れてください。`,
  weightRange: (p) => `体重は${p.min}〜${p.max}kgの間で入れてください。`,
  tooLight: '身長に対して体重が軽すぎます。',
  tooHeavy: '身長に対して体重が重すぎます。',
  bodyNote: 'OVRは変わりません。詳細能力値の配分だけが動きます。',
  ovrMove: (p) =>
    `OVR ${p.from} → ${p.to}。2つの役割のうち高いほうでOVRを測る選手なので、体格で変わります。`,
  bodyPlayed: 'これまでに伸びた能力値はそのままで、体格の補正だけを動かします。',
  bodyNone: '体格を入れる前に作った選手なので、体格は直せません。',
  preview: '変わる詳細能力値',
  previewNone: '変わる詳細能力値はありません。',
  foot: '利き足',
  footNote:
    '利き足は選手の試合結果に影響しません。クラブの試合で選手カードをサイドバック・ウインガーの枠に置くときだけ使われます。',
  save: '保存',
  close: '閉じる',
  same: '変わった内容がありません。',
  done: '選手情報を直しました。',
  closed: '最初のシーズン決算が終わったので、もう直せません。',
};
