import type { Translation } from '@offside/contracts/i18n';
import type { GTrainingMsgs } from '../ko/gTraining';

export const gTraining: Translation<GTrainingMsgs> = {
  attrTraining: (p) => `${p.attr}トレーニング`,
  rest: '休養・回復',
  coach: '個人コーチ',
  media: 'メディア活動',
  condition: (p) => `コンディション ${p.v}`,
  morale: (p) => `士気 ${p.v}`,
  allAttrsUp: '全能力 少し▲',
  cost: (p) => `費用 ${p.money}`,
  fameRange: (p) => `人気 +${p.lo}〜${p.hi}`,
  income: (p) => `収入 +${p.money}`,
  attrUp: (p) => `${p.attr} ▲`,
  attrPairUp: (p) => `${p.a}・${p.b} ▲`,
  focusGrowth: (p) => `主力の成長 +${p.pct}%`,
  tooFarAhead: (p) => `突出しすぎ 成長 −${p.pct}%`,
  maxed: (p) => `${p.attr} 最大値に到達`,
  nearMax: (p) => `最大値に到達 成長 −${p.pct}%`,
  helpRest: (p) =>
    `トレーニングを休んで体を整えます。コンディションが${p.low}を下回るとケガのリスクが大きく上がり、${p.start}を下回るとスタメン出場が難しくなります。`,
  helpCoach:
    'OVRに反映される能力値をまんべんなく少しずつ伸ばします。資金が足りないと、コンディションを回復する自主トレーニングに切り替わります。',
  helpMedia: (p) =>
    `インタビューや広告で名前を売ります。人気が高いほど代表選出・移籍オファー・広告のオファーで有利になります。${p.contract ? '契約中なので出演料も入ります。' : ''}`,
  helpAttrMain: (p) =>
    `${p.attr}の能力値が大きく上がり、50%の確率で他の能力値もひとつ少し上がります。`,
  helpPhy: (p) => `${p.pac}も一緒に上がる代わりに、コンディションがより下がります。`,
  helpFocus: (p) => `主力の能力値なので成長が${p.pct}%速くなります。`,
  helpOffFocus: (p) => `主力の能力値ではないので成長が${p.pct}%遅くなります。`,
  helpLopsided: (p) =>
    `他の主要能力値より突出しすぎているため、成長が${p.pct}%落ちています。他の能力値を伸ばすと制限が解除されます。`,
  helpMaxed: (p) =>
    `${p.attr}の詳細能力値がすべて最大値(99)のため、このトレーニングではこれ以上上がりません。`,
  helpNearMax: (p) => `最大値(99)に達した詳細能力値があるため、成長の${p.pct}%が反映されません。`,
  helpOvrSubs: (p) => `この項目のうち${p.list}が今のポジションのOVRに反映されます。`,
  helpOvrSeparate: 'OVRへの反映と試合での活躍は別物です。',
  helpWeightLow: '今のポジションのOVRにはほとんど反映されません。',
  helpWeight: (p) => `今のポジションのOVRに占める${p.attr}の比重は${p.pct}%です。`,
  coachBroke: '資金が足りず、個人コーチの代わりに自主トレーニングをしました。',
  investBroke: (p) => `資金が足りず、「${p.label}」への投資を中止しました。`,
  investNone: '投資しない',
  investWeak: '弱点強化の特訓',
  investBest: '長所特化の特訓',
  investAttr: (p) => `${p.attr}の特訓`,
  investWeakNote: '弱点',
  investBestNote: '長所',
  investMedical: 'メディカルケア',
  investMental: 'メンタルコーチング',
  investSaveMoney: '資金を節約する',
  investMedicalInjury: (p) => `ケガの欠場 −${p.games}試合`,
  investShort: '資金不足',
  helpInvestNone: 'この期間は資金を使いません。',
  helpInvestMedical: (p) =>
    `専属のメディカルチームが体を管理します。コンディションが上がり、ケガをしていれば復帰が${p.games}試合早まります。`,
  helpInvestMental:
    'スポーツ心理の専門家に相談します。士気が高いほど試合でのパフォーマンスと成長が良くなります。',
  helpInvestWeak: (p) => `最も低い主要能力値（${p.attr}）を集中して引き上げます。`,
  helpInvestBest: (p) => `最も高い主要能力値（${p.attr}）をさらに磨きます。`,
  helpInvestGain: (p) => `トレーニングとは別に、能力値トレーニング1回分の${p.pct}%ほど上がります。`,
  helpInvestLopsided: (p) => `他の能力値より突出しすぎているため、成長が${p.pct}%落ちています。`,
  helpInvestSkip: '資金が足りないと投資をスキップし、「投資しない」に切り替わります。',
};
