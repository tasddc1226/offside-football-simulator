// 버튼 한 벌(웹 .btn + .btn-primary · .btn-accent · .btn-sm · .btn-block). 시트 버튼의 cls 문자열도 그대로 받는다.
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useColors, useIsDark } from '../theme/useColors';
import { alpha } from '../theme/colors';
import { rem } from '../theme/type';
import { Txt } from './Txt';
import { Press } from './Press';

export type BtnKind = 'default' | 'primary' | 'accent' | 'ghost' | 'danger' | 'tonal';

export interface BtnProps {
  children: ReactNode;
  onPress?: () => void;
  kind?: BtnKind;
  /** 웹 클래스 문자열('btn-primary btn-sm' 등) — 시트 버튼(SheetButton.cls)용. kind·sm보다 약하다. */
  cls?: string | undefined;
  sm?: boolean;
  block?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** e2e·접근성용 식별자(웹 data-act). */
  testID?: string;
  /** 오른쪽 위 빨간 점(웹 .btn-dot) — 아직 안 본 새 소식으로 이끈다. 뜻은 accessibilityLabel에 적는다. */
  dot?: boolean;
  /** T-11-221 글자 오른쪽 배지(웹 .btn-badge) — 광고 · 비용 · 확률. 글자(children)가 문자열일 때만. */
  badge?: string;
}

export function kindFromCls(cls: string | undefined): BtnKind {
  if (!cls) return 'default';
  if (cls.includes('btn-primary')) return 'primary';
  if (cls.includes('btn-accent')) return 'accent';
  return 'default';
}

export function Btn({
  children,
  onPress,
  kind,
  cls,
  sm,
  block,
  disabled,
  style,
  dot,
  badge,
  ...rest
}: BtnProps) {
  const c = useColors();
  const dark = useIsDark();
  const k = kind ?? kindFromCls(cls);
  const small = sm ?? !!cls?.includes('btn-sm');
  const palette = {
    default: { bg: c.surface, border: c.line, fg: c.ink },
    primary: { bg: c.pitch, border: c.pitch, fg: c.onPitch },
    accent: { bg: c.accent, border: c.accent, fg: c.accentInk },
    ghost: { bg: 'transparent', border: c.line, fg: c.ink },
    danger: { bg: c.surface, border: c.bad, fg: c.bad },
    // T-11-221 화면 중간 동작(평가 보기 · 강화) — 옅은 초록 바탕(웹 .btn-tonal).
    tonal: dark
      ? { bg: alpha(c.accent, 0.16), border: 'transparent', fg: c.accent }
      : { bg: alpha(c.pitch, 0.12), border: 'transparent', fg: c.pitch },
  }[k];
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      {...rest}
      style={[
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: 1,
          borderRadius: 12,
          minHeight: small ? 44 : 48,
          paddingVertical: small ? 9 : 12,
          paddingHorizontal: small ? 14 : 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: small ? 6 : 8,
          opacity: disabled ? 0.45 : 1,
        },
        block && { alignSelf: 'stretch' },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Txt
          lineBreakStrategyIOS="hangul-word"
          style={{
            color: palette.fg,
            fontSize: rem(small ? 0.875 : 0.9375),
            fontWeight: '600',
            lineHeight: rem(small ? 0.875 : 0.9375) * 1.25,
            textAlign: 'center',
            flexShrink: 1,
            minWidth: 0,
          }}
        >
          {children}
        </Txt>
      ) : (
        children
      )}
      {badge ? (
        <View
          style={{
            paddingHorizontal: 6,
            paddingVertical: 1,
            borderRadius: 5,
            backgroundColor: c.surface,
          }}
        >
          <Txt num style={{ fontSize: rem(0.75), fontWeight: '700', color: c.accentText }}>
            {badge}
          </Txt>
        </View>
      ) : null}
      {dot ? (
        <View
          testID={rest.testID ? `${rest.testID}-dot` : undefined}
          style={{
            position: 'absolute',
            top: 6,
            right: 8,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: c.bad,
            borderWidth: 2,
            borderColor: palette.bg === 'transparent' ? c.surface : palette.bg,
          }}
        />
      ) : null}
    </Press>
  );
}
