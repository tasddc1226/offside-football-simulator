// T-11-128 기록 배지 모양 — 웹(HonorEmblem.svelte)과 앱(HonorEmblem.tsx)이 같은 좌표를 그린다.
// 단계가 높을수록 틀이 화려해진다: 동 = 둥근 메달, 은 = 방패, 금 = 날개 달린 방패 + 왕관. 가운데 문양은 휘장 종류.
// 좌표계는 EMBLEM_VIEWBOX(80×88). 문양은 24×24 격자로 그려 GLYPH_AT 위치에 1.5배로 놓는다.
import type { OwnerHonor } from '@offside/contracts';

export const EMBLEM_VIEWBOX = '0 0 80 88';
/** 문양을 놓을 자리(translate x y, scale). 틀 가운데. */
export const GLYPH_AT = { x: 22, y: 21, scale: 1.5 } as const;

export type EmblemMedal = 'gold' | 'silver' | 'bronze';
export type EmblemFrame = {
  /** 바깥 테(금속). */
  outer: string;
  /** 안쪽 바탕(어두운 판). */
  inner: string;
  /** 금속 위 반사광(위쪽 절반). */
  shine: string;
  /** 금: 양옆 날개 깃털(금속). */
  wings?: string;
  /** 금: 위 왕관(금속). */
  crown?: string;
};

const SHIELD_OUTER = 'M40 12 L64 20 V42 C64 59 53 70 40 77 C27 70 16 59 16 42 V20 Z';
const SHIELD_INNER =
  'M40 17.5 L59 24 V42 C59 55.5 50.5 64.5 40 70.5 C29.5 64.5 21 55.5 21 42 V24 Z';
const SHIELD_SHINE = 'M40 12 L64 20 V32 C56 28 48 27 40 27 C32 27 24 28 16 32 V20 Z';

export const EMBLEM_FRAME: Record<EmblemMedal, EmblemFrame> = {
  bronze: {
    outer: 'M40 15 A28 28 0 1 1 39.99 15 Z',
    inner: 'M40 20.5 A22.5 22.5 0 1 1 39.99 20.5 Z',
    shine: 'M12.6 38 A28 28 0 0 1 67.4 38 C58 33 50 31.5 40 31.5 C30 31.5 22 33 12.6 38 Z',
  },
  silver: { outer: SHIELD_OUTER, inner: SHIELD_INNER, shine: SHIELD_SHINE },
  gold: {
    outer: SHIELD_OUTER,
    inner: SHIELD_INNER,
    shine: SHIELD_SHINE,
    wings:
      'M16 24 C8 24 2.5 30 2 39 C6 35.5 10 34.5 16 35 Z ' +
      'M16 37 C9 38.5 4.5 44.5 5 52 C8.5 48 12 46.5 17 46.5 Z ' +
      'M18 49 C12.5 51.5 10 56.5 11 62 C14 58.5 17 57 21 57 Z ' +
      'M64 24 C72 24 77.5 30 78 39 C74 35.5 70 34.5 64 35 Z ' +
      'M64 37 C71 38.5 75.5 44.5 75 52 C71.5 48 68 46.5 63 46.5 Z ' +
      'M62 49 C67.5 51.5 70 56.5 69 62 C66 58.5 63 57 59 57 Z',
    crown: 'M28 15 L29.5 4 L35 10 L40 1.5 L45 10 L50.5 4 L52 15 C46 13.5 34 13.5 28 15 Z',
  },
};

/** 아래 리본(단계 · 개수 글자를 얹는다). 글자 기준선 RIBBON_TEXT. */
export const RIBBON = 'M8 68 H72 L67 75 L72 82 H8 L13 75 Z';
export const RIBBON_TEXT = { x: 40, y: 79 } as const;

export type GlyphPart = { d: string; stroke?: boolean };

/** 휘장 종류별 문양(24×24). stroke면 선으로, 아니면 채워 그린다. */
export const HONOR_GLYPH: Record<OwnerHonor['kind'], readonly GlyphPart[]> = {
  // 별 — 업적.
  achievements: [
    {
      d: 'M12 1.5 L15 8.4 L22.5 9.1 L16.8 14 L18.5 21.4 L12 17.5 L5.5 21.4 L7.2 14 L1.5 9.1 L9 8.4 Z',
    },
  ],
  // 트로피 — 팀 레이팅.
  team: [
    { d: 'M6 2.5 H18 V9 C18 12.6 15.3 15.3 12 15.3 C8.7 15.3 6 12.6 6 9 Z' },
    { d: 'M6 5 H2.8 C2.8 9 4.6 11 7 11.4 M18 5 H21.2 C21.2 9 19.4 11 17 11.4', stroke: true },
    { d: 'M10.6 15 H13.4 V18.6 H10.6 Z M7 19 H17 V22 H7 Z' },
  ],
  // 신전 — 명예의 전당.
  hof: [
    {
      d: 'M12 1.5 L22 7.8 H2 Z M3.5 9 H20.5 V11 H3.5 Z M5 12 H7.6 V19 H5 Z M10.7 12 H13.3 V19 H10.7 Z M16.4 12 H19 V19 H16.4 Z M2.5 20 H21.5 V22.5 H2.5 Z',
    },
  ],
  // 등번호 유니폼 — 영구결번.
  'retired-number': [
    {
      d: 'M8 2.5 L3.8 4.6 L1 10.2 L4.8 11.8 V22 H19.2 V11.8 L23 10.2 L20.2 4.6 L16 2.5 C15 4.6 13.6 5.6 12 5.6 C10.4 5.6 9 4.6 8 2.5 Z',
    },
  ],
  // 벽돌 벽 — 명예의 벽.
  'wall-of-honor': [
    {
      d: 'M2.5 4 H11 V8.5 H2.5 Z M13 4 H21.5 V8.5 H13 Z M2.5 10.5 H6.5 V15 H2.5 Z M8.5 10.5 H15.5 V15 H8.5 Z M17.5 10.5 H21.5 V15 H17.5 Z M2.5 17 H11 V21.5 H2.5 Z M13 17 H21.5 V21.5 H13 Z',
    },
  ],
  // 깃발 — 서버 최초 기록.
  first: [
    { d: 'M4.5 1.5 H6.8 V22.5 H4.5 Z' },
    {
      d: 'M6.8 2.6 C10 1 13 4.4 16.2 2.8 C17.8 2.1 19.2 1.8 20.5 2.3 V12.4 C17.4 13.8 14.4 10.6 10.8 12 C9.2 12.6 8 13 6.8 13.2 Z',
    },
  ],
  // 나침반 — 프리시즌 개척자(처음 길을 연 구단주).
  pioneer: [
    { d: 'M21.5 12 A9.5 9.5 0 1 1 2.5 12 A9.5 9.5 0 1 1 21.5 12', stroke: true },
    { d: 'M12 3.5 L14.4 12 L12 20.5 L9.6 12 Z' },
    { d: 'M3.5 12 L12 10.2 L20.5 12 L12 13.8 Z' },
  ],
};
