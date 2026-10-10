// 은퇴 리포트 '필름' 바탕의 색·글자(웹 .film): 두 테마 모두 어두운 스크린 위 밝은 글자·금색 강조.
import type { ReactNode } from 'react';
import {
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTextStyle } from '../../theme/useTextSize';
import { useColors } from '../../theme/useColors';
import { DISPLAY, fitLine, rem } from '../../theme/type';

export function useFilm() {
  const c = useColors();
  return {
    bg: '#08120d',
    ink: c.onPitch,
    muted: '#a9b8ae',
    gold: c.pitchAccent,
    line: 'rgba(238,244,239,0.14)',
    /** 금색 점 둘레·표식 선. */
    goldRing: 'rgba(240,180,55,0.18)',
    goldLine: 'rgba(240,180,55,0.4)',
    /** 금색 바탕 위 글자. */
    onGold: '#1a1204',
  };
}

type Tone = 'ink' | 'muted' | 'gold';

/**
 * 필름 글자. size는 웹 CSS의 rem 값 그대로, display면 Barlow Condensed(웹 --display). lh는 줄 높이 배수
 * (기본 1.55 — 웹 body). 굵기를 정하면 fontWeight로 준다(display는 서체 파일이 굵기를 정한다).
 */
export function FText({
  tone = 'ink',
  size = 1,
  lh = 1.55,
  display,
  bold,
  italic,
  center,
  ls,
  style,
  ...rest
}: TextProps & {
  tone?: Tone;
  size?: number;
  lh?: number;
  display?: keyof typeof DISPLAY;
  bold?: boolean;
  italic?: boolean;
  center?: boolean;
  /** 자간(em). */
  ls?: number;
}) {
  const f = useFilm();
  const textStyle = useTextStyle();
  const px = rem(size);
  const base: TextStyle = {
    color: f[tone],
    fontSize: px,
    lineHeight: px * lh,
  };
  if (display) {
    base.fontFamily = DISPLAY[display];
    base.fontVariant = ['tabular-nums'];
  }
  if (bold) base.fontWeight = '700';
  if (italic) base.fontStyle = 'italic';
  if (center) base.textAlign = 'center';
  if (ls != null) base.letterSpacing = px * ls;
  return (
    <Text lineBreakStrategyIOS="hangul-word" {...rest} style={fitLine(textStyle([base, style]))} />
  );
}

/** 필름 소제목(웹 .film-kicker = eyebrow + 자간 0.32em + 금색). */
export function Kicker({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const f = useFilm();
  return (
    <Text
      style={[
        {
          fontFamily: DISPLAY[600],
          fontSize: rem(0.75),
          lineHeight: rem(0.75) * 1.5,
          letterSpacing: rem(0.75) * 0.32,
          textTransform: 'uppercase',
          color: f.gold,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** 필름 큰 제목(웹 .film h2: 1.5rem, 위 여백 6). */
export function H2({
  children,
  size = 1.5,
  style,
}: {
  children: ReactNode;
  size?: number;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <FText
      accessibilityRole="header"
      size={size}
      lh={1.35}
      bold
      center
      style={[{ letterSpacing: -0.4, marginTop: 6 }, style]}
    >
      {children}
    </FText>
  );
}

/** 필름 알약(웹 .film .pill · .pill-gold · .pill-rn). */
export function FilmPill({
  children,
  gold,
  rn,
  label,
  testID,
}: {
  children: ReactNode;
  gold?: boolean;
  rn?: boolean;
  label?: string;
  testID?: string;
}) {
  const f = useFilm();
  return (
    <View
      accessible={label != null}
      accessibilityLabel={label}
      testID={testID}
      style={{
        borderRadius: 999,
        paddingVertical: 2,
        paddingHorizontal: 9,
        backgroundColor: gold ? f.gold : 'rgba(238,244,239,0.08)',
        borderWidth: 1,
        borderColor: gold || rn ? f.gold : f.line,
      }}
    >
      <Text
        style={{
          fontSize: rem(0.75),
          lineHeight: rem(0.75) * 1.5,
          fontWeight: gold || rn ? '700' : '600',
          color: gold ? f.onGold : f.ink,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

/** 필름 바탕: 어두운 그린 그라디언트 + 위쪽 금빛 조명(웹 radial-gradient는 위에서 옅게 내려오는 선형으로 대신). */
export function FilmBackdrop({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const f = useFilm();
  return (
    <View
      style={[
        {
          backgroundColor: f.bg,
          borderRadius: 20,
          overflow: 'hidden',
          paddingTop: 40,
          paddingHorizontal: 20,
          paddingBottom: 48,
          gap: 44,
        },
        style,
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={['#0c1c14', f.bg]}
        locations={[0, 0.4]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(240,180,55,0.1)', 'rgba(240,180,55,0)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 360 }}
      />
      {children}
    </View>
  );
}
