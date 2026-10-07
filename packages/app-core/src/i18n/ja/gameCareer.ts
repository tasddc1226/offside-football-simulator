import type { Translation } from '../core';
import type { GameCareerMsgs } from '../ko/gameCareer';

export const gameCareer: Translation<GameCareerMsgs> = {
  totalsTitle: '通算記録',
  apps: '試合',
  goals: 'ゴール',
  assists: 'アシスト',
  cleanSheets: '無失点',
  awards: '受賞',
  peakValue: '最高市場価値',
  goalsTitle: '次の目標',
  goalsNote:
    '出場・ゴール・アシストは終えたシーズンが基準です。代表出場と優勝もキャリアに残ります。',
  goalLine: (p) => `${p.have} / ${p.target} · 残り${p.remaining}`,
  clubApps: (p) => `${p.club}で${p.target}試合出場`,
  retiredNumber: (p) =>
    `ひとつのクラブで長く活躍して引退すると、そのクラブの${p.n}番が永久欠番になることがあります。`,
  colSeason: 'シーズン',
  colClub: '所属',
  colRating: '評価点',
  colRank: '順位',
  seasonValue: (p) => `市場価値 ${p.value}`,
  emptyRecords: '最初のシーズンを終えると記録がたまります。',
  recordsNote:
    '試合・ゴール・アシストはリーグ・カップ戦・大陸大会を合わせた公式戦の記録です。市場価値はシーズン終了時のリーグ・OVR・年齢から見積もった移籍金ベースの推定値です。',
  journeyTitle: 'キャリアの歩み',
  emptyJourney: 'プロデビューから歩みが記録されます。',
  coachNoStart: '今シーズン開始時の能力値の記録がありません。',
  coachOvr: (p) => `今シーズンのOVR ${p.from} → ${p.to}。`,
  coachNoChange: 'まだ表示できる能力値の変化はありません。',
  coachServing: '兵役中です。服務を終えたら、クラブでのトレーニングと出場の準備を再開します。',
  coachInjured: (p) => `ケガであと${p.n}試合欠場します。まず回復状態を確認しましょう。`,
  coachLowCond:
    'コンディションが低く、ケガのリスクが高まっています。休息・回復は出場の準備に役立ちます。',
  coachLowMorale:
    '士気が低いと、同じ能力値のトレーニングでも成長が減ります。休息・回復で士気を取り戻せます。',
  coachLopsided: (p) =>
    `${p.attr}がほかの主要能力値より先行しているため、この能力値のトレーニング効果が減ります。ほかの主要能力値を伸ばしましょう。`,
  coachRounded: 'OVRは四捨五入した総合値です。OVRが同じでも、細かい能力値は異なることがあります。',
  coachDisclaimer: 'このメモだけで、成長が止まった原因や限界を断定することはできません。',
  marketAssess: (p) =>
    `現在のOVR ${p.ovr} · ${p.rating === null ? '' : `昨シーズンの評価点 ${p.rating} · `}人気 ${p.fame} · ${p.age}歳。クラブは実力・昨シーズンの評価点・人気・年齢をあわせて見ます。リーグの条件やスカウト・エージェントのイベントもオファーに影響します。活躍しても特定のクラブからのオファーが保証されるわけではありません。`,
  offerAssess: (p) =>
    `現在のOVR ${p.ovr} · チーム戦力 ${p.str}。提示された出場条件は${p.role || '特に案内なし'}です。実際の出場はコンディション・ケガ・監督の信頼などによって変わります。`,
};
