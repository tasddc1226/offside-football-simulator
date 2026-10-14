// T-11-145 오프사이드 컵 트로피. 업적 등급 엠블럼(gradeEmblem.ts)과 같은 64×64 다각형 레이어 — 왼쪽 반은 빛을 받아
// 밝고 테두리는 어둡다 — 라 웹(svg)·앱(react-native-svg)이 같은 모양을 그리고 작게 줄여도 또렷하다.
// 금속 잔(우승 금 · 준우승 은 · 4강 동) 아래 넓은 브랜드 짙은 녹색 받침대에 구단주 이름을 새긴다(TROPHY_PLATE).
// 우승 트로피만 월계수 가지와 큰 별을 단다.
import { CUP_REWARDS, type CupStage } from '@offside/contracts/cup';
import { EMBLEM_PALETTE, type EmblemPalette } from './gradeEmblem.js';
import { cupText as L } from './i18n/ko/cup.js';

export type TrophyStage = Extract<CupStage, 'champion' | 'runnerup' | 'sf'>;
export type TrophyTone =
  keyof EmblemPalette | 'plinth' | 'plinthLight' | 'gem' | 'gemDark' | 'gemShine';
/** plinth: 받침대 레이어 — 작게 그릴 때(컵만)는 뺀다. */
export type TrophyLayer = { d: string; tone: TrophyTone; plinth?: true };
export type TrophyPalette = Record<TrophyTone, string> & { engrave: string };

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
// 이름을 새길 수 있게 잔보다 넓다.
const PLINTH: Pt[] = [
  [32, 44],
  [54, 44],
  [54, 61.5],
  [32, 61.5],
];
const PLINTH_FACE: Pt[] = [
  [32, 46.3],
  [52.8, 46.3],
  [52.8, 58.6],
  [32, 58.6],
];
/** 받침대 아래 금속 띠. */
const BAND: Pt[] = [
  [32, 58.6],
  [54, 58.6],
  [54, 61.5],
  [32, 61.5],
];
/** 이름을 새기는 자리(받침대 앞면 안쪽). x·y·w·h·font는 viewBox 단위 — 넘치면 화면이 선수 카드 이름처럼 흘려 보낸다. */
export const TROPHY_PLATE = { x: 12.6, y: 46.3, w: 38.8, h: 12.3, font: 8 } as const;
/** 이보다 작게 그리면 글자가 읽히지 않아 받침대 없이 컵만 그린다(px). */
export const TROPHY_PLATE_MIN = 40;
/** 컵만 그릴 때의 viewBox — 받침대가 빠진 만큼 위로 올려 가운데에 둔다. */
export const TROPHY_CUP_VIEWBOX = '0 -8 64 64';
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

// ───────── 회차별 모양(T-11-253) ─────────
// 회차마다 잔 모양과 보석·리본 색이 바뀐다(10회차마다 돈다). 그림체·금속색·받침대는 같고, 단계 표시(우승 큰 별·준우승 작은 별·4강
// 쉐브론)는 모양마다 정한 자리에 크기를 맞춰 얹는다. 우승 월계수는 실루엣이 넓은 모양(빅 이어·별 기둥·날개 컵)에는 달지 않는다.
const arc = (cy: number, rad: number, n = 10): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = -Math.PI / 2 + (Math.PI * i) / n;
    return [32 + rad * Math.cos(a), cy + rad * Math.sin(a)] as const;
  });
const flat = (right: readonly Pt[]): TrophyLayer[] => [
  { d: poly(sym(right)), tone: 'rim' },
  { d: poly(leftHalf(right)), tone: 'base' },
];
const handles = (right: readonly Pt[]): TrophyLayer[] => [
  { d: handle(right), tone: 'rim' },
  { d: handle(flip(right)), tone: 'base' },
];
const stem = (top: number): TrophyLayer[] => [
  ...facet(
    [
      [32, top],
      [35, top],
      [34, 40.5],
      [32, 40.5],
    ],
    0.6,
    36,
  ),
  ...facet(KNOT, 0.6, 36.5),
  ...facet(COLLAR, 0.7, 42),
];

/** 단계 표시 — (cx, cy) 가운데, s배 크기. */
function stageMark(stage: TrophyStage, cx: number, cy: number, s: number): Pt[] {
  if (stage === 'champion') return star(cx, cy, 7.6 * s, 3.2 * s);
  if (stage === 'runnerup') return star(cx, cy, 5.6 * s, 2.4 * s);
  return (
    [
      [0, -3.5],
      [5, 0],
      [5, 3.5],
      [0, 0],
      [-5, 3.5],
      [-5, 0],
    ] as const
  ).map(([x, y]) => [cx + x * s, cy + y * s] as const);
}

