// T-11-389 서버 데이터를 기다리는 동안의 뼈대(웹 Skeleton.svelte). 0.2초 안에 끝나면 보이지 않고(자리는 그대로 잡는다), 그 뒤
// 천천히 옅어졌다 짙어진다. 움직임 줄이기면 반짝이지 않는다. 화면 읽기 도구에는 '불러오는 중'을 알린다.
import { RADIUS } from '@offside/app-core/design-tokens';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSnapshot } from 'valtio';
import { shellText as L } from '@offside/app-core/i18n/ko/shell';
import { prefs } from '../store';
import { useColors } from '../theme/useColors';

/** 뼈대 틀: 0.2초 뒤 나타나 천천히 숨 쉬고, 화면 읽기 도구에 '불러오는 중'을 알린다. 화면 모양 뼈대(T-11-392 팀 그라운드 등)는
 *  이 틀 안에 skeletonBlock 색의 View를 놓는다. */
export function SkeletonFrame({ testID, children }: { testID?: string; children: ReactNode }) {
  const { motionOK } = useSnapshot(prefs);
  const shown = useSharedValue(0);
  useEffect(() => {
    const appear = withDelay(200, withTiming(1, { duration: 200 }));
    shown.value = motionOK
      ? withSequence(
          appear,
          withRepeat(
            withSequence(
              withTiming(0.45, { duration: 700, easing: Easing.inOut(Easing.ease) }),
              withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
            ),
            -1,
          ),
        )
      : appear;
  }, [motionOK, shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value }));
  return (
    <Animated.View
      testID={testID ?? 'skeleton'}
      accessible
      accessibilityLabel={L.loading}
      accessibilityState={{ busy: true }}
      accessibilityLiveRegion="polite"
      style={[{ gap: 14, paddingVertical: 4 }, style]}
    >
      {children}
    </Animated.View>
  );
}

/** 뼈대 조각의 색(면 · 테두리). */
export function useSkeletonBlock() {
  const c = useColors();
  return { backgroundColor: c.surface2, borderColor: 'transparent', borderWidth: 1 } as const;
}

/** rows: 목록 줄 수(내용과 비슷하게). height를 주면 줄 대신 그 높이의 카드 한 장(T-11-391). */
export function Skeleton({
  rows = 3,
  height,
  testID,
}: {
  rows?: number;
  height?: number;
  testID?: string;
}) {
  const block = useSkeletonBlock();

  return (
    <SkeletonFrame testID={testID}>
      {height ? <View style={[block, { height, borderRadius: RADIUS.md }]} /> : null}
      {Array.from({ length: height ? 0 : rows }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[block, { width: 32, height: 32, borderRadius: RADIUS.lg }]} />
          <View style={{ flex: 1, gap: 6 }}>
            <View
              style={[
                block,
                { width: `${72 - (i % 3) * 14}%`, height: 12, borderRadius: RADIUS.xs },
              ]}
            />
            <View style={[block, { width: '38%', height: 10, borderRadius: RADIUS.xs }]} />
          </View>
        </View>
      ))}
    </SkeletonFrame>
  );
}
