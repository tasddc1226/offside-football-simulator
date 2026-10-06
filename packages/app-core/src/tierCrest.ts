// T-11-128 시즌 휘장(구단주 티어 문장) — LoL 시즌 테두리처럼 가운데 고리에 프로필이 들어가고, 티어마다 다른 장식이 둘러싼다.
//   아이언 각진 조각 · 브론즈 뿔 · 실버 작은 날개 · 골드 날개 + 관 · 플래티넘 날개 + 칼날 · 에메랄드 잎 날개
//   다이아몬드 수정 · 마스터 큰 날개 + 보석 관 · 그랜드마스터 가시 · 챌린저 큰 두 겹 날개 + 높은 관
// 모두 아래에 받침판(보석은 골드부터)이 붙는다. 웹(TierCrest.svelte)과 앱(TierCrest.tsx)이 같은 조각을 그린다.
// 좌표계 CREST_VIEWBOX(160×128), 프로필 자리 CREST_SLOT. 조각은 오른쪽 기준으로 만들고 왼쪽은 비춘다.
import { OWNER_TIERS, type OwnerTier } from '@offside/contracts/owner-tier';

export const CREST_VIEWBOX = '0 0 160 128';
/** 프로필이 들어가는 원(중심 · 반지름). */
export const CREST_SLOT = { cx: 80, cy: 62, r: 28 } as const;
/** 고리 바깥 반지름. */
const R = 33;
/** 장식 길이 배율 — 티어가 높을수록 장식이 크게 뻗는다(crestShape가 티어마다 정한다). */
let K = 0.72;
/** 고리(프로필 둘레) — 바깥 · 안 반지름. */
export const CREST_RING = { outer: R, inner: CREST_SLOT.r + 1 } as const;

/** 티어 색 — 금속 밝은 면 · 기본 · 어두운 면, 보석. */
export const TIER_PALETTE: Record<
  OwnerTier,
  { hi: string; base: string; lo: string; gem: string }
> = {
  iron: { hi: '#b3aba5', base: '#6f6762', lo: '#2f2a27', gem: '#c9bfb8' },
  bronze: { hi: '#f0b48a', base: '#a8663c', lo: '#4a2810', gem: '#ffc9a0' },
  silver: { hi: '#f0f5fb', base: '#9aa8ba', lo: '#3f4958', gem: '#d8e6ff' },
  gold: { hi: '#fff0b8', base: '#d6a33f', lo: '#6a4810', gem: '#ffe680' },
  platinum: { hi: '#c4fff6', base: '#3fb5ad', lo: '#0f4a48', gem: '#9ffff0' },
  emerald: { hi: '#b8ffd2', base: '#27b862', lo: '#0a4a24', gem: '#7dffb0' },
  diamond: { hi: '#dfe6ff', base: '#5d78f2', lo: '#1a2470', gem: '#bfe4ff' },
  master: { hi: '#f6dcff', base: '#a64fe6', lo: '#3e1060', gem: '#ff9cf0' },
  grandmaster: { hi: '#ffcbb8', base: '#d8392a', lo: '#560e06', gem: '#ffb070' },
  challenger: { hi: '#fff6c8', base: '#e2b04a', lo: '#5e400c', gem: '#7fe6ff' },
};

/** 조각 하나 — back은 어두운 금속(뒤 겹), metal은 금속 그라디언트, gem은 보석. */
export type CrestPart = { d: string; kind: 'back' | 'metal' | 'gem' };
/** under는 고리 뒤, over는 고리 위(보석 · 관 장식). */
export type CrestShape = { under: CrestPart[]; over: CrestPart[] };

