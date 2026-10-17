// T-11-372 시즌 특별 카드 띠(웹 PlayerCard · 앱 PlayerCard · 결산 화면). 색은 웹 · 앱이 같이 쓴다.
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

/** 띠 색: 개인상은 금색, 베스트 11은 시즌 색과 섞이지 않는 청록. */
export const SPECIAL_COLORS: Record<CardSpecialKind, { bg: string; ink: string; glow: string }> = {
  mvp: { bg: '#f3c64a', ink: '#3b2604', glow: '#ffd96a' },
  top_scorer: { bg: '#f3c64a', ink: '#3b2604', glow: '#ffd96a' },
  top_assist: { bg: '#f3c64a', ink: '#3b2604', glow: '#ffd96a' },
  best11: { bg: '#2fb3a3', ink: '#04201c', glow: '#6fe3d3' },
};

export type SpecialRibbon = { kind: CardSpecialKind; season: number; text: string; aria: string };

/** 카드 띠에 그릴 대표 표식(최근 시즌 · 종류 순 하나). 표식이 없으면 null. */
export function specialRibbon(
  marks: readonly CardSpecialMark[] | null | undefined,
): SpecialRibbon | null {
  const top = topSpecial(marks);
  if (!top) return null;
  const text = `${cardSeasonBadge(top.season)} ${specialKindLabel(top.kind)}`;
  return { kind: top.kind, season: top.season, text, aria: L.specialAria({ label: text }) };
}
