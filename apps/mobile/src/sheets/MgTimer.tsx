// 미니게임 제한 시간(웹 sheets/MgTimer.svelte, T-10-089). 장면이 뜨면 줄어드는 막대와 남은 초를 보여 주고, 시간이 다 되면
// onexpire를 부른다(부른 쪽이 실패로 처리). 누르거나 차면(stopped) 그 자리에서 멈춘다.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { MG_TIME_MS } from '@offside/game/minigame';
import { useColors } from '../theme/useColors';
import { DISPLAY, rem } from '../theme/type';
import { Txt } from '../ui/Txt';

export function MgTimer({ stopped, onexpire }: { stopped: boolean; onexpire: () => void }) {
  const c = useColors();
  const [left, setLeft] = useState(Math.ceil(MG_TIME_MS / 1000));
  const w = useRef(new Animated.Value(1)).current;
  // onexpire는 렌더마다 새로 만들어질 수 있어 ref로 붙든다 — 타이머를 다시 걸지 않는다.
  const expire = useRef(onexpire);
  useEffect(() => {
    expire.current = onexpire;
  });

  // 막대: 남은 시간만큼 왼쪽으로 줄어든다. 멈추면(cleanup의 stopAnimation) 그 자리에 선다.
  useEffect(() => {
    if (stopped) return;
    Animated.timing(w, {
      toValue: 0,
      duration: MG_TIME_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    return () => w.stopAnimation();
  }, [stopped, w]);

  // 남은 초가 바뀌는 순간(j초 남음)마다 타이머 하나. 멈추면 effect가 다시 돌며 남은 타이머를 거둔다.
  useEffect(() => {
    if (stopped) return;
    const ids = Array.from({ length: Math.ceil(MG_TIME_MS / 1000) }, (_, j) =>
      setTimeout(
        () => {
          setLeft(j);
          if (!j) expire.current();
        },
        MG_TIME_MS - j * 1000,
      ),
    );
    return () => ids.forEach(clearTimeout);
  }, [stopped]);

  const hurry = left <= 1;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1,
        height: 4,
        backgroundColor: 'rgba(0,0,0,0.25)',
      }}
    >
      <Animated.View
        style={{
          height: '100%',
          width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: hurry ? c.bad : c.chalk,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 8,
          right: 10,
          minWidth: rem(0.9375) * 1.6,
          paddingVertical: 1,
          paddingHorizontal: 6,
          borderRadius: 999,
          backgroundColor: hurry ? c.bad : 'rgba(0,0,0,0.35)',
          opacity: stopped ? 0 : 1,
        }}
      >
        <Txt
          style={{
            fontFamily: DISPLAY[800],
            fontSize: rem(0.9375),
            lineHeight: rem(0.9375) * 1.3,
            textAlign: 'center',
            color: c.chalk,
          }}
        >
          {left}
        </Txt>
      </View>
    </View>
  );
}
