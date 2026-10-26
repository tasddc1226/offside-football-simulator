// T-11-396 색 토큰 정본은 @offside/app-core/design-tokens(웹 tokens.css도 같은 파일에서 만든다).
export { DARK, LIGHT, type Colors } from '@offside/app-core/design-tokens';

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