type Shape = {
  body: TrophyLayer[];
  /** 단계 표시 자리(없으면 모양 자체가 표시 — 별 기둥·축구공). */
  mark: { cy: number; s: number } | null;
  laurel: boolean;
  /** 보석 가운데 y. */
  gem: number;
};
const pentagon = (cx: number, cy: number, r: number, turn = 0): Pt[] =>
  Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + turn + (i * 2 * Math.PI) / 5;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  });
const WING: Pt[] = [
  [47, 13],
  [56.5, 8],
  [53.5, 12],
  [57, 13],
  [52, 17],
  [53.5, 19],
  [47.5, 22],
];
const SHAPES: readonly Shape[] = [
  // 1 클래식 컵(제1회 모양)
  {
    laurel: true,
    gem: 27.2,
    mark: { cy: 18.5, s: 1 },
    body: [
      ...handles(HANDLE_OUT),
      ...facet(BOWL, 0.8, 18),
      ...facet(LIP, 0.6, 6.8),
      ...facet(STEM, 0.6, 36),
      ...facet(KNOT, 0.6, 36.5),
      ...facet(COLLAR, 0.7, 42),
    ],
  },
  // 2 롱 고블릿
  {
    laurel: true,
    gem: 21.5,
    mark: { cy: 13.5, s: 0.68 },
    body: [
      ...facet(
        [
          [32, 6],
          [43.5, 6],
          [42.5, 13],
          [39, 21],
          [35, 26.5],
          [32, 27],
        ],
        0.78,
        15,
      ),
      ...facet(
        [
          [32, 3.5],
          [45, 3.5],
          [44.6, 6.6],
          [32, 6.6],
        ],
        0.6,
        5,
      ),
      ...facet(
        [
          [32, 26.5],
          [34, 26.5],
          [33.2, 40.5],
          [32, 40.5],
        ],
        0.6,
        33,
      ),
      ...facet(
        [
          [32, 29.5],
          [36, 29.5],
          [36.4, 31.3],
          [32, 31.3],
        ],
        0.6,
        30.4,
      ),
      ...facet(KNOT, 0.6, 36.5),
      ...facet(COLLAR, 0.7, 42),
    ],
  },
  // 3 빅 이어
  {
    laurel: false,
    gem: 24.5,
    mark: { cy: 16.5, s: 0.87 },
    body: [
      ...handles([
        [44, 10],
        [54, 5.5],
        [60, 13],
        [58.5, 27],
        [51, 37],
        [44, 40],
        [43, 37],
        [48.5, 33.5],
        [54.5, 25.5],
        [55.8, 14.5],
        [52.6, 10.3],
        [45, 13.6],
      ]),
      ...facet(
        [
          [32, 8.5],
          [45.5, 8.5],
          [44.5, 17],
          [40.5, 24.5],
          [35.5, 28.5],
          [32, 29],
        ],
        0.8,
        17,
      ),
      ...facet(
        [
          [32, 5.5],
          [47, 5.5],
          [46.6, 9],
          [32, 9],
        ],
        0.6,
        7,
      ),
      ...stem(28.5),
    ],
  },
  // 4 지구본
  {
    laurel: true,
    gem: 19,
    mark: { cy: 10.5, s: 0.47 },
    body: [
      ...facet(
        [
          [32, 28],
          [38, 27],
          [40, 30.5],
          [35, 33],
          [32, 33],
        ],
        0.6,
        30,
      ),
      ...facet(arc(18, 12.5), 0.82, 18),
      ...flat([
        [32, 16.6],
        [44.6, 16.6],
        [44.6, 21.4],
        [32, 21.4],
      ]),
      {
        d: poly(
          sym([
            [32, 17.6],
            [43.6, 17.6],
            [43.6, 20.4],
            [32, 20.4],
          ]),
        ),
        tone: 'light',
      },
      ...stem(32.5),
    ],
  },
  // 5 별 기둥
  {
    laurel: false,
    gem: 28,
    mark: null,
    body: [
      ...facet(
        [
          [32, 17],
          [36.6, 17],
          [35.6, 40.5],
          [32, 40.5],
        ],
        0.6,
        29,
      ),
      ...facet(
        [
          [32, 15],
          [40, 15],
          [39, 18],
          [32, 18],
        ],
        0.6,
        16.5,
      ),
      ...facet(star(32, 8.2, 8.6, 3.7).slice(0, 6), 0.62, 8.6),
      ...facet(KNOT, 0.6, 36.5),
      ...facet(COLLAR, 0.7, 42),
    ],
  },
  // 6 뚜껑 단지
  {
    laurel: true,
    gem: 11.2,
    mark: { cy: 22.5, s: 0.66 },
    body: [
      ...handles([
        [43, 16],
        [49, 12.5],
        [52, 17],
        [48.5, 25],
        [44.5, 26.5],
        [45.5, 23.2],
        [48.6, 17.6],
        [46.5, 15.8],
        [44, 19],
      ]),
      ...facet(
        [
          [32, 14],
          [42.5, 15],
          [46, 20.5],
          [44.5, 27],
          [39, 31.5],
          [32, 32.5],
        ],
        0.8,
        23,
      ),
      ...facet(
        [
          [32, 7.5],
          [40.5, 9],
          [42.5, 14.4],
          [32, 14.4],
        ],
        0.7,
        11,
      ),
      ...facet(arc(5.4, 2.6, 6), 0.6, 5.4),
      ...stem(32),
    ],
  },
  // 7 축구공
  {
    laurel: true,
    gem: 36.5,
    mark: null,
    body: [
      ...flat([
        [32, 27],
        [39.5, 25.5],
        [41, 29],
        [35, 32.5],
        [32, 32.5],
      ]),
      ...facet(arc(16.5, 12.5), 0.84, 16.5),
      { d: poly(pentagon(32, 16.8, 4.6)), tone: 'rim' },
      ...[0, 1, 2, 3, 4].map((i): TrophyLayer => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        return {
          d: poly(
            pentagon(32 + 10.4 * Math.cos(a), 16.8 + 10.4 * Math.sin(a), 2.4, a + Math.PI / 2),
          ),
          tone: 'rim',
        };
      }),
      ...stem(32),
    ],
  },
  // 8 왕관 컵
  {
    laurel: true,
    gem: 27.2,
    mark: { cy: 19, s: 0.79 },
    body: [
      ...handles([
        [47, 12],
        [53, 11.5],
        [57.5, 14.5],
        [58, 21],
        [54.5, 27],
        [45, 31],
        [44.5, 28],
        [51.5, 24],
        [53.5, 20.5],
        [53, 16.5],
        [50.5, 15.5],
        [47.5, 16],
      ]),
      ...facet(
        [
          [32, 10],
          [47.5, 10],
          [46.5, 18],
          [42.5, 26],
          [36.5, 30.5],
          [32, 31],
        ],
        0.8,
        19,
      ),
      ...flat([
        [32, 1.8],
        [35.6, 8],
        [39.8, 2.6],
        [43.2, 8],
        [48.4, 3],
        [48.4, 10.6],
        [32, 10.6],
      ]),
      {
        d: poly(
          sym([
            [32, 8.6],
            [47.4, 8.6],
            [47.4, 10.6],
            [32, 10.6],
          ]),
        ),
        tone: 'light',
      },
      ...stem(30.5),
    ],
  },
  // 9 날개 컵
  {
    laurel: false,
    gem: 27.2,
    mark: { cy: 18.5, s: 0.92 },
    body: [
      ...handles([
        [46, 11],
        [55, 5],
        [61.5, 4],
        [59, 8.5],
        [62, 9.5],
        [58.5, 13.5],
        [61, 15],
        [56, 19],
        [57.5, 21],
        [51, 24],
        [45.5, 27],
      ]),
      { d: poly(flip(WING)), tone: 'light' },
      { d: poly(WING), tone: 'base' },
      ...facet(BOWL, 0.8, 18),
      ...facet(LIP, 0.6, 6.8),
      ...stem(32.5),
    ],
  },
  // 10 방패
  {
    laurel: true,
    gem: 27,
    mark: { cy: 15.5, s: 0.84 },
    body: [
      ...facet(
        [
          [32, 34],
          [34.5, 34],
          [34, 40.5],
          [32, 40.5],
        ],
        0.6,
        37,
      ),
      ...facet(
        [
          [32, 3.5],
          [39.5, 5.5],
          [47, 4.5],
          [47, 18],
          [44, 26.5],
          [38.5, 32.5],
          [32, 35.5],
        ],
        0.84,
        18.5,
      ),
      ...facet(COLLAR, 0.7, 42),
    ],
  },
];

