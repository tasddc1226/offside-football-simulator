// 배너가 위에서 내려오고(웹 svelte fly y:-16) 사라질 때 올라가는 전환. show가 false가 돼도 전환이 끝날 때까지 mounted를 유지한다.
// 동작 줄이기면 바로 나타나고 사라진다.
import { useEffect, useState } from 'react';
import { Animated } from 'react-native';
import { useSnapshot } from 'valtio';
import { prefs } from '../store';

export function useFly(show: boolean, ms: number) {
  const { motionOK } = useSnapshot(prefs);
  const [mounted, setMounted] = useState(show);
  const [v] = useState(() => new Animated.Value(show ? 1 : 0));
  // 나타날 때는 렌더 중에 바로 올려 첫 프레임부터 그린다(전환은 아래 효과가 이어 준다).
  if (show && !mounted) setMounted(true);
  useEffect(() => {
    if (!motionOK) {
      v.setValue(show ? 1 : 0);
      if (!show) setMounted(false);
      return;
    }
    const anim = Animated.timing(v, { toValue: show ? 1 : 0, duration: ms, useNativeDriver: true });
    anim.start(({ finished }) => {
      if (finished && !show) setMounted(false);
    });
    return () => anim.stop();
  }, [show, motionOK, ms, v]);
  const style = {
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
  };
  return { mounted, style };
}
