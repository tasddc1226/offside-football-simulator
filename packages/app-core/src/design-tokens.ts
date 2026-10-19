// T-11-396 디자인 토큰 정본. 웹(apps/web/src/tokens.css, design-tokens.test.ts가 만든다)과 앱(apps/mobile/src/theme)이
// 이 파일 하나를 따른다. 색은 OFFSIDE 팔레트(잔디 · 금색) 그대로, 쓰는 규칙은 docs/operations/design-system.md.
// 값을 바꾸면 `-u`로 tokens.css를 다시 만든다.

export const LIGHT = {
  bg: '#e9eee8',
  surface: '#ffffff',
  /** 카드 안 칸 · 입력 칸 · 막대 바탕. */
  surface2: '#f3f6f2',
  ink: '#14201a',
  muted: '#5c6b62',
  /** 가장 흐린 글자(자리 표시 · 비활성). 본문에는 쓰지 않는다. */
  faint: '#8d9a92',
  line: '#d5ddd6',
  /** 주요 동작(.btn-primary) · 그라운드 면. 화면마다 채운 버튼은 하나만. */
  pitch: '#1c4a35',
  pitch2: '#245c43',
  chalk: 'rgba(255,255,255,0.22)',
  onPitch: '#f2f6f1',
  /** 초록 그라운드 위 금색 글자 — 두 테마 모두 대비 4.5:1 이상. */
  pitchAccent: '#f0b437',
  /** 강조 · 선택 · 진행 막대 · 보상. */
  accent: '#d99a12',
  accentText: '#8a5c0a',
  /** accent 위 글자. */
  accentInk: '#2a1c00',
  good: '#1e7a50',
  bad: '#c0392f',
  warn: '#96600a',
  /** 시세 오름 · 내림(국내 증권 관례: 빨강 · 파랑). */
  up: '#c0392f',
  down: '#1f63a8',
  /** 기본 엠블럼 바깥선(T-10-063). */
  crestHalo: 'rgba(20,32,26,0.16)',
  /** 탭바에서 고른 탭 — 라이트는 초록, 다크는 금색. */
  tabOn: '#1c4a35',
  /** 시트 뒤 어두운 막. */
  scrim: 'rgba(8,14,11,0.55)',
  /** 칭호 등급 색 — 희귀 · 영웅 · 전설. 일반은 muted. */
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
  faint: '#617168',
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
  up: '#ef6b5f',
  down: '#72b4f2',
  crestHalo: 'rgba(238,244,239,0.3)',
  tabOn: '#f0b437',
  scrim: 'rgba(8,14,11,0.55)',
  r2: '#72b4f2',
  r3: '#c8a0f7',
  r4: '#f0b437',
};
export type Colors = typeof LIGHT;

/** 모서리 반경(px). 카드는 lg, 버튼 · 입력은 md, 칩은 pill. */
export const RADIUS = { xs: 6, sm: 10, md: 14, lg: 20, pill: 999 } as const;

/** 간격(px). 4의 배수만 쓴다. */
export const SPACE = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32 } as const;

/** 글자 크기(rem, 1rem = 15px). 화면 하나에 세 단계 안팎만 섞는다. 2rem이 넘는 큰 숫자(OVR 등)는 화면마다 정한다. */
export const FONT = {
  /** 보조 표시 · 탭 이름 */
  caption2: 0.6875,
  /** 보조 설명 · 칩 */
  caption: 0.75,
  /** 작은 본문 · 목록 보조 줄 */
  label: 0.8125,
  /** 목록 본문 · 작은 버튼 */
  body2: 0.875,
  /** 버튼 · 강조 본문 */
  body1: 0.9375,
  /** 본문 */
  body: 1,
  /** 카드 제목(h3) */
  title3: 1.125,
  /** 화면 부제목(h2) */
  title2: 1.25,
  /** 화면 제목(h1) */
  title1: 1.625,
  display: 2.25,
} as const;

/** surface2 → surface-2, onPitch → on-pitch. r2처럼 한 글자 뒤 숫자는 그대로(웹 --r2). */
const kebab = (k: string) =>
  k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/([a-z]{2,})(\d)/, '$1-$2');
const vars = (c: Colors, indent: string) =>
  Object.entries(c)
    .map(([k, v]) => `${indent}--${kebab(k)}: ${v};`)
    .join('\n');

/** 그림자 — 라이트는 흰 카드가 회색 바탕에서 떠 보일 만큼만, 다크는 쓰지 않는다. */
const SHADOW = {
  light: '0 1px 2px rgba(20, 32, 26, 0.05)',
  dark: 'none',
};

/** 웹 tokens.css 본문. 다크는 시스템 설정(고르지 않았을 때)과 data-theme='dark' 두 갈래에 같은 값을 넣는다. */
export function tokensCss(): string {
  const dark = (indent: string) =>
    [`${indent}color-scheme: dark;`, vars(DARK, indent), `${indent}--shadow: ${SHADOW.dark};`].join(
      '\n',
    );
  const scale = [
    ...Object.entries(RADIUS).map(([k, v]) => `  --radius-${k}: ${v}px;`),
    ...Object.entries(SPACE).map(([k, v]) => `  --space-${k}: ${v}px;`),
    ...Object.entries(FONT).map(([k, v]) => `  --fs-${k}: ${v}rem;`),
  ].join('\n');
  return `/* T-11-396 packages/app-core/src/design-tokens.ts가 만든 파일이에요. 손으로 고치지 말고 그 파일을 고친 뒤
   pnpm --filter @offside/app-core exec vitest run design-tokens -u 로 다시 만들어요. */
:root {
${vars(LIGHT, '  ')}
  --shadow: ${SHADOW.light};
${scale}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${dark('    ')}
  }
}
:root[data-theme='dark'] {
${dark('  ')}
}
`;
}
