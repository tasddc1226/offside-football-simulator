// T-11-033 시즌 업적 등급 엠블럼. 64×64 벡터 레이어라 웹(svg)·앱(react-native-svg)이 같은 모양을 그리고 16px에서도 선명하다.
// 모든 면을 다각형으로 깎아(왼쪽 반은 밝게, 테두리는 어둡게) 금속·보석 느낌을 내고, 등급이 오를수록 장식이 붙는다:
// 루키 동전 → 브론즈·실버 방패(V 표식 1·2줄) → 골드 별+날개 → 플래티넘 육각 보석 → 다이아 마름모 보석 → 레전드 왕관.
import type { AchGrade } from '@offside/contracts/owner-team';

/** 레이어 색 이름 — 등급 팔레트에서 실제 색을 고른다. */
export type EmblemTone = 'rim' | 'base' | 'light' | 'mark' | 'trim' | 'trimDark';
export type EmblemLayer = { d: string; tone: EmblemTone };
export type EmblemPalette = Record<EmblemTone, string>;

type Pt = readonly [number, number];
const r1 = (n: number) => Math.round(n * 10) / 10;
const poly = (pts: readonly Pt[]) => `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')}z`;
/** 오른쪽 반(가운데 위 → 가운데 아래)을 좌우로 이어 붙인 대칭 다각형. */
const sym = (right: readonly Pt[]): Pt[] => {
  const left = right
    .slice(1, -1)
    .reverse()
    .map(([x, y]) => [64 - x, y] as const);
  return [...right, ...left];
};
/** 대칭 다각형의 왼쪽 반 — 빛을 받는 면. */
const mirror = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]) => [64 - x, y] as const);
const leftHalf = (right: readonly Pt[]): Pt[] => [
  right[0]!,
  ...mirror(right.slice(1, -1)),
  right[right.length - 1]!,
];
const shift = (pts: readonly Pt[], dx: number, dy: number): Pt[] =>
  pts.map(([x, y]) => [x + dx, y + dy] as const);
/** 가운데 점을 기준으로 줄인 다각형(안쪽 면). */
const inset = (pts: readonly Pt[], k: number, cx = 32, cy = 32): Pt[] =>
  pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k] as const);

function star(cx: number, cy: number, R: number, r: number): Pt[] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r : R;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as const;
  });
}
function circle(cx: number, cy: number, r: number, n = 24): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n - Math.PI / 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  });
}
/** 위로 꺾인 V 표식 한 줄(가운데 꼭짓점 y). */
const chevron = (y: number, w = 11, t = 5.5): Pt[] => [
  [32, y],
  [32 + w, y + w * 0.62],
  [32 + w, y + w * 0.62 + t],
  [32, y + t],
  [32 - w, y + w * 0.62 + t],
  [32 - w, y + w * 0.62],
];

// ───────── 몸통 ─────────
/** 깎은 방패(오른쪽 반). */
const SHIELD: Pt[] = [
  [32, 7],
  [49, 11],
  [51, 30],
  [45.5, 44],
  [32, 58],
];
/** 육각 보석(오른쪽 반). */
const HEX: Pt[] = [
  [32, 5],
  [51, 16],
  [51, 40],
  [32, 59],
];
/** 마름모 보석(오른쪽 반) — 위 꼭짓점을 잘라 보석 윗면을 낸다. */
const GEM: Pt[] = [
  [32, 6],
  [44, 6],
  [56, 22],
  [32, 60],
];

/** 몸통 = 테두리(어두움) + 왼쪽 테두리(바탕) + 안쪽 면(바탕) + 안쪽 왼쪽 면(밝음). */
function body(right: readonly Pt[], k: number, cy = 32): EmblemLayer[] {
  const outer = sym(right);
  const inner = inset(outer, k, 32, cy);
  const innerRight = inset(right, k, 32, cy);
  return [
    { d: poly(outer), tone: 'rim' },
    { d: poly(leftHalf(right)), tone: 'base' },
    { d: poly(inner), tone: 'base' },
    { d: poly(leftHalf(innerRight)), tone: 'light' },
  ];
}
function coin(): EmblemLayer[] {
  const o = circle(32, 32, 25);
  const i = circle(32, 32, 19.5);
  // 점은 맨 위에서 시계 방향 — 뒤쪽 절반이 왼쪽 반원이다.
  const half = (pts: Pt[]) => [...pts.slice(pts.length / 2), pts[0]!];
  return [
    { d: poly(o), tone: 'rim' },
    { d: poly(half(o)), tone: 'base' },
    { d: poly(i), tone: 'base' },
    { d: poly(half(i)), tone: 'light' },
  ];
}

