// 시즌 진행 게이지(웹 SeasonGauge.svelte · 앱 screens/home/SeasonGauge.tsx).
import { ns } from '../core';

const ko = {
  title: (p: { season: string }) => `${p.season} 진행률`,
  aria: (p: { season: string; pct: number }) => `${p.season} 진행률 ${p.pct}%`,
  endsIn: (p: { left: string }) => `시즌 종료까지 ${p.left}`,
  ended: '시즌이 끝났어요. 결산을 정리하고 있어요.',
  days: (p: { d: number; h: number }) => `${p.d}일 ${p.h}시간`,
  hours: (p: { h: number; m: number }) => `${p.h}시간 ${p.m}분`,
  minutes: (p: { m: number }) => `${p.m}분`,
};

export type SeasonGaugeMsgs = typeof ko;
export const seasonGaugeText = ns('seasonGauge', ko);
