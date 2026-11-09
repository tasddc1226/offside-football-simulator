import type { Translation } from '../core';
import type { RetireExpMsgs } from '../ko/retireExp';

export const retireExp: Translation<RetireExpMsgs> = {
  eyebrow: 'Key Scenes',
  title: 'このキャリアの場面',
  note: '保存されたシーズン記録から選びました。',
  firstApps: '初出場の記録',
  peakRating: '最高評価のシーズン',
  lastApps: '最後に出場したシーズン',
  when: (p) => `${p.year} · ${p.age}歳 · ${p.club}`,
  stats: (p) => `${p.apps}試合 ${p.goals}ゴール ${p.assists}アシスト`,
  statsBack: (p) => `${p.apps}試合 ${p.goals}ゴール 無失点 ${p.cs}`,
  rating: (p) => `評価 ${p.rating}`,
  league: (p) => `${p.league} · OVR ${p.ovr}`,
  leagueRank: (p) => `${p.league} ${p.rank}位 · OVR ${p.ovr}`,
  honors: (p) => `このシーズンの優勝 · 受賞: ${p.list}`,
  open: '詳しく',
  close: '閉じる',
  nextEyebrow: 'My Club',
  nextTitle: 'マイクラブで',
  nextTeam: '記録がサーバーに反映されました。マイチームの編成でこの選手を選べます。',
  nextLogin:
    '記録がサーバーに反映されました。ログインするとこの選手でチームを作り、ほかのオーナーと対戦できます。',
  nextClub: 'サーバーに反映された引退選手はマイクラブの保有選手に入ります。',
  nextWait: '記録をサーバーに送っています。反映されるとマイクラブの保有選手に入ります。',
  nextBlocked: '記録がサーバーに反映されなかったため、マイクラブでは使えません。',
  ctaTeam: 'マイチームの編成を開く',
  ctaLogin: 'ログインしてチームを作る',
  ctaClub: 'マイクラブを見る',
};
