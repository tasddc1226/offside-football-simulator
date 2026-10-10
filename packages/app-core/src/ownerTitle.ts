// T-11-150 대표 칭호 표시 — 칭호 id('cup-3-champion')에서 회차와 단계를 읽어 문구와 트로피를 고른다.
import { parseTitle, permanentTitleOf, type TitleStage } from '@offside/contracts/owner-title';
import { ownerProfileText as L } from './i18n/ko/ownerProfile.js';

export { parseTitle, TITLE_NONE } from '@offside/contracts/owner-title';

const LABEL: Record<TitleStage, (p: { n: number }) => string> = {
  champion: (p) => L.titleChampion(p),
  runnerup: (p) => L.titleRunnerup(p),
  sf: (p) => L.titleSf(p),
};

/** '제3회 챔피언'(지금 언어). 알 수 없는 id면 null. */
export function titleLabel(id: string | null | undefined): string | null {
  const t = parseTitle(id);
  const permanent = permanentTitleOf(id);
  return t
    ? LABEL[t.stage]({ n: t.edition })
    : permanent
      ? {
          'owner-developer': L.titleDeveloper,
          'owner-academy': L.titleAcademy,
          'owner-star-maker': L.titleStarMaker,
          'owner-ballon-maker': L.titleBallonMaker,
          'owner-legend-home': L.titleLegendHome,
          'owner-pioneer': L.titlePioneer,
        }[permanent.id]
      : null;
}

export function titleCondition(id: string): string | null {
  const t = permanentTitleOf(id);
  return t
    ? {
        'owner-developer': L.conditionDeveloper,
        'owner-academy': L.conditionAcademy,
        'owner-star-maker': L.conditionStarMaker,
        'owner-ballon-maker': L.conditionBallonMaker,
        'owner-legend-home': L.conditionLegendHome,
        'owner-pioneer': L.conditionPioneer,
      }[t.id]
    : null;
}

/** Shared football-inspired line art, 24 × 24; no glyph/font dependency across platforms. */
export function titleIconPath(id: string): string {
  switch (permanentTitleOf(id)?.symbol) {
    case 'academy':
      return 'M3 21V8l9-5 9 5v13H3M8 21v-6h8v6M7 10h2m6 0h2M7 12h2m6 0h2';
    case 'star':
      return 'm12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4L2.8 9.7l6.4-.9L12 3Z';
    case 'ball':
      return 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7l5 4-2 6H9l-2-6 5-4ZM12 3v4m9 5-4-1m.5 8-2.5-2m-8.5 2L9 17M3 12l4-1';
    case 'shirt':
      return 'm8 3-5 3-2 5 5 2v8h12v-8l5-2-2-5-5-3c0 4-8 4-8 0ZM10 11h3v7m-3 0h6';
    default:
      return 'M5 22V3m0 1h14l-3 4 3 4H5';
  }
}
