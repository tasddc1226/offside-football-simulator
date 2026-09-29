// 카드(웹 .card) · 초록 그라운드 카드(웹 .hero-home, 분필 선 포함).
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '../theme/useColors';
import { useIsDark } from '../theme/useColors';

export function useShadow(): ViewStyle {
  const dark = useIsDark();
  return dark
    ? {
        shadowColor: '#000',
        shadowOpacity: 0.5,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 10 },
        elevation: 3,
      }
    : {
        shadowColor: '#14201a',
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
      };
}

export function Card({
  children,
  style,
  gap = 10,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  const c = useColors();
  const shadow = useShadow();
  return (
    <View
      style={[{ backgroundColor: c.surface, borderRadius: 16, padding: 18, gap }, shadow, style]}
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
          borderRadius: 20,
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
