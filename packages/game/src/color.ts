// 색 계산(# 6자리 hex). 아바타·유니폼이 같이 쓴다.
export const hexRgb = (c: string) =>
  [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];

/** a에서 b로 t만큼 섞은 색. */
export function mix(a: string, b: string, t: number): string {
  const A = hexRgb(a);
  const B = hexRgb(b);
  return `#${A.map((v, i) =>
    Math.round(v + (B[i]! - v) * t)
      .toString(16)
      .padStart(2, '0'),
  ).join('')}`;
}

/** 상대 휘도(WCAG, 0~1). */
export function lum(c: string): number {
  const [r, g, b] = hexRgb(c).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** RGB 거리(0~441). */
export function dist(a: string, b: string): number {
  const A = hexRgb(a);
  const B = hexRgb(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

/** 도트 격자 한 칸 = 색 하나(빈 칸 null). 색마다 SVG path 하나로, 같은 색이 이어진 가로 칸은 한 조각으로 합친다. */
export interface PixelPath {
  fill: string;
  d: string;
}
export function pixelPaths(grid: readonly (readonly (string | null | undefined)[])[]): PixelPath[] {
  const byFill = new Map<string, string>();
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const c = row[x];
      let w = 1;
      while (x + w < row.length && row[x + w] === c) w++;
      if (c) byFill.set(c, `${byFill.get(c) ?? ''}M${x} ${y}h${w}v1h-${w}z`);
      x += w;
    }
  });
  return [...byFill].map(([fill, d]) => ({ fill, d }));
}
