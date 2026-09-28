import { clubById } from '../game/clubs.js';
import { crestOf } from '../game/crests.js';

const rgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [n >> 16, (n >> 8) & 255, n & 255] as const;
};
/** 밝은 유니폼이면 등번호를 어둡게. */
const light = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
};
/** 두 색이 눈으로 잘 구분되지 않을 만큼 가까운가. */
const near = (a: string, b: string) => {
  const [x, y] = [rgb(a), rgb(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 90;
};

export interface RnColors {
  base: string;
  accent: string;
  /** 등번호·이름 색. */
  ink: string;
  /** 깃·소매 띠·번호 테두리. */
  trim: string;
}
/** 모르는 구단의 결번 유니폼 색(CSS 기본값과 같다). */
export const RN_DEFAULT: RnColors = {
  base: '#1f6f4a',
  accent: '#f2c14e',
  ink: '#ffffff',
  trim: '#f2c14e',
};

/** T-10-076 결번 유니폼 색(구단 엠블럼 색). 모르는 구단이면 null. */
export function rnColors(clubId: string | undefined): RnColors | null {
  const club = clubId ? clubById(clubId) : null;
  if (!club) return null;
  const { base, accent } = crestOf(club);
  const ink = light(base) ? '#111a14' : '#ffffff';
  // 강조색이 바탕과 비슷하면(단색 엠블럼) 깃·소매 띠·번호 테두리는 등번호 색으로.
  return { base, accent, ink, trim: near(base, accent) ? ink : accent };
}

/** 결번 유니폼 색 — style 속성 문자열. 모르는 구단이면 ''(기본 색). */
export function rnStyle(clubId: string | undefined): string {
  const c = rnColors(clubId);
  return c
    ? `--rn-base:${c.base};--rn-accent:${c.accent};--rn-ink:${c.ink};--rn-trim:${c.trim}`
    : '';
}

/**
 * 입체 결번 유니폼(등 쪽, viewBox 0 0 120 124) 도안. 은퇴 세리머니(RnJersey.svelte, SVG)와 공유 이미지(캔버스)가 같이 쓴다.
 * 주름 w·o는 선 굵기·불투명도(흐리게 그린다), 이름은 arc 곡선(M x0 y0 Q 60 yc x1 y0)을 따라 휜다.
 */
export const JERSEY = {
  shirt:
    'M42 7 C36 8 28 10 22 13 C15 20 9 27 4 35 L17 49 L28 41 C28.5 66 28 92 27 116 Q60 121 93 116 C92 92 91.5 66 92 41 L103 49 L116 35 C111 27 105 20 98 13 C92 10 84 8 78 7 Q60 21 42 7 Z',
  /** 몸통보다 뒤로 물러난 소매(검정, 불투명도). */
  sleeves: [
    { d: 'M22 13 C15 20 9 27 4 35 L17 49 L28 41 C27 30 25 20 22 13 Z', o: 0.2 },
    { d: 'M98 13 C105 20 111 27 116 35 L103 49 L92 41 C93 30 95 20 98 13 Z', o: 0.26 },
  ],
  cuffs: ['M4 35 L17 49 L19.4 46.2 L6.4 32.2 Z', 'M116 35 L103 49 L100.6 46.2 L113.6 32.2 Z'],
  /** 몸통 원통 음영(가로)·위 빛/아래 그림자(세로): [위치, 흰색이면 +불투명도 / 검정이면 -불투명도]. */
  bodyShade: [
    [0, -0.5],
    [0.22, -0.12],
    [0.42, 0.16],
    [0.6, 0.03],
    [0.82, -0.16],
    [1, -0.5],
  ],
  vertShade: [
    [0, 0.14],
    [0.3, 0],
    [0.82, 0],
    [1, -0.32],
  ],
  folds: [
    { d: 'M37 54 Q43 80 38 114', o: -0.24, w: 3 },
    { d: 'M41 56 Q47 82 43 114', o: 0.12, w: 2 },
    { d: 'M84 58 Q78 84 83 114', o: -0.22, w: 3 },
    { d: 'M29 44 Q35 50 34 62', o: -0.3, w: 2.4 },
    { d: 'M91 44 Q85 50 86 62', o: -0.3, w: 2.4 },
    { d: 'M58 100 Q62 108 60 118', o: -0.14, w: 2.4 },
  ],
  seams: ['M22 13 C25 20 27 30 28 41', 'M98 13 C95 20 93 30 92 41'],
  stitches: ['M23.3 13.2 C26.2 20 28.2 30 29.2 40.5', 'M96.7 13.2 C93.8 20 91.8 30 90.8 40.5'],
  collarInside: 'M42 7 Q60 2 78 7 Q60 14 42 7 Z',
  collar: 'M42 7 Q60 14 78 7 L77.2 10.2 Q60 18 42.8 10.2 Z',
  arc: { x0: 30, x1: 90, y0: 43, yc: 33 },
  numberY: 94,
} as const;

/** 결번 유니폼 윤곽·깃(viewBox 0 0 120 124). 은퇴 세리머니와 영구결번 알림이 같이 쓴다. */
export const RN_SHIRT =
  'M40 6 L22 12 L4 34 L18 48 L28 40 L28 118 L92 118 L92 40 L102 48 L116 34 L98 12 L80 6 Q60 20 40 6 Z';
export const RN_TRIM = 'M40 6 Q60 20 80 6';
