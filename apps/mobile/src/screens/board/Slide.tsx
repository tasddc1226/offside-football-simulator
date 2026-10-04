// T-10-119 글을 열면 화면 전체가 오른쪽에서, 목록으로 돌아오면 왼쪽에서 들어온다(웹 motion.screenIn).
// view가 바뀔 때만 미끄러진다 — 처음 열 때는 그냥 그린다. 동작 줄이기면 바로 바꾼다.
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, useWindowDimensions } from 'react-native';
import { useSnapshot } from 'valtio';
import { prefs } from '../../store';

export function Slide({ view, dir, children }: { view: string; dir: -1 | 1; children: ReactNode }) {
  const { motionOK } = useSnapshot(prefs);
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(0)).current;
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!motionOK) return;
    x.setValue(Math.min(width, 560) * 0.36 * dir);
    Animated.timing(x, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // dir은 view와 함께 정해진다.
  }, [view]);
  return (
    <Animated.View style={{ gap: 14, transform: [{ translateX: x }] }}>{children}</Animated.View>
  );
}
