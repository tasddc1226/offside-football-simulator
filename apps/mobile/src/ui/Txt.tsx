// 글자 한 벌(웹 body·h1·h2·.muted·.num·.eyebrow 자리). 색은 테마를 따르고, style로 덮어쓸 수 있다.
import { Children, type ReactNode } from 'react';
import { Platform, Text, type TextProps, type TextStyle } from 'react-native';
import { getLocale } from '@offside/app-core/i18n/core';
import { useTextStyle } from '../theme/useTextSize';
import { useColors } from '../theme/useColors';
import { fitLine, num as numStyle, rem, T } from '../theme/type';
import type { Colors } from '../theme/colors';

type Variant = keyof typeof T;
type Tone = 'ink' | 'muted' | 'good' | 'bad' | 'warn' | 'accent' | 'onPitch' | 'pitchAccent';

const TONE: Record<Tone, keyof Colors> = {
  ink: 'ink',
  muted: 'muted',
  good: 'good',
  bad: 'bad',
  warn: 'warn',
  accent: 'accentText',
  onPitch: 'onPitch',
  pitchAccent: 'pitchAccent',
};

export interface TxtProps extends TextProps {
  v?: Variant;
  tone?: Tone;
  /** 숫자 서체(웹 .num). true면 700, 숫자면 그 굵기. */
  num?: boolean | 400 | 500 | 600 | 700 | 800;
  bold?: boolean;
  center?: boolean;
}

// 안드로이드는 한글을 글자 단위로 줄바꿈한다(웹 keep-all·iOS hangul-word 같은 설정이 없다). 한글이 든 낱말의 글자 사이에
// 줄바꿈 금지 문자(U+2060, 폭 0)를 끼워 띄어쓰기에서만 끊는다. 한 줄보다 긴 낱말은 안드로이드가 알아서 자른다.
// 이모지·기호는 건드리지 않는다(결합 문자열이 깨지지 않게).
const HANGUL = /[\uAC00-\uD7A3\u3131-\u318E]/;
const JOIN =
  /([0-9A-Za-z\uAC00-\uD7A3\u3131-\u318E·.,%+\-()'"‘’“”~:!?])(?=[0-9A-Za-z\uAC00-\uD7A3\u3131-\u318E·.,%+\-()'"‘’“”~:!?])/g;
const keepWord = (w: string) => (HANGUL.test(w) ? w.replace(JOIN, '$1\u2060') : w);
export const keepAll = (t: string) =>
  HANGUL.test(t) ? t.split(/(\s+)/).map(keepWord).join('') : t;
const keepAllChildren = (children: ReactNode): ReactNode =>
  typeof children === 'string'
    ? keepAll(children)
    : Array.isArray(children)
      ? Children.map(children, (ch) => (typeof ch === 'string' ? keepAll(ch) : ch))
      : children;
const ANDROID = Platform.OS === 'android';

export function Txt({ v = 'body', tone, num, bold, center, style, children, ...rest }: TxtProps) {
  const c = useColors();
  const textStyle = useTextStyle();
  const base: TextStyle[] = [T[v], { color: c[TONE[tone ?? (v === 'eyebrow' ? 'muted' : 'ink')]] }];
  if (num) base.push(numStyle(num === true ? 700 : num));
  if (bold) base.push({ fontWeight: '700' });
  if (center) base.push({ textAlign: 'center' });
  // 넓은 자간은 영문 대문자 머리말용이다 — 한국어·일본어 화면에서는 글자가 띄엄띄엄 보여 좁힌다(웹 :lang(ko) .eyebrow).
  if (v === 'eyebrow' && getLocale() !== 'en') base.push({ letterSpacing: rem(0.75) * 0.06 });
  // 한글은 낱말 단위로 줄을 바꾼다(웹 body word-break: keep-all). iOS는 hangul-word, 안드로이드는 keepAll.
  return (
    <Text lineBreakStrategyIOS="hangul-word" {...rest} style={fitLine(textStyle([base, style]))}>
      {ANDROID ? keepAllChildren(children) : children}
    </Text>
  );
}
