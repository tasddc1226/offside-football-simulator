import type { Translation } from '../core';
import type { TeamCoreMsgs } from '../ko/teamCore';

export const teamCore: Translation<TeamCoreMsgs> = {
  record: (p) => `${p.w}勝 ${p.d}分 ${p.l}敗`,
  outWin: '勝',
  outDraw: '分',
  outLoss: '敗',
  titleWin: '勝利',
  titleDraw: '引き分け',
  titleLoss: '敗北',
  sortFit: 'ポジション適性',
  sortScore: 'レジェンドスコア',
  sortPeak: '最高OVR',
  attrEstimated: '推定能力値 · ',
  hintNoTeam: 'チームを保存すると試合ができます。',
  hintDirty: '変更した編成を保存すると試合ができます。',
  hintNoStarters: '引退選手を1人以上入れると試合ができます。',
  hintNoMatches: '今日の試合はすべて終わりました。日本時間の0時に再開します。',
  hintRest: 'シーズン間の休止期間です。次のシーズンが始まると試合ができます。',
  hintPast: '過去シーズンのチームは閲覧のみです。今のシーズンを選ぶと試合ができます。',
  achOneClubHint:
    '自分で育てた選手の引退後に判定します。プロ通算10シーズン以上、一般クラブは1つだけであることが条件です。尚武(サンム)と現役服務はクラブ数に含めません。',
  achLongServiceHint:
    '自分で育てた選手の引退後に判定します。1つの一般クラブで通算10シーズン以上が条件です。移籍後の復帰は合算し、尚武(サンム)と現役服務の期間は除きます。',
  achTeamFitHint: 'ユース選手なしで11人全員の適性が1.00であることが条件です',
  achLevel: (p) => `${p.level}段階 · ${p.cur}`,
  achNext: (p) => ` · NEXT ${p.next}`,
  achMaxLevel: ' · 最高段階',
  achDone: '達成済み',
  achUndone: '未達成',
  achMissing: (p) => `残り: ${p.names}`,
  achUndoneHint: (p) => `未達成 · ${p.hint}`,
  achPointsGot: (p) => `+${p.n}pt`,
  achPointsWorth: (p) => `${p.n}pt`,
  achRewardNext: (p) => `達成報酬 ${p.items}`,
  achRewardGot: (p) => `受け取った報酬 ${p.items}`,
  achRewardBoost: (p) => `ポテンシャル強化券${p.n}枚`,
  achRewardScout: (p) => `プレミアムスカウト券${p.n}枚`,
  achRankNone: '実績を1つ達成するとランキングに載ります',
  achRank: (p) => `${p.rank}位 · ${p.ranked}人中`,
  achCatPlayer: '選手実績',
  achCatTeam: 'チーム実績',
  achCatOwner: 'オーナー実績',
  achCatManager: '監督実績',
  achCatShortPlayer: '選手',
  achCatShortTeam: 'チーム',
  achCatShortOwner: 'オーナー',
  achCatShortManager: '監督',
  gradeRookie: 'ルーキー',
  gradeBronze: 'ブロンズ',
  gradeSilver: 'シルバー',
  gradeGold: 'ゴールド',
  gradePlatinum: 'プラチナ',
  gradeDiamond: 'ダイヤ',
  gradeLegend: 'レジェンド',
  cupTeamNote: (p: { season: string }) =>
    `${p.season}のチームでオフサイドカップに参加しています。カップが終わるまでこのチームのスタメンを変更できます。`,
  cupTeamLink: (p: { season: string }) => `カップに出る${p.season}のチームを編集`,
  preseasonTeamNote:
    'プレシーズンに育てた選手のうち、今持っている選手で組みます。このチームはフレンドとの親善試合にだけ出場し、プレシーズンのランキングと実績はそのまま残ります。',
  hintCupTeam:
    'このチームはオフサイドカップにだけ出場します。ランク戦は今のシーズンのチームで行います。',
  hintPreseason:
    'プレシーズンのチームはフレンドとの親善試合にだけ出場します。ランクマッチは今のシーズンのチームで行います。',
  salaryBar: (p) => `過去シーズン選手の年俸 ${p.n} / ${p.max}`,
  salaryFull: (p) =>
    `この選手の年俸（${p.salary}）が残り予算（${p.left}）を超えています。過去シーズンの選手を外すか、今シーズンの選手を入れてください。`,
  salaryChip: (p) => `年俸 ${p.n}`,
  salaryOver: '予算オーバー',
  // T-11-571 리그 체력
  staminaLabel: '体力',
  staminaAria: (p: { left: number; total: number; pct: number }) =>
    p.pct
      ? `体力 ${p.left}/${p.total} · 次のリーグ戦の実力 −${p.pct}%`
      : `体力 ${p.left}/${p.total} · 問題なし`,
  fatigueHint: 'リーグで3試合続けて先発すると疲れて実力が少し落ちます。1試合休めば回復します。',
  salaryLeft: (p) => `残り予算 ${p.n}`,
  salaryOpen: '年俸のご案内を見る',
  salaryOverSave: (p) =>
    `過去シーズン選手の年俸が予算を超えているため保存できません（${p.n}/${p.max}）。年俸の低い選手か今シーズンの選手に替えてください。`,
  salaryLabel: '年俸',
  salaryLater: (p) => `今シーズンはなし・来シーズンから${p.n}`,
};
