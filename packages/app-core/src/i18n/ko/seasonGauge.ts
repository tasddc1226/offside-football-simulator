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
  /** T-11-224 종료 날짜 줄. w는 요일(0 일요일). 마감은 다음 날 00:00 KST라 그 전날까지로 적는다. */
  date: (p: { m: number; d: number; w: number }) => `${p.m}월 ${p.d}일(${'일월화수목금토'[p.w]})`,
  endsOn: (p: { date: string }) => `${p.date}까지 열려요`,
  endsBy: (p: { date: string }) => `늦어도 ${p.date}까지 열려요`,
  endsBetween: (p: { from: string; to: string }) => `빠르면 ${p.from}, 늦어도 ${p.to}까지 열려요`,
};

export type SeasonGaugeMsgs = typeof ko;
export const seasonGaugeText = ns('seasonGauge', ko);
