// T-11-145 오프사이드 컵 트로피. 업적 등급 엠블럼(gradeEmblem.ts)과 같은 64×64 다각형 레이어 — 왼쪽 반은 빛을 받아
// 밝고 테두리는 어둡다 — 라 웹(svg)·앱(react-native-svg)이 같은 모양을 그리고 작게 줄여도 또렷하다.
// 금속 잔(우승 금 · 준우승 은 · 4강 동) 아래 브랜드 짙은 녹색 받침대에 빨간 오프사이드 라인과 회차 숫자를 새긴다.
// 우승 트로피만 월계수 가지와 큰 별을 단다.
import { CUP_REWARDS, type CupStage } from '@offside/contracts/cup';
import { EMBLEM_PALETTE, type EmblemPalette } from './gradeEmblem.js';

export type TrophyStage = Extract<CupStage, 'champion' | 'runnerup' | 'sf'>;
export type TrophyTone = keyof EmblemPalette | 'plinth' | 'plinthLight' | 'line';
export type TrophyLayer = { d: string; tone: TrophyTone };
export type TrophyPalette = Record<TrophyTone, string> & { number: string };

type Pt = readonly [number, number];
const r1 = (n: number) => Math.round(n * 10) / 10;
const poly = (pts: readonly Pt[]) => `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')}z`;
const flip = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]) => [64 - x, y] as const);
/** 오른쪽 반(가운데 위 → 가운데 아래)을 좌우로 이어 붙인 대칭 다각형. */
const sym = (right: readonly Pt[]): Pt[] => [...right, ...flip(right.slice(1, -1)).reverse()];
/** 대칭 다각형의 왼쪽 반 — 빛을 받는 면. */
const leftHalf = (right: readonly Pt[]): Pt[] => [
  right[0]!,
  ...flip(right.slice(1, -1)),
  right[right.length - 1]!,
];
const inset = (pts: readonly Pt[], k: number, cx: number, cy: number): Pt[] =>
  pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k] as const);

/** 깎은 면 한 벌: 테두리(어두움) + 왼쪽 테두리(바탕) + 안쪽(바탕) + 안쪽 왼쪽(밝음). */
function facet(right: readonly Pt[], k: number, cy: number): TrophyLayer[] {
  const inner = inset(right, k, 32, cy);
  return [
    { d: poly(sym(right)), tone: 'rim' },
    { d: poly(leftHalf(right)), tone: 'base' },
    { d: poly(sym(inner)), tone: 'base' },
    { d: poly(leftHalf(inner)), tone: 'light' },
  ];
}

// ───────── 잔 ─────────
const LIP: Pt[] = [
  [32, 5],
  [50, 5],
  [49.5, 8.5],
  [32, 8.5],
];
const BOWL: Pt[] = [
  [32, 8],
  [48, 8],
  [47.5, 13],
  [46, 21],
  [42, 28.5],
  [36.5, 32.5],
  [32, 33],
];
const STEM: Pt[] = [
  [32, 32.5],
  [35, 32.5],
  [34, 40.5],
  [32, 40.5],
];
const KNOT: Pt[] = [
  [32, 35.5],
  [37, 35.5],
  [37.5, 37.5],
  [32, 37.5],
];
const COLLAR: Pt[] = [
  [32, 40],
  [40, 40],
  [43, 44.5],
  [32, 44.5],
];
/** 손잡이(오른쪽) — 바깥 테두리와 거꾸로 감은 안쪽 구멍. */
const HANDLE_OUT: Pt[] = [
  [47, 10],
  [53, 9.5],
  [57.5, 12.5],
  [58, 19],
  [54.5, 25.5],
  [45, 30],
  [44.5, 27],
  [51.5, 22.5],
  [53.5, 18.5],
  [53, 14.5],
  [50.5, 13.5],
  [47.5, 14],
];
const handle = (pts: readonly Pt[]) => poly(pts);

// ───────── 받침대 ─────────
const PLINTH: Pt[] = [
  [32, 44],
  [47.5, 44],
  [47.5, 61.5],
  [32, 61.5],
];
const PLINTH_FACE: Pt[] = [
  [32, 46.3],
  [46.3, 46.3],
  [46.3, 58.6],
  [32, 58.6],
];
/** 받침대 아래 금속 띠. */
const BAND: Pt[] = [
  [32, 58.6],
  [47.5, 58.6],
  [47.5, 61.5],
  [32, 61.5],
];
const OFFSIDE_LINE: Pt[] = [
  [21.8, 48],
  [23.9, 48],
  [21.9, 57.2],
  [19.8, 57.2],
];
/** 회차 숫자 자리(받침대 가운데). 글자 크기는 viewBox 단위. */
export const TROPHY_NUMBER = { x: 33.4, y: 56.6, size: 10 } as const;
export const TROPHY_VIEWBOX = '0 0 64 64';

