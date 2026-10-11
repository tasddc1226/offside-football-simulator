import type { Translation } from '../core';
import type { GameCareerMsgs } from '../ko/gameCareer';

export const gameCareer: Translation<GameCareerMsgs> = {
  rnTitle: '永久欠番への挑戦',
  rnIntro: '長く活躍したクラブに、この背番号を残せるでしょうか。',
  rnLoading: '保存されたシーズン記録を確認しています。',
  rnRetry: '再確認',
  rnError: '記録を読み込めませんでした。接続と記録の同期状況を確認してください。',
  rnEmpty:
    'プロクラブでシーズンを終えると、クラブ別の挑戦状況が表示されます。高校・大学・兵役のシーズンは対象外です。',
  rnBasis: 'サーバーに保存されたシーズン記録が基準です。進行中のシーズンは含みません。',
  rnSyncing: 'この端末の記録がまだすべて反映されていません。同期後に再確認してください。',
  rnScope: (p) => `${p.season === 0 ? 'プレシーズン' : `シーズン${p.season}`} · 背番号${p.number}`,
  rnAvailable: '現在は空き番号',
  rnTaken: '永久欠番登録済み',
  rnUnknown: '空き状況を確認中',
  rnSeasons: (p) => `在籍 ${p.have} / ${p.need}シーズン`,
  rnProgress: (p) => `クラブ貢献度 ${p.pct === 0 ? '10%未満' : `${p.pct}%`}`,
  rnRemain: (p) => `このクラブであと${p.count}シーズンの在籍が必要です。`,
  rnBuild: '継続的な出場、ポジションに合った活躍、クラブの優勝や個人賞で貢献度を積み上げます。',
  rnReady: '現在の記録は基準を満たしています。引退時に最終審査されます。',
  rnOutside: '基準は満たしていますが、貢献度が高いクラブが先に審査されます。',
  rnTakenHint: 'このクラブの番号は先に登録されています。他の候補クラブを確認できます。',
  rnRules:
    '同じサービスシーズンのクラブ別背番号を全ユーザーで共有します。条件を満たす上位2クラブのうち、1クラブで獲得できます。',
  rnNote:
    '貢献度は10%刻みの目安で、移籍により変わる場合があります。番号の予約はできません。選手名を公開した状態での引退審査で確定します。',
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
