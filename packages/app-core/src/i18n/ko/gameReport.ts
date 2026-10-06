// 구간 리포트 문구(웹 tabs/PhaseReport.svelte · 앱 screens/game/PhaseReport.tsx).
import { ns } from '../core';

const ko = {
  tallyApps: '출전',
  tallyGoals: '골',
  tallyCs: '무실점',
  tallyAssists: '도움',
  tallyRating: '평점',
  teamRank: (p: { n: number }) => `팀 ${p.n}위`,
  dotsLabel: (p: { w: number; d: number; l: number }) => `경기 결과 ${p.w}승 ${p.d}무 ${p.l}패`,
  win: '승',
  draw: '무',
  loss: '패',
  expectedRole: '예상 역할:',
  cups: '컵 · 대륙 대회',
  notCalled: '이번 A매치 명단에서 빠졌어요.',
  changes: '변화',
  noChange: '큰 변화 없음',
  gamesSummary: (p: { n: number }) => `경기별 기록 ${p.n}경기`,
};

export type GameReportMsgs = typeof ko;
export const gameReportText = ns('gameReport', ko);
