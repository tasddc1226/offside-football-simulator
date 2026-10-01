// 내 팀 화면들이 함께 쓰는 작은 부품(웹 team/Team.svelte 의 .seg · .opt · .tm-title · .tm-actions · .tm-ovr-badge).
import { useState, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { alpha } from '../../theme/colors';
import { useColors, useIsDark } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Press, Txt } from '../../ui';

/** 고르기 버튼 한 칸(웹 .opt · aria-pressed). Opt와 같은 모양에 e2e 식별자를 받는다. */
export function SegBtn({
  selected,
  onPress,
  disabled,
  testID,
  label,
  children,
  center,
}: {
  selected: boolean;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  label?: string;
  children: ReactNode;
  center?: boolean;
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
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: !!disabled }}
      style={{
        flex: 1,
        borderWidth: selected ? 2 : 1.5,
        borderColor: selected ? on : c.line,
        backgroundColor: selected ? alpha(c.pitch, 0.08) : c.surface,
        borderRadius: 12,
        paddingVertical: selected ? 9.5 : 10,
        paddingHorizontal: selected ? 11.5 : 12,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: center ? 'center' : 'flex-start',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </Press>
  );
}

/** 같은 폭 칸 여러 개를 가로로(웹 .seg.two · .seg.three). */
export function Seg({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', gap: 8 }}
    >
      {children}
    </View>
  );
}

/** 눈썹 + 제목 왼쪽, 오른쪽에 뱃지·고르기(웹 .tm-title). */
export function TmTitle({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt v="eyebrow">{eyebrow}</Txt>
        <Txt v="h1" accessibilityRole="header">
          {title}
        </Txt>
      </View>
      {right}
    </View>
  );
}

/** 팀 OVR 뱃지(웹 .tm-ovr-badge). */
export function OvrBadge({ ovr }: { ovr: number }) {
  const c = useColors();
  return (
    <View
      accessible
      accessibilityLabel={`팀 OVR ${ovr}`}
      style={{
        minWidth: 58,
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: c.pitch,
        alignItems: 'center',
      }}
    >
      <Txt
        style={{
          fontFamily: DISPLAY[400],
          fontSize: rem(0.6875),
          lineHeight: rem(0.6875) * 1.1,
          letterSpacing: 0.12 * rem(0.6875),
          color: c.onPitch,
        }}
      >
        OVR
      </Txt>
      <Txt
        style={{
          fontFamily: DISPLAY[700],
          fontSize: rem(1.625),
          lineHeight: rem(1.625) * 1.1,
          color: c.pitchAccent,
        }}
      >
        {ovr}
      </Txt>
    </View>
  );
}

/** 두 칸 격자(웹 .tm-actions: 1fr 1fr, gap 8) — 버튼이 셋이면 셋째는 둘째 줄 왼쪽 반 폭. */
export function Grid2({
  children,
  style,
}: {
  children: ReactNode[] | ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const [w, setW] = useState(0);
  const list = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, style]}
    >
      {list.map((ch, i) => (
        <View key={i} style={{ width: w ? (w - 8) / 2 : '48%' }}>
          {ch}
        </View>
      ))}
    </View>
  );
}

/** 숫자 칸 줄(웹 .owner-stats · .tm-stats). first는 첫 칸 너비 비율(전적처럼 긴 값). */
export function Stats({
  items,
  small,
  first = 1,
}: {
  items: [string, string][];
  small?: boolean;
  first?: number;
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {items.map(([k, v], i) => (
        <View
          key={k}
          accessible
          accessibilityLabel={`${k} ${v}`}
          style={{
            flex: i === 0 ? first : 1,
            minWidth: 0,
            gap: 2,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: c.surface2,
          }}
        >
          <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
            {k}
          </Txt>
          <Txt
            style={{
              fontFamily: DISPLAY[700],
              fontSize: rem(small ? 1.0625 : 1.25),
              fontVariant: ['tabular-nums'],
            }}
          >
            {v}
          </Txt>
        </View>
      ))}
    </View>
  );
}
