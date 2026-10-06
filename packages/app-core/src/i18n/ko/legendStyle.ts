// 은퇴 리포트의 '플레이 성향' 장면(웹 PlayStyleCredit.svelte · 앱 PlayStyleCredit.tsx · app-core legendReport.ts).
// 성향 유형 이름·설명·'커리어 최고의 한 수' 제목은 게임이 만든 문구라 옮기지 않는다.
import { ns } from '../core';

const ko = {
  title: '플레이 성향',
  bets: '주사위를 굴린 선택',
  betsSmall: (p: { wins: number; pct: number }) => `성공 ${p.wins}번 · ${p.pct}%`,
  luck: '운',
  luckUp: (p: { n: number }) => `기대보다 ${p.n}번 더 성공`,
  luckDown: (p: { n: number }) => `기대보다 ${p.n}번 덜 성공`,
  luckEven: '딱 기대만큼 성공',
  longshots: '40% 이하 승부수',
  longshotsSmall: (p: { n: number }) => `${p.n}번 적중`,
  moves: '이적',
  movesSmall: (p: { tierUp: number; snubUp: number }) =>
    `${p.tierUp ? `윗 리그로 ${p.tierUp}번` : '—'}${p.snubUp ? ` · 빅클럽 거절 ${p.snubUp}번` : ''}`,
  bestLabel: '커리어 최고의 한 수',
  bestBefore: '성공 확률 ',
  bestAfter: (p: { title: string }) => `의 ‘${p.title}’, 기어이 해냈다.`,
  choices: (p: { choices: number; since: number | null | undefined }) =>
    `선택 ${p.choices}번 기준${p.since ? ` · ${p.since}세 이후 기록` : ''}`,
};

export type LegendStyleMsgs = typeof ko;
export const legendStyleText = ns('legendStyle', ko);
