// T-11-373 강화 단계별 카드 효과(웹 team/PlayerCard.svelte · 앱 components/PlayerCard.tsx). 등급(동 · 은 · 금 · 레전드)은 커리어로 정해지고,
// 효과는 그 위에 입힌다. 경기에서 따온 열 장면: 잔디 → 조명탑 → 홍염 → 오프사이드 라인 → 풀타임 → 연장전 → 승부차기 → 결승전 → 우승컵 → 마지막 휘슬. 색은 웹 · 앱이 같이 쓴다.
export type EnhanceFx = {
  /** 테두리 · 배지 그라데이션(앞에서 뒤로). */
  stops: readonly string[];
  glow: string;
  badgeInk: string;
};

const FX: readonly (EnhanceFx | null)[] = [
  null,
  { stops: ['#7be8a8', '#22b573'], glow: '#35d68a', badgeInk: '#04251a' },
  { stops: ['#c7efff', '#35a7f2'], glow: '#58bdff', badgeInk: '#04223a' },
  { stops: ['#ffd34d', '#ff6a2b', '#e5261f'], glow: '#ff6a2b', badgeInk: '#2e0a00' },
  { stops: ['#7cf8ff', '#7a5cff', '#f04dff'], glow: '#9a6bff', badgeInk: '#ffffff' },
  {
    stops: ['#ff5f6d', '#ffc371', '#fff27a', '#7cf29c', '#6ad0ff', '#b388ff', '#ff5f6d'],
    glow: '#ffd76a',
    badgeInk: '#2b1700',
  },
  {
    stops: ['#fff6c9', '#e9b93a', '#c98a12', '#e9b93a', '#fff6c9'],
    glow: '#f2c84b',
    badgeInk: '#2b1700',
  },
  {
    stops: ['#ffffff', '#ff3b4e', '#7a0416', '#ff3b4e', '#ffffff'],
    glow: '#ff3b4e',
    badgeInk: '#ffffff',
  },
  {
    stops: ['#ffe27a', '#1d4fff', '#051a66', '#1d4fff', '#ffe27a'],
    glow: '#4d7bff',
    badgeInk: '#ffffff',
  },
  {
    stops: ['#fffbe0', '#ffd21f', '#ff8a00', '#ffd21f', '#fffbe0'],
    glow: '#ffd21f',
    badgeInk: '#2b1700',
  },
  {
    stops: ['#ffffff', '#ffd21f', '#ff4d6d', '#b04dff', '#35c8ff', '#7cf29c', '#ffd21f', '#ffffff'],
    glow: '#fff1a8',
    badgeInk: '#1a0f00',
  },
];

/** 그 단계의 효과. 강화 전이거나 모르는 값이면 null. */
export const enhanceFx = (level: number | null | undefined): EnhanceFx | null =>
  (level && FX[level]) || null;
