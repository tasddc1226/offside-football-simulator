// T-11-819 서포터 휘장(별 방패) 그림 값. 웹 SupporterCrest.svelte · 앱 SupporterCrest.tsx가 같은 모양을 그린다.
// 방패 위 별 개수가 연속 구독 단계다(1 없음 · 3 하나 · 6 둘 · 9 셋). 색은 화면 테마와 상관없이 단계마다 고정이다.
import type { SupporterTier } from '@offside/contracts/membership';

export const CREST_VIEW = { w: 64, h: 62 } as const;

export type CrestPalette = {
  /** 방패 아래쪽 · 테두리 */
  base: string;
  /** 방패 위쪽 · 별 */
  light: string;
  /** 하트 · 안쪽 선 */
  ink: string;
  /** 바깥 테두리 */
  edge: string;
};

export const CREST_PALETTE: Record<SupporterTier, CrestPalette> = {
  1: { base: '#1e7a50', light: '#5fcf98', ink: '#ffffff', edge: '#14533a' },
  3: { base: '#1f63a8', light: '#7db6f0', ink: '#ffffff', edge: '#174a7d' },
  6: { base: '#7336b0', light: '#c29cf0', ink: '#ffffff', edge: '#542781' },
  9: { base: '#c98a0a', light: '#ffd66b', ink: '#6b4500', edge: '#6b4500' },
};

export const CREST_SHIELD = 'M32 12 L52 18.5 V34 C52 46 43.5 54 32 59 C20.5 54 12 46 12 34 V18.5 Z';
export const CREST_INNER =
  'M32 16.5 L48 21.6 V34 C48 43.5 41.4 50 32 54.4 C22.6 50 16 43.5 16 34 V21.6 Z';
export const CREST_HEART =
  'M32 46 C20 38 15 32 15 25.5 C15 21 18.5 17.5 23 17.5 C26.6 17.5 29.6 19.6 32 23 C34.4 19.6 37.4 17.5 41 17.5 C45.5 17.5 49 21 49 25.5 C49 32 44 38 32 46 Z';
/** 하트를 방패 안쪽 가운데로(웹 transform 속성 · 앱 transform 문자열 그대로). */
export const CREST_HEART_TRANSFORM = 'translate(7.02 7.56) scale(0.78)';

function starPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

const STAR_X: Record<SupporterTier, number[]> = { 1: [], 3: [32], 6: [25, 39], 9: [20, 32, 44] };

/** 방패 위 별(polygon points). 1단계는 없다. */
export const crestStars = (tier: SupporterTier) => STAR_X[tier].map((x) => starPoints(x, 6, 4.8));

/** 단계별 효과: 3 빛 훑기, 6 빛 + 빛무리, 9 금색 · 빛무리 · 반짝임 · 궤도. */
export const crestFx = (tier: SupporterTier) => ({
  shine: tier >= 3,
  halo: tier >= 6,
  spark: tier === 9,
  orbit: tier === 9,
});
