// T-11-004 웹 style.css의 색 토큰을 그대로 옮긴다(라이트/다크). 바꾸면 두 곳을 함께 고친다.
export const LIGHT = {
  bg: '#e9eee8',
  surface: '#ffffff',
  surface2: '#f3f6f2',
  ink: '#14201a',
  muted: '#5c6b62',
  line: '#d5ddd6',
  pitch: '#1c4a35',
  pitch2: '#245c43',
  chalk: 'rgba(255,255,255,0.22)',
  onPitch: '#f2f6f1',
  pitchAccent: '#f0b437',
  accent: '#d99a12',
  accentText: '#8a5c0a',
  accentInk: '#2a1c00',
  good: '#1e7a50',
  bad: '#c0392f',
  warn: '#96600a',
  /** 기본 엠블럼 바깥선(T-10-063). */
  crestHalo: 'rgba(20,32,26,0.16)',
  /** 탭바에서 고른 탭 색 — 라이트는 초록, 다크는 금색. */
  tabOn: '#1c4a35',
  /** 시트 뒤 어두운 막. */
  scrim: 'rgba(8,14,11,0.55)',
  /** 칭호 등급 색(웹 --r2 · --r3 · --r4) — 희귀·영웅·전설. 일반은 muted. */
  r2: '#1f63a8',
  r3: '#7336b0',
  r4: '#8a5c0a',
};
export const DARK: typeof LIGHT = {
  bg: '#0d1511',
  surface: '#152019',
  surface2: '#1a271f',
  ink: '#e6ede7',
  muted: '#8fa096',
  line: '#26352c',
  pitch: '#1a4331',
  pitch2: '#215540',
  chalk: 'rgba(255,255,255,0.22)',
  onPitch: '#eef4ef',
  pitchAccent: '#f0b437',
  accent: '#f0b437',
  accentText: '#f0b437',
  accentInk: '#231700',
  good: '#4cc08a',
  bad: '#ef6b5f',
  warn: '#e9a83a',
  crestHalo: 'rgba(238,244,239,0.3)',
  tabOn: '#f0b437',
  scrim: 'rgba(8,14,11,0.55)',
  r2: '#72b4f2',
  r3: '#c8a0f7',
  r4: '#f0b437',
};
export type Colors = typeof LIGHT;

/** 색에 투명도를 섞는다 — 웹 color-mix(in srgb, X N%, transparent) 자리. #rrggbb만 받는다. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** 두 색을 섞는다 — 웹 color-mix(in srgb, A N%, B) 자리. a가 t(0–1)만큼, 둘 다 #rrggbb. T-11-028 */
export function mix(a: string, b: string, t: number): string {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((x >> sh) & 255) * t + ((y >> sh) & 255) * (1 - t));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
