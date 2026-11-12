import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, View, type LayoutChangeEvent } from 'react-native';
import { prefs } from '../../store';
import { useColors } from '../../theme/useColors';
import { Txt } from '../../ui';

/** 카드가 열리고 접힐 때 바깥 높이를 이어, 아래 내용이 한 번에 밀리지 않게 한다. 동작 줄이기면 바로 맞춘다. */
export function SmoothHeight({ children }: { children: ReactNode }) {
  const [height] = useState(() => new Animated.Value(0));
  const [measured, setMeasured] = useState(false);
  const last = useRef(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h === last.current) return;
    const first = last.current === 0;
    last.current = h;
    if (first || !prefs.motionOK) {
      height.setValue(h);
      setMeasured(true);
      return;
    }
    Animated.timing(height, {
      toValue: h,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };
  return (
    <Animated.View style={measured ? { height } : null}>
      <View onLayout={onLayout}>{children}</View>
    </Animated.View>
  );
}

/** 카드 아래 도구 한 묶음. */
export function ToolGroup({
  title,
  first,
  testID,
  action,
  children,
}: {
  title: string;
  first: boolean;
  testID: string;
  /** 제목 줄 오른쪽에 두는 버튼. */
  action?: ReactNode;
  children?: ReactNode;
}) {
  const { line } = useColors();
  return (
    <View
      testID={testID}
      style={[
        { gap: 6 },
        first ? null : { paddingTop: 12, borderTopWidth: 1, borderTopColor: line },
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
        }}
      >
        <Txt bold v="sm" tone="muted" accessibilityRole="header">
          {title}
        </Txt>
        {action}
      </View>
      {children}
    </View>
  );
}

/** 카드가 세로축으로 뒤집히며 열린다. 동작 줄이기면 바로 표시. */
export function FlipIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const [v] = useState(() => new Animated.Value(prefs.motionOK ? 0 : 1));
  useEffect(() => {
    if (prefs.motionOK)
      Animated.timing(v, {
        toValue: 1,
        // T-11-371 대박은 뒷면에서 한 박자 쉬고 뒤집힌다.
        delay,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    // 마운트 때 한 번만 뒤집는다.
  }, [v]);
  return (
    <Animated.View
      style={{
        opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }),
        transform: [
          { perspective: 800 },
          { rotateY: v.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '0deg'] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** 닫힌 카드가 아래에서 차례로 떠오른다. */
export function FlyIn({ index, children }: { index: number; children: ReactNode }) {
  const [v] = useState(() => new Animated.Value(prefs.motionOK ? 0 : 1));
  useEffect(() => {
    if (prefs.motionOK)
      Animated.timing(v, {
        toValue: 1,
        duration: 280,
        delay: 90 * index,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
  }, [v, index]);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}