type Pt = { x: number; y: number };
const { cx, cy } = CREST_SLOT;
const f = (n: number) => Math.round(n * 10) / 10;
const rad = (deg: number) => (deg * Math.PI) / 180;
/** 오른쪽(side 1) · 왼쪽(side -1)에서 수학 각도(위가 +)로 중심에서 d만큼. */
const at = (deg: number, d: number, side = 1): Pt => ({
  x: cx + side * d * Math.cos(rad(deg)),
  y: cy - d * Math.sin(rad(deg)),
});
const poly = (pts: Pt[]) => `M${pts.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L')}Z`;
const both = (make: (side: 1 | -1) => string) => make(1) + make(-1);

/** 날개 깃 — 뿌리에서 끝이 위로 휘는 칼날. */
function feather(side: 1 | -1, deg: number, len: number, w: number, curl: number): string {
  const base = at(deg, R - 3, side);
  const end = at(deg, R - 3 + len * K, side);
  const tip = { x: end.x, y: end.y - curl * K };
  const n = { x: -Math.sin(rad(deg)) * side, y: -Math.cos(rad(deg)) };
  const m = { x: (base.x + tip.x) / 2, y: (base.y + tip.y) / 2 - curl * 0.35 };
  const h = w / 2;
  return (
    `M${f(base.x + n.x * h)} ${f(base.y + n.y * h)}` +
    ` Q${f(m.x + n.x * w)} ${f(m.y + n.y * w)} ${f(tip.x)} ${f(tip.y)}` +
    ` Q${f(m.x - n.x * w * 0.35)} ${f(m.y - n.y * w * 0.35)} ${f(base.x - n.x * h)} ${f(base.y - n.y * h)}Z`
  );
}

/** 날개 — 깃 n개를 위(a0)에서 아래(a1)로 부채꼴. 길이 · 폭 · 휨은 위에서 아래로 줄어든다. */
function wing(
  o: {
    n: number;
    a0: number;
    a1: number;
    len: [number, number];
    w: [number, number];
    curl: [number, number];
  },
  kind: 'metal' | 'back' = 'metal',
  grow = 1,
): CrestPart {
  let d = '';
  for (let i = 0; i < o.n; i++) {
    const t = o.n === 1 ? 0 : i / (o.n - 1);
    const lerp = ([a, b]: [number, number]) => a + (b - a) * t;
    const deg = o.a0 + (o.a1 - o.a0) * t + (kind === 'back' ? 6 : 0);
    d += both((s) => feather(s, deg, lerp(o.len) * grow, lerp(o.w), lerp(o.curl)));
  }
  return { d, kind };
}

/** 각진 조각(수정 · 가시) — 고리에서 deg 방향으로 len, 폭 w. bend는 끝을 위로 들어 올린다. */
function shard(side: 1 | -1, deg: number, len: number, w: number, bend = 0, from = R - 3): string {
  const b = at(deg, from, side);
  const n = { x: -Math.sin(rad(deg)) * side, y: -Math.cos(rad(deg)) };
  const sh = at(deg, from + len * K * 0.4, side);
  const tip = at(deg, from + len * K, side);
  bend *= K;
  return poly([
    { x: b.x + (n.x * w) / 2, y: b.y + (n.y * w) / 2 },
    { x: sh.x + n.x * w * 0.6, y: sh.y + n.y * w * 0.6 - bend * 0.4 },
    { x: tip.x, y: tip.y - bend },
    { x: sh.x - n.x * w * 0.6, y: sh.y - n.y * w * 0.6 - bend * 0.4 },
    { x: b.x - (n.x * w) / 2, y: b.y - (n.y * w) / 2 },
  ]);
}
const shards = (
  list: [number, number, number, number?][],
  kind: CrestPart['kind'] = 'metal',
): CrestPart => ({
  d: list.map(([deg, len, w, bend]) => both((s) => shard(s, deg, len, w, bend))).join(''),
  kind,
});

/** 뿔 — 고리 옆에서 바깥 위로 휘어 오른다. */
function horn(side: 1 | -1, reach: number, rise: number): string {
  const X = (x: number) => cx + side * x;
  const out = R + (reach - 25) * K;
  const up = R * 0.9 + (rise - 25) * K;
  return (
    `M${f(X(R * 0.7))} ${f(cy - R * 0.72)} Q${f(X(out - 6))} ${f(cy - R * 0.64)} ${f(X(out))} ${f(cy - up)}` +
    ` Q${f(X(out + 4))} ${f(cy - 2)} ${f(X(R * 0.96))} ${f(cy + 5)}Z`
  );
}

