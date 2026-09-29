// 상단 브랜드 줄(웹 Topbar.svelte): 깃발 배지 + '풀타임: 휘슬이 울릴 때까지 / 오프사이드'. right에 스위치 등을 둔다.
import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { DISPLAY, rem } from '../theme/type';
import { Txt } from './Txt';
import flag from '../../assets/brand/offside-flag-v6-180.png';

export function Topbar({ right }: { right?: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingTop: 14,
        paddingBottom: 4,
      }}
    >
      <Image
        source={flag}
        style={{ width: 38, height: 38, borderRadius: 10 }}
        accessibilityIgnoresInvertColors
      />
      <View style={{ flex: 1 }}>
        <Txt
          tone="muted"
          style={{ fontSize: rem(0.75), lineHeight: rem(0.75) * 1.2, letterSpacing: 0.2 }}
        >
          풀타임: 휘슬이 울릴 때까지
        </Txt>
        <Txt
          accessibilityRole="header"
          style={{
            fontFamily: DISPLAY[700],
            fontSize: rem(1.375),
            lineHeight: rem(1.375) * 1.15,
            letterSpacing: 0.4,
          }}
        >
          오프사이드
        </Txt>
      </View>
      {right}
    </View>
  );
}
