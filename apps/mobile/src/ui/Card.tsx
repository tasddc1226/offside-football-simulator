// 카드(웹 .card) · 초록 그라운드 카드(웹 .hero-home, 분필 선 포함).
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { RADIUS } from '@offside/app-core/design-tokens';
import { useColors, useIsDark } from '../theme/useColors';

export function useShadow(): ViewStyle {
  const dark = useIsDark();
  // T-11-396 흰 카드가 회색 바탕에서 살짝 뜰 만큼만(웹 --shadow). 다크는 그림자 없이 면 색으로 나눈다.
  return dark
    ? {}
    : {
        shadowColor: '#11141a',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      };
}

export function Card({
  children,
  style,
  gap = 10,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
  testID?: string;
}) {
  const c = useColors();
  const shadow = useShadow();
  return (
    <View
      testID={testID}
      style={[
        { backgroundColor: c.surface, borderRadius: RADIUS.lg, padding: 20, gap },
        shadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** 초록 그라운드(웹 .hero-home) — 오른쪽에 센터서클·하프라인 분필 선. */
export function PitchCard({
  children,
  style,
  gap = 6,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  const c = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: c.pitch,
          borderRadius: RADIUS.lg,
          paddingTop: 24,
          paddingHorizontal: 20,
          paddingBottom: 20,
          overflow: 'hidden',
          gap,
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 19,
          borderLeftWidth: 2,
          borderColor: c.chalk,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: -60,
          top: '50%',
          width: 160,
          height: 160,
          marginTop: -80,
          borderRadius: 80,
          borderWidth: 2,
          borderColor: c.chalk,
        }}
      />
      {children}
    </View>
  );
}
