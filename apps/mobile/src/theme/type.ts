// T-11-005 글자 크기·서체. 웹은 html font-size 93.75%(=15px)를 1rem으로 두고 모든 크기를 rem으로 적었다 —
// 앱은 rem(n)으로 같은 값을 쓴다. 기기 글자 크기 설정은 RN Text가 알아서 따른다(allowFontScaling 기본값).
import type { TextStyle } from 'react-native';

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
