import type { Translation } from '../core';
import type { Best11Msgs } from '../ko/best11';

export const best11: Translation<Best11Msgs> = {
  tab: 'BEST 11',
  title: (p) => `${p.season} BEST 11`,
  seasonAria: 'BEST 11のシーズン',
  lead: 'シーズンごとに、ポジション別にいちばん輝いた引退選手11人をピッチに並べます。',
  provisional: '暫定',
  final: '確定',
  provisionalUntil: (p) =>
    `シーズン中は引退選手が出るたびに枠の持ち主が入れ替わります。${p.when}（韓国時間）に確定します。`,
  provisionalOpen:
    'シーズン中は引退選手が出るたびに枠の持ち主が入れ替わります。シーズン終了時に確定します。',
  finalAt: (p) => `${p.day}に確定したメンバーです。`,
  updated: (p) => `${p.when} 更新`,
  loadFailed: 'BEST 11を読み込めませんでした。しばらくしてからもう一度お試しください。',
  empty: 'まだBEST 11の条件を満たした引退選手はいません。',
  emptySlot: '空き',
  slotAria: (p) => `${p.slot} · ${p.name} · BEST 11指数 ${p.index}`,
  emptySlotAria: (p) => `${p.slot} · 空き`,
  pitchAria: 'BEST 11のピッチ',
  pickHint: '枠をタップすると選出理由とその枠の順位が表示されます。',
  index: 'BEST 11指数',
  pillarInd: '個人の活躍',
  pillarTeam: 'チーム成績',
  pillarAward: '個人タイトル',
  reasonTitle: '選出理由',
  reasonPrime: (p) => `全盛期5シーズンの評価点 ${p.rating} · プロ${p.apps}試合`,
  leagues: (p) => `リーグ優勝${p.n}回`,
  ucl: (p) => `CL${p.n}回`,
  wc: (p) => `ワールドカップ${p.n}回`,
  noTeam: 'チームタイトルなし',
  ballon: (p) => `バロンドール${p.n}回`,
  fifpro: (p) => `FIFPRO世界ベストイレブン${p.n}回`,
  posAwards: (p) => `ポジション賞${p.n}回`,
  noAward: '個人タイトルなし',
  since: (p) => `${p.when}からこの枠`,
  openPlayer: '選手の記録を見る',
  rankTitle: (p) => `${p.slot}の順位`,
  rankLead: '指数の上位10人です。1人のオーナーが持てる枠はひとつだけです。',
  cutline: (p) => `現在のボーダー ${p.index}`,
  heldXi: (p) => `BEST 11 ${p.slot}`,
  heldOwner: '同じオーナー',
  heldOwnerNote: '同じオーナーの別の選手がBEST 11に入っているため外れました。',
  rankEmpty: 'この枠の候補はまだいません。',
  changesTitle: '最近の入れ替わり',
  changeIn: (p) => `${p.slot} ${p.out} → ${p.name}`,
  changeFirst: (p) => `${p.slot} 最初の持ち主 ${p.name}`,
  changeOut: (p) => `${p.slot} ${p.out} 外れる`,
  hiddenName: '非公開の選手',
  criteriaTitle: '選出基準',
  criteria1:
    'そのシーズンに引退した名前公開の選手のうち、プロ300試合と20試合以上出場したシーズン5つを満たした選手が候補です。',
  criteria2:
    'BEST 11指数は個人の活躍50 · チーム成績30 · 個人タイトル20です。柱ごとにその枠の1位を100とします。',
  criteria3:
    '個人の活躍は全盛期5シーズンの評価点とポジションの記録で、所属リーグのレベルを反映します。',
  criteria4: '個人タイトルはシーズンごとに大きい賞を3つまで数え、自分のポジションの賞は2倍です。',
  criteria5:
    '1人のオーナーが持てる枠はひとつだけです。指数が同じなら個人の活躍、個人タイトル、先に引退した順です。',
  reward: (p: { n: number; s: number; b: number }) =>
    `シーズンが確定すると、各枠のオーナーは選手候補リロール券${p.n}枚、プレミアムスカウト券${p.s}枚、ポテンシャル強化券${p.b}枚を受け取ります。`,
};