/** 회차 보석(10회차마다 돈다): 밝은 면 · 어두운 면 · 빛. 리본도 같은 색이다. */
const GEMS: readonly (readonly [string, string, string])[] = [
  ['#3fd18a', '#17804c', '#b9f5d6'], // emerald
  ['#ef3b55', '#931428', '#ffc2cb'], // ruby
  ['#4a86ec', '#1c3f94', '#c7dcff'], // sapphire
  ['#a56cf0', '#5a2d96', '#e3ccff'], // amethyst
  ['#ff8a2a', '#a8440a', '#ffd7b0'], // orange topaz
  ['#43dcd4', '#138078', '#c4fbf7'], // aquamarine
  ['#ff62a8', '#a3245e', '#ffd0e5'], // pink sapphire
  ['#4a4a58', '#141418', '#c9c9d6'], // onyx
  ['#c2ec3f', '#6e9212', '#efffc0'], // peridot
  ['#eef8ff', '#8fb6d4', '#ffffff'], // diamond
];
/** 회차 → 모양·보석 자리(0~9). 회차를 모르면(0 이하) 제1회 모양. */
export const trophyVariant = (edition: number): number =>
  edition >= 1 ? (Math.floor(edition) - 1) % SHAPES.length : 0;

const BOW: Pt[] = [
  [32, 36.5],
  [37.5, 34],
  [38, 39],
  [32, 36.8],
];
const TAIL: Pt[] = [
  [33, 37],
  [36.4, 37.6],
  [39, 44.6],
  [37, 43.2],
  [35.4, 45],
];

