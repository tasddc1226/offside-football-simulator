// 이적시장 시세 차트(웹 ui/MarketChart.svelte · 앱 screens/owner/MarketChart.tsx)와 문구(marketChart.ts).
import { ns } from '../core';

const ko = {
  rangeWeek: '1주',
  rangeMonth: '1달',
  rangeSeason: '시즌',
  rangeGroup: '기간',
  title: '같은 포지션 · 등급 시세',
  /** 묶음 설명: '공격수 OVR 85~89' */
  group: (p: { pos: string; band: number }) => `${p.pos} OVR ${p.band}~${p.band + 4}`,
  legendLine: '하루 평균',
  legendDot: '이 선수 거래',
  empty: '아직 거래가 없어요.',
  failed: '시세를 불러오지 못했어요.',
  loading: '불러오는 중…',
  baseLabel: '기준가',
  index: '시장 시세',
  indexSub: (p: { trades: number }) => `최근 7일 거래 ${p.trades}건 · 기준가 대비`,
  indexA11y: (p: { pct: string; change: string }) => `시장 시세 기준가의 ${p.pct}, ${p.change}`,
  noChange: '변동 없음',
  dayText: (p: { day: string; avg: string; trades: number }) =>
    `${p.day} · 평균 ${p.avg} · ${p.trades}건`,
  tradeText: (p: { day: string; ratio: string }) => `${p.day} 이 선수 · ${p.ratio}`,
};

export type MarketChartMsgs = typeof ko;
export const marketChartText = ns('marketChart', ko);