/** 위 관 — 고리 위에서 솟는 뾰족한 살. heights는 왼쪽부터, spread는 양 끝 살 사이 각도. */
function crown(heights: number[], spread: number, w: number): CrestPart {
  const k = heights.length;
  const d = heights
    .map((h, i) => shard(1, 90 + spread * (0.5 - (k === 1 ? 0.5 : i / (k - 1))), h, w, 0, R - 4))
    .join('');
  return { d, kind: 'metal' };
}

/** 보석 마름모. */
const gem = (p: Pt, s: number): string =>
  poly([
    { x: p.x, y: p.y - s * 1.2 },
    { x: p.x + s * 0.8, y: p.y },
    { x: p.x, y: p.y + s * 1.2 },
    { x: p.x - s * 0.8, y: p.y },
  ]);

/** 아래 받침판 — 고리 아래로 뾰족하게. */
function plaque(w0: number, h: number): CrestPart {
  const top = cy + R - 8;
  const w = w0 * 1.25;
  return {
    d: poly([
      { x: cx - w, y: top },
      { x: cx + w, y: top },
      { x: cx + w * 0.75, y: top + h * 0.6 },
      { x: cx, y: top + h },
      { x: cx - w * 0.75, y: top + h * 0.6 },
    ]),
    kind: 'metal',
  };
}
const plaqueGem = (h: number, s: number): CrestPart => ({
  d: gem({ x: cx, y: cy + R - 8 + h * 0.52 }, s),
  kind: 'gem',
});
/** 관 꼭대기 보석(고리 위). */
const topGem = (y: number, s: number): CrestPart => ({ d: gem({ x: cx, y }, s), kind: 'gem' });
/** 양옆 날개 뿌리 보석. */
const sideGems = (deg: number, d: number, s: number): CrestPart => ({
  d: both((side) => gem(at(deg, d, side), s)),
  kind: 'gem',
});

