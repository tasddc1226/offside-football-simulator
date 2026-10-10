// 글자 한 벌(웹 body·h1·h2·.muted·.num·.eyebrow 자리). 색은 테마를 따르고, style로 덮어쓸 수 있다.
import { Text, type TextProps, type TextStyle } from 'react-native';
import { useTextStyle } from '../theme/useTextSize';
import { useColors } from '../theme/useColors';
import { fitLine, num as numStyle, T } from '../theme/type';
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

export function Txt({ v = 'body', tone, num, bold, center, style, ...rest }: TxtProps) {
  const c = useColors();
  const textStyle = useTextStyle();
  const base: TextStyle[] = [T[v], { color: c[TONE[tone ?? (v === 'eyebrow' ? 'muted' : 'ink')]] }];
  if (num) base.push(numStyle(num === true ? 700 : num));
  if (bold) base.push({ fontWeight: '700' });
  if (center) base.push({ textAlign: 'center' });
  // 한글은 낱말 단위로 줄을 바꾼다(웹 body word-break: keep-all). iOS만 지원 — 안드로이드는 글자 단위 그대로다.
  return (
    <Text lineBreakStrategyIOS="hangul-word" {...rest} style={fitLine(textStyle([base, style]))} />
  );
}
