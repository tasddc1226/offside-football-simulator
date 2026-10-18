// T-11-389 서버 데이터를 기다리는 동안의 뼈대(웹 Skeleton.svelte). 0.2초 안에 끝나면 보이지 않고(자리는 그대로 잡는다), 그 뒤
// 천천히 옅어졌다 짙어진다. 움직임 줄이기면 반짝이지 않는다. 화면 읽기 도구에는 '불러오는 중'을 알린다.
import { useEffect } from 'react';
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

/** rows: 목록 줄 수(내용과 비슷하게). */
export function Skeleton({ rows = 3, testID }: { rows?: number; testID?: string }) {
  const c = useColors();
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
  const block = { backgroundColor: c.surface2, borderColor: c.line, borderWidth: 1 } as const;

  return (
    <Animated.View
      testID={testID ?? 'skeleton'}
      accessible
      accessibilityLabel={L.loading}
      accessibilityState={{ busy: true }}
      accessibilityLiveRegion="polite"
      style={[{ gap: 14, paddingVertical: 4 }, style]}
    >
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[block, { width: 32, height: 32, borderRadius: 16 }]} />
          <View style={{ flex: 1, gap: 6 }}>
            <View
              style={[block, { width: `${72 - (i % 3) * 14}%`, height: 12, borderRadius: 6 }]}
            />
            <View style={[block, { width: '38%', height: 10, borderRadius: 5 }]} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}
