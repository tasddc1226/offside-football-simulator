// 화면 위로 내려오는 알림 배너 껍데기(웹 .update-banner · .news-banner 자리·모양). 스토어 업데이트·새 버전·새 소식 배너가 같이 쓴다.
// 루트에서 화면 위에 얹는다(화면 전체를 덮는 자리 — 배너 밖은 터치를 통과시킨다).
import type { ReactNode } from 'react';
import { Animated, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { alpha } from '../theme/colors';
import { rem } from '../theme/type';
import { useColors } from '../theme/useColors';
import { Press, Txt } from '../ui';

export function TopBanner({
  testID,
  label,
  style,
  children,
}: {
  testID: string;
  label: string;
  /** useFly의 등장·퇴장 전환. */
  style: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
  children: ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', zIndex: 8 }}
    >
      <Animated.View
        testID={testID}
        accessibilityLabel={label}
        accessibilityLiveRegion="polite"
        style={[
          {
            marginTop: insets.top + 8,
            width: Math.min(448, width - 32),
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: c.pitch,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: alpha(c.onPitch, 0.22),
            paddingVertical: 10,
            paddingLeft: 16,
            paddingRight: 10,
            shadowColor: '#000',
            shadowOpacity: 0.4,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 10 },
            elevation: 6,
          },
          style,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

/** 배너 글: 굵은 제목 + 흐린 한 줄 설명. */
export function BannerText({
  title,
  body,
  bodyLines,
}: {
  title: string;
  body: string;
  bodyLines?: number;
}) {
  const c = useColors();
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Txt bold style={{ fontSize: rem(0.875), lineHeight: rem(0.875) * 1.4, color: c.onPitch }}>
        {title}
      </Txt>
      <Txt
        numberOfLines={bodyLines}
        style={{
          fontSize: rem(0.8125),
          lineHeight: rem(0.8125) * 1.4,
          color: alpha(c.onPitch, 0.85),
        }}
      >
        {body}
      </Txt>
    </View>
  );
}

/** 배너 오른쪽 끝 ✕. */
export function BannerClose({ testID, onPress }: { testID: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Press
      testID={testID}
      accessibilityLabel="알림 닫기"
      onPress={onPress}
      hitSlop={4}
      style={{
        width: 36,
        height: 36,
        marginLeft: -4,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt style={{ fontSize: rem(1), color: c.onPitch }}>✕</Txt>
    </Press>
  );
}
