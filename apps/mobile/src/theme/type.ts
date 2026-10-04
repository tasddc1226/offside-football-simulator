// T-11-005 글자 크기·서체. 웹은 html font-size 93.75%(=15px)를 1rem으로 두고 모든 크기를 rem으로 적었다 —
// 앱은 rem(n)으로 같은 값을 쓴다. 기기 글자 크기 설정은 RN Text가 알아서 따른다(allowFontScaling 기본값).
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

export const REM = 15;
export const rem = (n: number) => Math.round(n * REM * 100) / 100;

/** 숫자·영문 제목 서체(웹 --display: Barlow Condensed). 한글은 시스템 서체로 떨어진다. */
export const DISPLAY = {
  400: 'BarlowCondensed_400Regular',
  500: 'BarlowCondensed_500Medium',
  600: 'BarlowCondensed_600SemiBold',
  700: 'BarlowCondensed_700Bold',
  800: 'BarlowCondensed_800ExtraBold',
} as const;

/** 웹 .num — 숫자 서체 + 고정폭 숫자. */
export const num = (weight: keyof typeof DISPLAY = 700): TextStyle => ({
  fontFamily: DISPLAY[weight],
  fontVariant: ['tabular-nums'],
});

/** 서체 본래 줄 높이(글자 크기 대비) — Barlow Condensed(ascent 1000 · descent 200 / 1000)와 한글 시스템 서체가 1.2쯤이다. */
export const MIN_LINE = 1.2;
const marginOf = (f: TextStyle, side: 'marginTop' | 'marginBottom'): number => {
  const m = f[side] ?? f.marginVertical ?? f.margin ?? 0;
  return typeof m === 'number' ? m : 0;
};
/**
 * 줄 높이가 서체 본래 높이보다 작으면 웹은 위아래로 고르게 넘쳐 그리지만, 앱은 줄 상자 위쪽을 줄인다 — 안드로이드는
 * 글자 윗부분이 잘리고(CustomLineHeightSpan이 ascent를 깎는다), iOS는 글자가 위로 밀려 올라가 한 줄 제한·잘라 내는
 * 부모 안에서 윗부분이 잘린다. 웹을 따라 촘촘하게 준 줄 높이(큰 숫자 1.0배, 제목 1.1배 등)는 MIN_LINE배로 올리고,
 * 늘어난 만큼 위아래 음수 여백으로 덮어 상자 크기·배치는 그대로 둔다(글자는 웹처럼 상자 가운데). Txt·FText와 Text를
 * 직접 쓰는 곳이 거친다.
 */
export function fitLine<S extends TextStyle>(style: StyleProp<S>): StyleProp<S> {
  const f = StyleSheet.flatten(style) as TextStyle | undefined;
  const size = f?.fontSize;
  const lh = f?.lineHeight;
  if (!f || size == null || lh == null || lh >= size * MIN_LINE) return style;
  const fit = size * MIN_LINE;
  const pad = (fit - lh) / 2;
  return [
    style,
    {
      lineHeight: fit,
      marginTop: marginOf(f, 'marginTop') - pad,
      marginBottom: marginOf(f, 'marginBottom') - pad,
    } as S,
  ];
}

/** 웹 h1·h2·.eyebrow 등 자주 쓰는 글자 모양. */
export const T = {
  body: { fontSize: rem(1), lineHeight: rem(1) * 1.55 },
  h1: {
    fontSize: rem(1.625),
    lineHeight: rem(1.625) * 1.25,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: rem(1.1875),
    lineHeight: rem(1.1875) * 1.35,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  h3: { fontSize: rem(1.0625), lineHeight: rem(1.0625) * 1.4, fontWeight: '700' },
  sm: { fontSize: rem(0.8125), lineHeight: rem(0.8125) * 1.5 },
  xs: { fontSize: rem(0.75), lineHeight: rem(0.75) * 1.5 },
  eyebrow: {
    fontFamily: DISPLAY[600],
    fontSize: rem(0.75),
    letterSpacing: rem(0.75) * 0.16,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;
