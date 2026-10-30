import type { Translation } from '../core';
import type { GameLeagueMsgs } from '../ko/gameLeague';

export const gameLeague: Translation<GameLeagueMsgs> = {
  title: (p) => `${p.league} 排名`,
  fold: '收起',
  expand: '完整排名',
  foldAria: '收起排名表',
  expandAria: '查看完整排名',
  colTeam: '球隊',
  colPlayed: '場次',
  colPts: '積分',
  rowLabel: (p) =>
    `第${p.rank}名 ${p.name} ${p.played}場 ${p.w}勝 ${p.d}和 ${p.l}負 積分${p.pts}${p.me ? '，我的球隊' : ''}`,
  empty: (p) => `開季後就會填入${p.n}支球隊的排名表。`,
};
