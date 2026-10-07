import type { Translation } from '../core';
import type { GameLeagueMsgs } from '../ko/gameLeague';

export const gameLeague: Translation<GameLeagueMsgs> = {
  title: (p) => `${p.league} 順位`,
  fold: '閉じる',
  expand: '全順位',
  foldAria: '順位表を閉じる',
  expandAria: '全順位を見る',
  colTeam: 'チーム',
  colPlayed: '試合',
  colPts: '勝点',
  rowLabel: (p) =>
    `${p.rank}位 ${p.name} ${p.played}試合 ${p.w}勝 ${p.d}分 ${p.l}敗 勝点${p.pts}${p.me ? '、自チーム' : ''}`,
  empty: (p) => `開幕すると${p.n}チームの順位表が埋まります。`,
};
