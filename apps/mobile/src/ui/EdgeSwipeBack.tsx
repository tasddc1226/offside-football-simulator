// T-11-213 iOS 왼쪽 가장자리에서 오른쪽으로 밀어 이전 화면으로(Android는 시스템 뒤로 가기 제스처가 BackHandler로 온다).
// 앱 화면은 라우터 한 화면 안에서 appState로 바뀌므로 네이티브 스택 제스처가 없다 — 가장자리에서 시작한 끌기만 받아
// 화면을 손가락 따라 밀고, 충분히 밀면 navStack.back()으로 이전 기록을 되살린다. 돌아갈 기록이 없거나(하단 탭 화면)
// 시트가 떠 있으면 움직이지 않는다.
import { useRef, type ReactNode } from 'react';
import { Animated, Platform, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { navStack } from '../game/host';
import { sheetState } from '../store';

const EDGE = 24;

export function EdgeSwipeBack({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(0)).current;
  const live = useRef(false);
  if (Platform.OS !== 'ios') return <>{children}</>;

  const settle = (to: number, done?: () => void) =>
    // 끌기 중에는 JS로 값을 넣으므로 같은 값을 네이티브 드라이버로 돌리면 끝난 뒤 0으로 되돌리기가 먹지 않는다.
    Animated.timing(x, { toValue: to, duration: 180, useNativeDriver: false }).start(done);
  const pan = Gesture.Pan()
    .runOnJS(true)
    .hitSlop({ left: 0, width: EDGE })
    .activeOffsetX(8)
    .failOffsetY([-20, 20])
    .onStart(() => {
      live.current = navStack.canGoBack() && !sheetState.open;
    })
    .onUpdate((e) => {
      if (live.current) x.setValue(Math.max(0, e.translationX));
    })
    .onEnd((e) => {
      if (!live.current) return;
      live.current = false;
      if (e.translationX > width * 0.33 || e.velocityX > 800)
        settle(width, () => {
          navStack.back();
          x.setValue(0);
        });
      else settle(0);
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={{ flex: 1, transform: [{ translateX: x }] }}>{children}</Animated.View>
    </GestureDetector>
  );
}