// ───────── 장식 ─────────
function star(cx: number, cy: number, R: number, r: number): Pt[] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r : R;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as const;
  });
}
/** 잎 하나 — 가운데 (cx, cy)에서 각도 deg 방향으로 길쭉한 마름모. */
function leaf(cx: number, cy: number, deg: number, len = 4.2, w = 1.6): Pt[] {
  const a = (deg * Math.PI) / 180;
  const [ux, uy] = [Math.cos(a), Math.sin(a)];
  return [
    [cx + ux * len, cy + uy * len],
    [cx - uy * w, cy + ux * w],
    [cx - ux * len, cy - uy * len],
    [cx + uy * w, cy - ux * w],
  ];
}
/** 월계수 가지(왼쪽 = 밝음, 오른쪽 = 어두움) — 받침대 위에서 잔 옆으로 감아 오른다. */
function laurel(): TrophyLayer[] {
  const left: Pt[][] = [];
  for (let k = 0; k < 6; k++) {
    const a = ((128 + k * 19) * Math.PI) / 180;
    const [x, y] = [32 + 27 * Math.cos(a), 26 + 21 * Math.sin(a)];
    const tangent = 128 + k * 19 + 90;
    left.push(leaf(x - 1.6, y, tangent - 32), leaf(x + 1.6, y, tangent + 32));
  }
  return [
    ...left.map((p) => ({ d: poly(flip(p)), tone: 'trimDark' as const })),
    ...left.map((p) => ({ d: poly(p), tone: 'trim' as const })),
  ];
}

function trophy(stage: TrophyStage): TrophyLayer[] {
  const mark: Pt[] =
    stage === 'champion'
      ? star(32, 18.5, 7.6, 3.2)
      : stage === 'runnerup'
        ? star(32, 18.5, 5.6, 2.4)
        : [
            [32, 14.5],
            [37, 18],
            [37, 21.5],
            [32, 18],
            [27, 21.5],
            [27, 18],
          ];
  return [
    ...(stage === 'champion' ? laurel() : []),
    { d: handle(HANDLE_OUT), tone: 'rim' },
    { d: handle(flip(HANDLE_OUT)), tone: 'base' },
    ...facet(BOWL, 0.8, 18),
    ...facet(LIP, 0.6, 6.8),
    { d: poly(mark), tone: 'mark' },
    ...facet(STEM, 0.6, 36),
    ...facet(KNOT, 0.6, 36.5),
    ...facet(COLLAR, 0.7, 42),
    { d: poly(sym(PLINTH)), tone: 'plinthLight' },
    { d: poly(sym(PLINTH_FACE)), tone: 'plinth' },
    { d: poly(sym(BAND)), tone: 'rim' },
    { d: poly(leftHalf(BAND)), tone: 'base' },
    { d: poly(OFFSIDE_LINE), tone: 'line' },
  ];
}

const METAL: Record<TrophyStage, EmblemPalette> = {
  champion: EMBLEM_PALETTE.gold,
  runnerup: EMBLEM_PALETTE.silver,
  sf: EMBLEM_PALETTE.bronze,
};
/** 받침대는 브랜드 잉크(#0F2219)·라임(#D6F24A)·오프사이드 라인(#E8412C). */
const BRAND = { plinth: '#0F2219', plinthLight: '#3E6B4F', line: '#E8412C', number: '#D6F24A' };

const cache = new Map<TrophyStage, { layers: TrophyLayer[]; palette: TrophyPalette }>();
/** 단계별 트로피 레이어(아래부터 그린다)와 색. 단계마다 한 번만 만든다. */
export function cupTrophy(stage: TrophyStage): { layers: TrophyLayer[]; palette: TrophyPalette } {
  let t = cache.get(stage);
  if (!t) cache.set(stage, (t = { layers: trophy(stage), palette: { ...METAL[stage], ...BRAND } }));
  return t;
}

/** 트로피를 받는 단계(CUP_REWARDS)면 그 단계, 아니면 null(8강 이하는 기록 한 줄). */
export const trophyStage = (stage: CupStage): TrophyStage | null =>
  CUP_REWARDS[stage].trophy ? (stage as TrophyStage) : null;
