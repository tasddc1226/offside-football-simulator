// T-11-379 선수 커리어 구간 결과의 평점 구성 · 능력치 카드와 시즌 결산의 성장 방향(초기 화면에 실리니 짧게 둔다).
import { ns } from '../core';

const ko = {
  // 선수 커리어 평점 구성(구간 결과)
  partsTitle: '평점 구성 · 경기 평균',
  partBase: '기본',
  partGoals: '골',
  partAssists: '도움',
  partOvrEdge: 'OVR 우위',
  partCond: '컨디션',
  partMorale: '사기',
  partForm: '그날 경기력',
  partCs: '무실점',
  partDef: '수비 기여',
  partResult: '팀 결과',
  partLuck: '그 밖의 흔들림',
  partsAria: (p: { list: string }) => `평점 구성: ${p.list}`,
  // 성장 방향(능력치 카드 · 시즌 결산)
  dirTitle: '성장 방향',
  dirGoal: (p: { attr: string; pct: number; n: number; up: boolean }) =>
    `골에는 ${p.attr} 비중이 ${p.pct}%로 가장 커요. 지금 리그 평균보다 ${p.n} ${p.up ? '높아요' : '낮아요'}.`,
  dirAssist: (p: { attr: string; pct: number; n: number; up: boolean }) =>
    `도움에는 ${p.attr} 비중이 ${p.pct}%로 가장 커요. 지금 리그 평균보다 ${p.n} ${p.up ? '높아요' : '낮아요'}.`,
  dirKnee: '공격 능력치가 리그 평균보다 충분히 높아요. 더 올려도 골 · 도움은 조금씩만 늘어요.',
  dirDef: (p: { n: number; up: boolean }) =>
    `평점에는 수비 능력치가 리그 평균보다 높은 만큼 더해져요. 지금 ${p.n} ${p.up ? '높아요' : '낮아요'}.`,
};

export type RatingReportMsgs = typeof ko;
export const ratingReportText = ns('ratingReport', ko);
