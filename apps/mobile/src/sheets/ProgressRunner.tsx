import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import type { AvatarSpec } from '@offside/game/avatar';
import { RUNNER_SIZE, runnerDuration, canRun } from '@offside/app-core/avatarStage';
import { useSnapshot } from 'valtio';
import { prefs } from '../store';
import { AvatarStage } from './AvatarStage';

/** Decorative sibling of the scroll body: feet follow the popup's top edge. */
export function ProgressRunner({ spec }: { spec: AvatarSpec }) {
  const { motionOK } = useSnapshot(prefs);
  const [width, setWidth] = useState(0);
  const [ready, setReady] = useState(false);
  const cycle = useRef(new Animated.Value(0)).current;
  const travel = Math.max(0, width - RUNNER_SIZE);
  const running = canRun(spec, motionOK);
  useEffect(() => {
    cycle.setValue(0);
    if (!running || !ready || !travel) return;
    const animation = Animated.loop(
      Animated.timing(cycle, {
        toValue: 1,
        duration: runnerDuration(travel),
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [cycle, travel, running, ready]);
  return (
    <View
      testID="progress-runner"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        top: (-RUNNER_SIZE * 9) / 8 + 3,
        height: (RUNNER_SIZE * 9) / 8,
      }}
    >
      <Animated.View
        style={{
          width: RUNNER_SIZE,
          height: (RUNNER_SIZE * 9) / 8,
          transform: [
            {
              translateX: cycle.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, travel, 0],
              }),
            },
          ],
        }}
      >
        <Animated.View
          style={{
            width: '100%',
            height: '100%',
            transform: [
              {
                scaleX: cycle.interpolate({
                  inputRange: [0, 0.4999, 0.5, 0.9999, 1],
                  outputRange: [1, 1, -1, -1, 1],
                }),
              },
            ],
          }}
        >
          <AvatarStage spec={spec} active={running} onReady={setReady} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
