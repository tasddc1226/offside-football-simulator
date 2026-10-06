// T-11-128 시즌 휘장(구단주 티어 문장) — 가운데 둥근 자리에 프로필이 들어가고 양옆으로 날개가 펼쳐진다.
// 티어가 높을수록 날개 깃이 많고 길어지며, 골드부터 위 장식, 마스터부터 왕관 깃이 붙고 챌린저는 한 겹 더. 웹(TierCrest.svelte)과
// 앱(TierCrest.tsx)이 같은 좌표를 그린다. 좌표계 CREST_VIEWBOX(160×120), 프로필 자리 CREST_SLOT.
import { OWNER_TIERS, type OwnerTier } from '@offside/contracts/owner-tier';

export const CREST_VIEWBOX = '0 0 160 120';
/** 프로필이 들어가는 원(중심 · 반지름). */
export const CREST_SLOT = { cx: 80, cy: 60, r: 20 } as const;
/** 테두리 고리 바깥 반지름. */
const RING = 25;

/** 티어 색 — 금속 밝은 면 · 기본 · 어두운 면, 보석(가운데 빛). */
export const TIER_PALETTE: Record<
  OwnerTier,
  { hi: string; base: string; lo: string; gem: string }
> = {
  iron: { hi: '#a39a94', base: '#6f6762', lo: '#3a3532', gem: '#b9aea7' },
  bronze: { hi: '#e0a47a', base: '#a8663c', lo: '#5a3218', gem: '#f0b48a' },
  silver: { hi: '#e3ebf5', base: '#9aa8ba', lo: '#4c5767', gem: '#cfe0ff' },
  gold: { hi: '#ffe39a', base: '#d6a33f', lo: '#7a5414', gem: '#fff1b8' },
  platinum: { hi: '#a8f0e8', base: '#3fb5ad', lo: '#155a58', gem: '#c8fff6' },
  emerald: { hi: '#9ff5bf', base: '#27b862', lo: '#0c5a2c', gem: '#c6ffd9' },
  diamond: { hi: '#c4d0ff', base: '#5d78f2', lo: '#222f80', gem: '#e0e8ff' },
  master: { hi: '#f0c4ff', base: '#a64fe6', lo: '#4a1670', gem: '#f6dcff' },
  grandmaster: { hi: '#ffb59e', base: '#e0442f', lo: '#6a1408', gem: '#ffd2c2' },
  challenger: { hi: '#fff0b0', base: '#e2b04a', lo: '#6b4a10', gem: '#9fe8ff' },
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const rad = (deg: number) => (deg * Math.PI) / 180;
/** 수학 각도(위가 +)로 중심에서 d만큼. */
const at = (deg: number, d: number) => ({
  x: CREST_SLOT.cx + d * Math.cos(rad(deg)),
  y: CREST_SLOT.cy - d * Math.sin(rad(deg)),
});

/** 날개 깃 하나 — 고리에서 시작해 끝이 위로 휘는 칼날. */
function blade(deg: number, len: number, width: number, lift: number): string {
  const base = at(deg, RING - 3);
  const end = at(deg, RING + len);
  const tip = { x: end.x, y: end.y - lift };
  const n = { x: -Math.sin(rad(deg)), y: -Math.cos(rad(deg)) }; // 진행 방향의 수직(화면 좌표)
  const w = width / 2;
  const mid = { x: (base.x + tip.x) / 2, y: (base.y + tip.y) / 2 };
  const b1 = { x: base.x + n.x * w, y: base.y + n.y * w };
  const b2 = { x: base.x - n.x * w, y: base.y - n.y * w };
  const c1 = { x: mid.x + n.x * w * 1.4, y: mid.y + n.y * w * 1.4 - lift * 0.4 };
  const c2 = { x: mid.x - n.x * w * 0.3, y: mid.y - n.y * w * 0.3 };
  return `M${r1(b1.x)} ${r1(b1.y)} Q${r1(c1.x)} ${r1(c1.y)} ${r1(tip.x)} ${r1(tip.y)} Q${r1(c2.x)} ${r1(c2.y)} ${r1(b2.x)} ${r1(b2.y)}Z`;
}

/** 좌우 대칭 — 왼쪽 깃의 각도(90~270)를 오른쪽으로 비춘다. */
const pair = (deg: number, len: number, width: number, lift: number) =>
  blade(deg, len, width, lift) + blade(180 - deg, len, width, lift);

export type CrestShape = {
  /** 날개(뒤 · 앞 두 겹 — 뒤가 어둡다). */
  wingsBack: string;
  wingsFront: string;
  /** 위 장식(골드부터) · 왕관 깃(마스터부터). */
  crown: string;
  /** 아래 보석. */
  gem: string;
};

/** 티어 단계(아이언 0 … 챌린저 9). */
export const tierLevel = (tier: OwnerTier) => OWNER_TIERS.length - 1 - OWNER_TIERS.indexOf(tier);

const cache = new Map<OwnerTier, CrestShape>();

export function crestShape(tier: OwnerTier): CrestShape {
  const hit = cache.get(tier);
  if (hit) return hit;
  const lv = tierLevel(tier);
  const feathers = 3 + Math.floor(lv / 2); // 3 … 7
  const top = 148 - lv * 1.5; // 가장 위 깃 각도(높을수록 더 위로 솟는다)
  const bottom = 200;
  let front = '';
  let back = '';
  for (let i = 0; i < feathers; i++) {
    const t = feathers === 1 ? 0 : i / (feathers - 1);
    const deg = top + (bottom - top) * t;
    const len = (30 + lv * 3.2) * (1 - t * 0.5);
    const width = 11 - t * 4;
    const lift = (12 + lv * 1.6) * (1 - t * 0.8);
    front += pair(deg, len, width, lift);
    back += pair(deg + 6, len * 0.85, width * 0.9, lift * 0.8);
  }
  // 아래 V자 턱(문장 아래가 뾰족하게 모인다).
  front += pair(242, 12 + lv * 0.8, 9, -2);
  back += pair(228, 14 + lv, 8, 0);
  let crown = '';
  if (lv >= 3) crown += pair(110, 7 + lv * 0.9, 7, 0) + blade(90, 9 + lv * 1.3, 8, 0);
  if (lv >= 7) crown += pair(126, 12 + lv, 6, 5);
  if (lv >= 9) crown += pair(98, 16, 5, 0);
  const g = at(270, RING + 2);
  const s = 4 + lv * 0.35;
  const gem = `M${r1(g.x)} ${r1(g.y - s)} L${r1(g.x + s * 0.8)} ${r1(g.y)} L${r1(g.x)} ${r1(g.y + s * 1.3)} L${r1(g.x - s * 0.8)} ${r1(g.y)}Z`;
  const shape = { wingsBack: back, wingsFront: front, crown, gem };
  cache.set(tier, shape);
  return shape;
}

/** 고리(프로필 둘레) — 바깥 · 안 반지름. */
export const CREST_RING = { outer: RING, inner: CREST_SLOT.r + 1 } as const;
