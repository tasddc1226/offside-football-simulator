// 순위표 문구(웹 tabs/LeagueTable.svelte · 앱 screens/game/LeagueTable.tsx). 리그·구단 이름은 게임이 만든 문구라 옮기지 않는다.
import { ns } from '../core';

const ko = {
  title: (p: { league: string }) => `${p.league} 순위`,
  fold: '접기',
  expand: '전체 순위',
  foldAria: '순위표 접기',
  expandAria: '전체 순위 보기',
  colTeam: '팀',
  colPlayed: '경기',
  colPts: '승점',
  rowLabel: (p: {
    rank: number;
    name: string;
    played: number;
    w: number;
    d: number;
    l: number;
    pts: number;
    me: boolean;
  }) =>
    `${p.rank}위 ${p.name} ${p.played}경기 ${p.w}승 ${p.d}무 ${p.l}패 승점 ${p.pts}${p.me ? ', 내 팀' : ''}`,
  empty: (p: { n: number }) => `개막하면 ${p.n}개 팀 순위표가 채워져요.`,
};

export type GameLeagueMsgs = typeof ko;
export const gameLeagueText = ns('gameLeague', ko);
