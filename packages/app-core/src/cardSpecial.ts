// T-11-372 시즌 특별 카드 띠(웹 PlayerCard · 앱 PlayerCard · 결산 화면). 색은 웹 · 앱이 같이 쓴다.
// T-11-723 오늘의 랭킹 표식(카드의 daily = 1 · 2 · 3위)은 금 · 은 · 동 색으로 순위만 적는다. 시즌 표식이 있으면 시즌 표식이 먼저다.
import {
  topSpecial,
  type CardSpecialKind,
  type CardSpecialMark,
} from '@offside/contracts/card-special';
import { cardSeasonBadge } from './format';
import { teamHomeText as L } from './i18n/ko/teamHome';

export const specialKindLabel = (kind: CardSpecialKind): string =>
  ({
    mvp: L.specialMvp,
    top_scorer: L.specialTopScorer,
    top_assist: L.specialTopAssist,
    best11: L.specialBest11,
  })[kind];

export type SpecialColor = { bg: string; ink: string; glow: string };

/** 띠 색: 개인상은 금색, 베스트 11은 시즌 색과 섞이지 않는 청록. */
export const SPECIAL_COLORS: Record<CardSpecialKind, SpecialColor> = {
  mvp: { bg: '#f3c64a', ink: '#3b2604', glow: '#ffd96a' },
  top_scorer: { bg: '#f3c64a', ink: '#3b2604', glow: '#ffd96a' },
  top_assist: { bg: '#f3c64a', ink: '#3b2604', glow: '#ffd96a' },
  best11: { bg: '#2fb3a3', ink: '#04201c', glow: '#6fe3d3' },
};

/** 오늘의 랭킹 1 · 2 · 3위 띠 색(금 · 은 · 동). */
export const DAILY_COLORS: readonly SpecialColor[] = [
  { bg: '#f3c64a', ink: '#3b2604', glow: '#ffd96a' },
  { bg: '#cfd6dd', ink: '#1f2a33', glow: '#e9eef2' },
  { bg: '#d4915a', ink: '#2e1604', glow: '#eab385' },
];

export type SpecialRibbon = {
  /** 시즌 표식 종류, 오늘의 랭킹 표식이면 'daily'. */
  kind: CardSpecialKind | 'daily';
  /** 시즌 표식의 시즌(오늘의 랭킹 표식은 0). */
  season: number;
  text: string;
  aria: string;
  color: SpecialColor;
};

/** 카드 띠에 그릴 대표 표식 하나: 시즌 표식(최근 시즌 · 종류 순)이 먼저, 없으면 오늘의 랭킹 순위. 둘 다 없으면 null. */
export function specialRibbon(
  marks: readonly CardSpecialMark[] | null | undefined,
  daily?: number | null,
): SpecialRibbon | null {
  const top = topSpecial(marks);
  if (top) {
    const text = `${cardSeasonBadge(top.season)} ${specialKindLabel(top.kind)}`;
    return {
      kind: top.kind,
      season: top.season,
      text,
      aria: L.specialAria({ label: text }),
      color: SPECIAL_COLORS[top.kind],
    };
  }
  const color = daily ? DAILY_COLORS[daily - 1] : undefined;
  if (!daily || !color) return null;
  return {
    kind: 'daily',
    season: 0,
    text: L.specialDaily({ rank: daily }),
    aria: L.specialDailyAria({ rank: daily }),
    color,
  };
}