function trophy(stage: TrophyStage, variant: number): TrophyLayer[] {
  const shape = SHAPES[variant]!;
  const gy = shape.gem;
  return [
    ...(stage === 'champion' && shape.laurel ? laurel() : []),
    ...shape.body,
    ...(shape.mark
      ? [{ d: poly(stageMark(stage, 32, shape.mark.cy, shape.mark.s)), tone: 'mark' as const }]
      : []),
    {
      d: poly([
        [32, gy - 4],
        [35.6, gy],
        [32, gy + 4],
        [28.4, gy],
      ]),
      tone: 'gemDark',
    },
    {
      d: poly([
        [32, gy - 4],
        [32, gy + 4],
        [28.4, gy],
      ]),
      tone: 'gem',
    },
    {
      d: poly([
        [30.3, gy - 1.8],
        [31.5, gy - 3],
        [31, gy - 0.4],
      ]),
      tone: 'gemShine',
    },
    { d: poly(sym(PLINTH)), tone: 'plinthLight', plinth: true },
    { d: poly(sym(PLINTH_FACE)), tone: 'plinth', plinth: true },
    { d: poly(sym(BAND)), tone: 'rim', plinth: true },
    { d: poly(leftHalf(BAND)), tone: 'base', plinth: true },
    // 리본은 줄기 매듭에 묶어 받침대 위로 늘어뜨린다.
    { d: poly(TAIL), tone: 'gemDark' },
    { d: poly(flip(TAIL)), tone: 'gem' },
    { d: poly(BOW), tone: 'gemDark' },
    { d: poly(flip(BOW)), tone: 'gem' },
  ];
}

const METAL: Record<TrophyStage, EmblemPalette> = {
  champion: EMBLEM_PALETTE.gold,
  runnerup: EMBLEM_PALETTE.silver,
  sf: EMBLEM_PALETTE.bronze,
};
/** 받침대는 브랜드 잉크(#0F2219), 새긴 이름은 라임(#D6F24A). */
const BRAND = { plinth: '#0F2219', plinthLight: '#3E6B4F', engrave: '#D6F24A' };

const cache = new Map<string, { layers: TrophyLayer[]; palette: TrophyPalette }>();
/** 단계·회차별 트로피 레이어(아래부터 그린다)와 색. 같은 단계·모양은 한 번만 만든다. */
export function cupTrophy(
  stage: TrophyStage,
  edition = 1,
): { layers: TrophyLayer[]; palette: TrophyPalette } {
  const variant = trophyVariant(edition);
  const key = `${stage}:${variant}`;
  let t = cache.get(key);
  if (!t) {
    const [gem, gemDark, gemShine] = GEMS[variant]!;
    cache.set(
      key,
      (t = {
        layers: trophy(stage, variant),
        palette: { ...METAL[stage], ...BRAND, gem, gemDark, gemShine },
      }),
    );
  }
  return t;
}

/** 트로피를 받는 단계(CUP_REWARDS)면 그 단계, 아니면 null(8강 이하는 기록 한 줄). */
export const trophyStage = (stage: CupStage): TrophyStage | null =>
  CUP_REWARDS[stage].trophy ? (stage as TrophyStage) : null;

/** 받침대에 새길 글자: 회차(T-11-253)와 구단주 닉네임, 닉네임이 없으면 시즌('S1'). */
export const plateText = (
  owner: string | null | undefined,
  season: number,
  edition?: number,
): string => {
  const who = owner?.trim() || `S${season}`;
  return edition ? `${L.plateEdition({ n: edition })} ${who}` : who;
};
