import type { Translation } from '../core';
import type { OwnerMsgs } from '../ko/owner';

export const owner: Translation<OwnerMsgs> = {
  title: 'オーナー',
  summaryLabel: 'オーナーの概要',
  avatarInitial: 'オ',
  guestName: 'ゲストオーナー',
  guestSub: '記録はこの端末にだけ保存されます',
  signedInSubWeb: 'Googleアカウントでログインしています',
  signedInSubApp: 'ログインしています',
  emptySummary:
    '最初のキャリアを最後までプレーすると、引退選手とレジェンドスコアがここに貯まります。',
  statClubValue: 'クラブ価値',
  statRetired: '引退選手',
  statLegend: 'レジェンドスコア',
  statRetiredNumbers: '永久欠番',
  playersCount: (p) => `${p.text}人`,
  numbersCount: (p) => `${p.n}個`,
  fundsLine: (p) => `クラブ資金 ${p.funds}`,
  myTeam: 'マイチーム',
  manager: (p) => `${p.manager}監督 · ${p.formation}`,
  teamOvr: (p) => `チームOVR ${p.ovr}`,
  statRecord: '戦績',
  statRating: 'レーティング',
  statToday: '今日の試合',
  play: '試合をする',
  teamFailed:
    'シーズンごとに引退した選手でチームを組んで競い、ライブランキングとクラブの実績を埋めましょう。',
  loading: '読み込み中…',
  buildTeam: 'チームを作る',
  teamBtnApp: 'マイチーム · シーズン実績',
  marketTitle: '移籍市場',
  marketSub: (p) => `クラブ資金 ${p.funds} · 今シーズンの選手を売り買いできます`,
  open: '開く',
  lockBadge: '\u{1F512}︎ ログインすると開きます',
  accountSection: 'アカウント',
  adminTools: '運営ツール',
  teamEmptyWith: (p) =>
    `${p.season}に引退した自分の選手${p.n}人でチームを組めます。空いた枠はユースの選手が埋めます。`,
  teamEmptyNone: (p) => `${p.season}にプレーして引退した選手が出たら、チームを組めます。`,
  locked: (p) =>
    `ログインすると${p.players > 0 ? `引退した選手${p.players}人で` : '引退した選手で'}チームを組み、ほかのオーナーと競えます。毎日の試合・ライブランキング・シーズン実績が開きます。`,
};