const SHAPES: Record<OwnerTier, () => CrestShape> = {
  iron: () => ({
    under: [
      shards([
        [8, 13, 8],
        [-16, 10, 7],
        [32, 8, 6],
      ]),
      plaque(9, 11),
    ],
    over: [],
  }),
  bronze: () => ({
    under: [
      { d: both((s) => horn(s, 44, 40)), kind: 'metal' },
      shards([[-14, 11, 7]]),
      plaque(10, 13),
    ],
    over: [],
  }),
  silver: () => ({
    under: [
      wing({ n: 3, a0: 32, a1: -8, len: [28, 16], w: [10, 7], curl: [9, 2] }, 'back', 1.1),
      wing({ n: 3, a0: 32, a1: -8, len: [28, 16], w: [10, 7], curl: [9, 2] }),
      crown([9], 0, 8),
      plaque(11, 14),
    ],
    over: [],
  }),
  gold: () => ({
    under: [
      wing({ n: 4, a0: 38, a1: -14, len: [34, 16], w: [11, 7], curl: [12, 2] }, 'back', 1.1),
      wing({ n: 4, a0: 38, a1: -14, len: [34, 16], w: [11, 7], curl: [12, 2] }),
      crown([8, 13, 8], 44, 8),
      plaque(12, 16),
    ],
    over: [plaqueGem(16, 3.6)],
  }),
  platinum: () => ({
    under: [
      shards(
        [
          [-30, 26, 6],
          [-46, 18, 5],
        ],
        'back',
      ),
      wing({ n: 4, a0: 40, a1: -10, len: [38, 18], w: [11, 7], curl: [13, 2] }, 'back', 1.1),
      wing({ n: 4, a0: 40, a1: -10, len: [38, 18], w: [11, 7], curl: [13, 2] }),
      crown([9, 15, 9], 46, 8),
      plaque(12, 17),
    ],
    over: [topGem(cy - R - 6, 3.6), plaqueGem(17, 3.8)],
  }),
  emerald: () => ({
    under: [
      wing({ n: 3, a0: -22, a1: -44, len: [22, 14], w: [12, 9], curl: [-4, -6] }, 'back'),
      wing({ n: 5, a0: 44, a1: -12, len: [40, 18], w: [14, 9], curl: [12, 2] }, 'back', 1.1),
      wing({ n: 5, a0: 44, a1: -12, len: [40, 18], w: [14, 9], curl: [12, 2] }),
      crown([10, 16, 10], 48, 9),
      plaque(13, 17),
    ],
    over: [topGem(cy - R - 7, 4), plaqueGem(17, 3.8), sideGems(10, R + 4, 2.6)],
  }),
  diamond: () => ({
    under: [
      wing({ n: 3, a0: 30, a1: -16, len: [30, 18], w: [10, 7], curl: [8, 2] }, 'back', 1.2),
      shards(
        [
          [34, 30, 11, 4],
          [12, 36, 12, 3],
          [-10, 28, 11],
          [-30, 18, 9],
        ],
        'gem',
      ),
      crown([12, 20, 12], 50, 10),
      plaque(13, 18),
    ],
    over: [topGem(cy - R - 9, 4.6), plaqueGem(18, 4)],
  }),
  master: () => ({
    under: [
      wing({ n: 6, a0: 46, a1: -18, len: [44, 18], w: [12, 7], curl: [15, 2] }, 'back', 1.1),
      wing({ n: 6, a0: 46, a1: -18, len: [44, 18], w: [12, 7], curl: [15, 2] }),
      crown([9, 14, 19, 14, 9], 70, 8),
      plaque(14, 19),
    ],
    over: [topGem(cy - R - 9, 4.4), plaqueGem(19, 4.2), sideGems(14, R + 5, 3)],
  }),
  grandmaster: () => ({
    under: [
      shards(
        [
          [56, 30, 8, 8],
          [30, 42, 9, 12],
          [6, 40, 9, 8],
          [-18, 30, 8, 2],
          [-38, 18, 7],
        ],
        'back',
      ),
      shards([
        [44, 32, 8, 10],
        [18, 40, 9, 10],
        [-6, 32, 8, 4],
      ]),
      { d: both((s) => horn(s, 48, 46)), kind: 'metal' },
      crown([10, 15, 21, 15, 10], 72, 6),
      plaque(14, 20),
    ],
    over: [topGem(cy - R - 8, 4.2), plaqueGem(20, 4.4)],
  }),
  challenger: () => ({
    under: [
      wing({ n: 3, a0: -24, a1: -46, len: [26, 16], w: [11, 8], curl: [-4, -6] }, 'back'),
      wing({ n: 7, a0: 48, a1: -18, len: [50, 20], w: [12, 7], curl: [14, 2] }, 'back', 1.12),
      wing({ n: 7, a0: 48, a1: -18, len: [50, 20], w: [12, 7], curl: [14, 2] }),
      crown([11, 17, 24, 17, 11], 74, 8),
      plaque(15, 21),
    ],
    over: [
      topGem(cy - R - 11, 5),
      plaqueGem(21, 4.6),
      sideGems(16, R + 5, 3.2),
      sideGems(52, R + 4, 2.4),
    ],
  }),
};

const cache = new Map<OwnerTier, CrestShape>();
export function crestShape(tier: OwnerTier): CrestShape {
  let s = cache.get(tier);
  if (!s) {
    K = 0.64 + (OWNER_TIERS.length - 1 - OWNER_TIERS.indexOf(tier)) * 0.026; // 아이언 0.64 … 챌린저 0.874
    cache.set(tier, (s = SHAPES[tier]()));
  }
  return s;
}
