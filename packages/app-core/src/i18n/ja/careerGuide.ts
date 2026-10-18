import type { CareerGuideMsgs } from '../ko/careerGuide';
export const careerGuide: CareerGuideMsgs = {
  candidateNote:
    '候補カードの能力値は基本の配分です。開始時に詳細能力と体格を反映して再計算するため、開始後の能力値は変わる場合があります。',
  trainWeak: '弱点集中練習は下の自己投資で選べます。',
  guideTitle: '選手タイプ図鑑',
  guideNote:
    'タイプは作成時に選んだ得意能力の組み合わせで決まります。能力を上げてもタイプは変わりません。',
  focusLabel: 'おすすめの得意能力',
  combosLabel: 'このタイプになる得意能力の組み合わせ',
  synergyLabel: 'チームシナジー',
  synergyNote: 'チームシナジーはクラブチームでタイプと配置(括弧)の両方が合うと発動します。',
  synergyItem: (p: { name: string; slots: string }) => `${p.name}(${p.slots})`,
  nameRule: (p: { field: string; min: number; max: number }) =>
    `${p.field}は${p.min}〜${p.max}文字で入力してください。`,
  wallTitle: 'クラブの名誉の壁に名前を刻みました。',
  occupied: (p: { number: number; holder: string }) =>
    `${p.number}番は${p.holder}の永久欠番として残ります。`,
  wallRule: '永久欠番はクラブ・背番号ごとの競争記録として別に残ります。',
};
