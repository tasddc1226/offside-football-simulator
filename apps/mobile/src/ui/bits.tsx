// 작은 조각들: 줄·쌓기(웹 .row · .stack), 알약(.pill), 칩(.chip), 선택 버튼(.opt), 구분선.
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { alpha } from '../theme/colors';
import { useColors, useIsDark } from '../theme/useColors';
import { rem } from '../theme/type';
import { Press } from './Press';
import { Txt } from './Txt';

export function Row({
  children,
  gap = 10,
  wrap = true,
  style,
}: {
  children: ReactNode;
  gap?: number;
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Stack({
  children,
  gap = 10,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

type Tone = 'good' | 'bad' | 'warn';
/** 작은 알약 표시(웹 .pill · .pill.good/bad/warn). */
export function Pill({ children, tone }: { children: ReactNode; tone?: Tone | undefined }) {
  const c = useColors();
  const fg = tone ? c[tone] : c.muted;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 999,
        paddingVertical: 2,
        paddingHorizontal: 9,
        backgroundColor: c.surface2,
        borderWidth: 1,
        borderColor: tone ? alpha(fg, 0.4) : c.line,
      }}
    >
      {typeof children === 'string' ? (
        <Txt style={{ fontSize: rem(0.75), fontWeight: '600', color: fg }}>{children}</Txt>
      ) : (
        children
      )}
    </View>
  );
}

/** 변화 칩(웹 .chip · .chip.up/down) — 시즌 결산·이벤트 결과의 능력치 변화. */
export function Chip({ text, dir }: { text: string; dir?: 'up' | 'down' | '' | undefined }) {
  const c = useColors();
  return (
    <View
      style={{
        borderRadius: 999,
        paddingVertical: 3,
        paddingHorizontal: 9,
        backgroundColor: c.surface2,
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      <Txt
        style={{
          fontSize: rem(0.75),
          fontWeight: '600',
          color: dir === 'up' ? c.good : dir === 'down' ? c.bad : c.ink,
        }}
      >
        {text}
      </Txt>
    </View>
  );
}

/** 선택 버튼(웹 .opt · aria-pressed). 내용은 children. */
export function Opt({
  selected,
  onPress,
  style,
  disabled,
  children,
  testID,
  accessibilityLabel,
}: {
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  children?: ReactNode;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const dark = useIsDark();
  const on = dark ? c.accent : c.pitch;
  return (
    <Press
      scale={0.985}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      style={[
        {
          borderWidth: selected ? 2 : 1.5,
          borderColor: selected ? on : c.line,
          backgroundColor: selected ? alpha(c.pitch, 0.08) : c.surface,
          borderRadius: 12,
          paddingVertical: selected ? 9.5 : 10,
          paddingHorizontal: selected ? 11.5 : 12,
          minHeight: 44,
          justifyContent: 'center',
          gap: 1,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      {children}
    </Press>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[{ height: 1, backgroundColor: c.line }, style]} />;
}
