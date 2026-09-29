// 버튼 한 벌(웹 .btn + .btn-primary · .btn-accent · .btn-sm · .btn-block). 시트 버튼의 cls 문자열도 그대로 받는다.
import type { ReactNode } from 'react';
import { Text, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '../theme/useColors';
import { rem } from '../theme/type';
import { Press } from './Press';

export type BtnKind = 'default' | 'primary' | 'accent' | 'ghost' | 'danger';

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
  ...rest
}: BtnProps) {
  const c = useColors();
  const k = kind ?? kindFromCls(cls);
  const small = sm ?? !!cls?.includes('btn-sm');
  const palette = {
    default: { bg: c.surface, border: c.line, fg: c.ink },
    primary: { bg: c.pitch, border: c.pitch, fg: c.onPitch },
    accent: { bg: c.accent, border: c.accent, fg: c.accentInk },
    ghost: { bg: 'transparent', border: c.line, fg: c.ink },
    danger: { bg: c.surface, border: c.bad, fg: c.bad },
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
        <Text
          style={{
            color: palette.fg,
            fontSize: rem(small ? 0.875 : 0.9375),
            fontWeight: '600',
            lineHeight: rem(small ? 0.875 : 0.9375) * 1.25,
            textAlign: 'center',
          }}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Press>
  );
}
