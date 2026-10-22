// 상단 브랜드 줄(웹 Topbar.svelte): 앱 아이콘 배지(라이트·다크) + '풀타임: 휘슬이 울릴 때까지 / 오프사이드'. right에 스위치 등을 둔다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { useIsDark } from '../theme/useColors';
import { DISPLAY, rem } from '../theme/type';
import { Txt } from './Txt';
import { shellText as L } from '@offside/app-core/i18n/ko/shell';
import badgeDark from '../../assets/brand/offside-icon-v7-dark-180.png';
import badgeLight from '../../assets/brand/offside-icon-v7-180.png';

export function Topbar({ right }: { right?: ReactNode }) {
  const dark = useIsDark();
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
        source={dark ? badgeDark : badgeLight}
        style={{ width: 38, height: 38, borderRadius: RADIUS.sm }}
        accessibilityIgnoresInvertColors
      />
      <View style={{ flex: 1 }}>
        <Txt
          tone="muted"
          style={{
            fontSize: rem(FONT.caption),
            lineHeight: rem(FONT.caption) * 1.2,
            letterSpacing: 0.2,
          }}
        >
          {L.brandTag}
        </Txt>
        <Txt
          accessibilityRole="header"
          style={{
            fontFamily: DISPLAY[700],
            fontSize: rem(FONT.title2),
            lineHeight: rem(FONT.title2) * 1.15,
            letterSpacing: 0.4,
          }}
        >
          {L.brandName}
        </Txt>
      </View>
      {right}
    </View>
  );
}
