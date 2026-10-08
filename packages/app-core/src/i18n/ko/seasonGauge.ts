// 시즌 진행 게이지(웹 SeasonGauge.svelte · 앱 screens/home/SeasonGauge.tsx).
import { ns } from '../core';

const ko = {
  title: (p: { season: string }) => `${p.season} 진행률`,
  aria: (p: { season: string; pct: number }) => `${p.season} 진행률 ${p.pct}%`,
  filled: (p: { count: string; target: string }) => `완주 커리어 ${p.count} / ${p.target}`,
  owners: (p: { n: string }) => `참여 구단주 ${p.n}명`,
  howTo: '끝까지 뛴 커리어(35세 이상 은퇴)가 게이지를 채워요. 90%가 되면 마감 날짜가 정해져요.',
  window: (p: { min: string; max: string }) => `빨라도 ${p.min} 0시, 늦어도 ${p.max} 0시에 끝나요.`,
  endsIn: (p: { left: string }) => `시즌 종료까지 ${p.left}`,
  endsAt: (p: { date: string }) =>
    `${p.date} 00:00 마감 · 마감 뒤 은퇴는 이번 시즌 순위에 들어가지 않아요.`,
  ended: '시즌이 끝났어요. 결산을 정리하고 있어요.',
  date: (p: { m: number; d: number }) => `${p.m}월 ${p.d}일`,
  days: (p: { d: number; h: number }) => `${p.d}일 ${p.h}시간`,
  hours: (p: { h: number; m: number }) => `${p.h}시간 ${p.m}분`,
  minutes: (p: { m: number }) => `${p.m}분`,
};

export type SeasonGaugeMsgs = typeof ko;
export const seasonGaugeText = ns('seasonGauge', ko);