// ───────── 장식 ─────────
/** 날개(오른쪽) — 깃 세 장. size 1 = 골드, 클수록 길다. */
function wing(size: number, y: number, x0: number): Pt[] {
  const s = size;
  return [
    [x0, y],
    [x0 + 9 * s, y - 6 * s],
    [x0 + 13 * s, y - 7 * s],
    [x0 + 10 * s, y - 2 * s],
    [x0 + 13 * s, y - 1 * s],
    [x0 + 8.5 * s, y + 3.5 * s],
    [x0 + 10.5 * s, y + 5 * s],
    [x0 + 5 * s, y + 8 * s],
    [x0, y + 9 * s],
  ];
}
function wings(size: number, y: number, x0: number): EmblemLayer[] {
  const w = wing(size, y, x0);
  return [
    { d: poly(w), tone: 'trimDark' },
    { d: poly(mirror(w)), tone: 'trim' },
  ];
}
function crown(): EmblemLayer[] {
  const c: Pt[] = [
    [18, 12],
    [17, 2],
    [24, 7],
    [32, 0],
    [40, 7],
    [47, 2],
    [46, 12],
  ];
  return [
    { d: poly(c), tone: 'trim' },
    {
      d: poly([
        [32, 0],
        [40, 7],
        [47, 2],
        [46, 12],
        [32, 12],
      ]),
      tone: 'trimDark',
    },
  ];
}
const mark = (pts: Pt[]): EmblemLayer => ({ d: poly(pts), tone: 'mark' });

const EMBLEMS: Record<AchGrade['id'], () => EmblemLayer[]> = {
  rookie: () => [...coin(), mark(chevron(28, 9, 5))],
  bronze: () => [...body(SHIELD, 0.74), mark(chevron(27))],
  silver: () => [...body(SHIELD, 0.74), mark(chevron(22)), mark(chevron(32))],
  gold: () => [...wings(1, 18, 49), ...body(SHIELD, 0.74), mark(star(32, 31, 10, 4.2))],
  platinum: () => [...wings(1.05, 17, 50), ...body(HEX, 0.72), mark(star(32, 32, 10.5, 4.4))],
  diamond: () => [...wings(1, 14, 50), ...body(GEM, 0.66, 28), mark(star(32, 26, 8.5, 3.6))],
  legend: () => [
    ...wings(1.1, 20, 49),
    ...body(shift(SHIELD, 0, 4), 0.72, 36),
    ...crown(),
    mark(star(32, 35, 10, 4.2)),
  ],
};

/** 등급별 금속·보석 색. mark는 표식(별·V), trim은 날개·왕관. */
export const EMBLEM_PALETTE: Record<AchGrade['id'], EmblemPalette> = {
  rookie: {
    rim: '#4f6157',
    base: '#7f9a86',
    light: '#a9c2ae',
    mark: '#eef5ef',
    trim: '#a9c2ae',
    trimDark: '#7f9a86',
  },
  bronze: {
    rim: '#7a4219',
    base: '#b8722f',
    light: '#dfa46b',
    mark: '#fff1e2',
    trim: '#dfa46b',
    trimDark: '#b8722f',
  },
  silver: {
    rim: '#5d6873',
    base: '#97a3ae',
    light: '#d7dee5',
    mark: '#ffffff',
    trim: '#d7dee5',
    trimDark: '#97a3ae',
  },
  gold: {
    rim: '#8a5f05',
    base: '#d29a14',
    light: '#f6cf55',
    mark: '#fff8dc',
    trim: '#f6cf55',
    trimDark: '#d29a14',
  },
  platinum: {
    rim: '#11665c',
    base: '#24a596',
    light: '#79e0d2',
    mark: '#f0fffc',
    trim: '#b9efe8',
    trimDark: '#79e0d2',
  },
  diamond: {
    rim: '#1f3fa6',
    base: '#4573f0',
    light: '#9cb8ff',
    mark: '#ffffff',
    trim: '#cfdcff',
    trimDark: '#9cb8ff',
  },
  legend: {
    rim: '#5e1689',
    base: '#a63ae6',
    light: '#d99bff',
    mark: '#ffe58a',
    trim: '#f6cf55',
    trimDark: '#d29a14',
  },
};

/** 등급 엠블럼 레이어(아래부터 그린다). 모르는 등급은 루키 모양. */
export function gradeEmblem(id: string): { layers: EmblemLayer[]; palette: EmblemPalette } {
  const key = (id in EMBLEMS ? id : 'rookie') as AchGrade['id'];
  return { layers: EMBLEMS[key](), palette: EMBLEM_PALETTE[key] };
}
