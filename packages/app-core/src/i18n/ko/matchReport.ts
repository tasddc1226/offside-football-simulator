// T-11-379 경기 리포트 — 팀 경기 결과 · 시즌 통계의 기대 득점과 줄 비교(웹 TeamReport · TeamStats, 앱 같은 화면).
// 선수 쪽 평점 구성 · 성장 방향은 ratingReport.
import { ns } from '../core';

const ko = {
  // 한 판 리포트
  title: '경기 리포트',
  xgLine: (p: { mine: string; opp: string }) => `기대 득점(xG) ${p.mine} : ${p.opp}`,
  xgHint: '두 팀 줄 힘으로 정한 득점 기대값이에요. 1.0이면 평균 한 골이에요.',
  compareOpen: '줄 비교 보기',
  compareClose: '줄 비교 접기',
  lineAtk: '내 공격 vs 상대 수비벽',
  lineMid: '내 중원 vs 상대 중원',
  lineDef: '내 수비벽 vs 상대 공격',
  lineAria: (p: { line: string; mine: number; opp: number }) => `${p.line}: ${p.mine} 대 ${p.opp}`,
  wallNote: '수비벽은 수비 70%에 골키퍼 30%를 더한 값이에요.',
  dLuckWin: '기대 득점은 밀렸지만 결과를 챙겼어요.',
  dLuckLoss: '기대 득점은 앞섰지만 골이 따라오지 않았어요.',
  dEven: '세 줄이 모두 비슷했어요. 결과는 그날 흐름이 갈랐어요.',
  dAtkUp: (p: { n: string }) => `공격이 상대 수비벽보다 ${p.n} 앞서 기회를 많이 만들었어요.`,
  dAtkDown: (p: { n: string }) => `공격이 상대 수비벽보다 ${p.n} 밀려 기회가 적었어요.`,
  dMidUp: (p: { n: string }) => `중원에서 ${p.n} 앞서 경기를 쥐었어요.`,
  dMidDown: (p: { n: string }) => `중원에서 ${p.n} 밀려 상대에게 공을 더 내줬어요.`,
  dDefUp: (p: { n: string }) => `수비벽이 상대 공격보다 ${p.n} 단단해 기회를 적게 내줬어요.`,
  dDefDown: (p: { n: string }) => `수비벽이 상대 공격보다 ${p.n} 약해 기회를 많이 내줬어요.`,
  fix: (p: { pos: string }) => `고칠 곳 · ${p.pos}`,
  fixAria: (p: { pos: string }) => `${p.pos} 자리에 넣을 선수 고르기`,
  // 시즌 리포트
  seasonTitle: '경기 리포트',
  seasonEmpty: '기대 득점은 이번 업데이트 뒤에 치른 경기부터 모여요.',
  seasonXg: (p: { n: number; xgFor: string; gf: number; xgAgainst: string; ga: number }) =>
    `${p.n}경기 · 기대 득점 ${p.xgFor} → 실제 ${p.gf}골 · 기대 실점 ${p.xgAgainst} → 실제 ${p.ga}골`,
  seasonFinishUp: (p: { n: string }) => `기대보다 ${p.n}골 더 넣었어요.`,
  seasonFinishDown: (p: { n: string }) => `기대보다 ${p.n}골 덜 넣었어요.`,
  seasonFinishEven: '기대만큼 넣었어요.',
  seasonBehind: (p: { line: string; k: number; n: number }) =>
    `가장 자주 밀린 비교는 ${p.line}이에요(${p.k}/${p.n}경기).`,
  seasonNoBehind: '세 줄 비교에서 밀린 경기가 없어요.',
  seasonEdges: '평균 줄 비교',
  seasonFormations: '포메이션별',
  seasonFormationRow: (p: { w: number; d: number; l: number; xgFor: string; xgAgainst: string }) =>
    `${p.w}승 ${p.d}무 ${p.l}패 · 기대 득점 ${p.xgFor} : ${p.xgAgainst}`,
};

export type MatchReportMsgs = typeof ko;
export const matchReportText = ns('matchReport', ko);
