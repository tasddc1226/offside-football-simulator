// T-11-562 시즌 고르기(웹 · 앱 공용). 고른 칸에는 이름 · 상태, 목록 줄에는 이름 · 기간 · 상태를 쓴다.
import { ns } from '../core';

const ko = {
  live: '진행 중',
  closed: '마감',
  upcoming: '개막 예정',
  /** 고른 칸: 진행 중 · 개막 예정인 시즌만 상태를 붙인다. */
  face: (p: { name: string; status: string }) => `${p.name} · ${p.status}`,
  /** 목록 줄: 이름 · 기간 · 상태. */
  row: (p: { name: string; period: string; status: string }) =>
    `${p.name} · ${p.period} · ${p.status}`,
  /** 앱 목록 둘째 줄: 기간 · 상태. */
  detail: (p: { period: string; status: string }) => `${p.period} · ${p.status}`,
  periodFrom: (p: { from: string }) => `${p.from} ~`,
  periodRange: (p: { from: string; to: string }) => `${p.from} ~ ${p.to}`,
  periodUntil: (p: { to: string }) => `~ ${p.to}`,
};

export type SeasonPickMsgs = typeof ko;
export const seasonPickText = ns('seasonPick', ko);
