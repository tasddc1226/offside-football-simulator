import { memo, useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { AvatarSpec } from '@offside/game/avatar';
import {
  RUNNER_SIZE,
  RUNNER_HEIGHT,
  GOAL_WIDTH,
  GOAL_HEIGHT,
  BALL_SIZE,
  GOAL_RECTS,
  GOAL_COLORS,
  runnerScene,
  canRun,
} from '@offside/app-core/avatarStage';
import { useSnapshot } from 'valtio';
import { prefs } from '../store';
import { AvatarStage } from './AvatarStage';

const Goal = memo(function Goal({ scored }: { scored: boolean }) {
  return (
    <Svg width={GOAL_WIDTH} height={GOAL_HEIGHT} viewBox="0 0 34 34">
      {GOAL_RECTS.map((r, i) => (
        <Rect
          key={i}
          x={r[0]}
          y={r[1]}
          width={r[2]}
          height={r[3]}
          fill={r[4] ? GOAL_COLORS.net : scored ? GOAL_COLORS.scored : GOAL_COLORS.frame}
        />
      ))}
    </Svg>
  );
});
const Ball = memo(function Ball() {
  return (
    <Svg width={BALL_SIZE} height={BALL_SIZE} viewBox="0 0 8 8">
      <Circle cx={4} cy={4} r={3.5} fill="#f5f5ef" stroke="#202c24" strokeWidth={1} />
      <Path d="M3 2h2v2H3zM1 4h2v2H1zM5 5h2v2H5z" fill="#202c24" />
    </Svg>
  );
});

/** Uses the same elapsed-time choreography, pixel goal and ball as the web. */
export function ProgressRunner({ spec }: { spec: AvatarSpec }) {
  const { motionOK } = useSnapshot(prefs);
  const [width, setWidth] = useState(0);
  const [ready, setReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const running = canRun(spec, motionOK);
  useEffect(() => {
    setElapsed(0);
    if (!running || !ready || !width) return;
    const start = performance.now();
    let raf: number;
    const tick = () => {
      setElapsed(performance.now() - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [width, running, ready]);
  const scene = runnerScene(width, elapsed, running && ready);
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
        top: -RUNNER_HEIGHT + 3,
        height: RUNNER_HEIGHT,
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: RUNNER_SIZE,
          height: RUNNER_HEIGHT,
          transform: [{ translateX: scene.x }],
          opacity: scene.playerOpacity,
        }}
      >
        <AvatarStage
          spec={spec}
          active={running}
          motion={scene.motion}
          frame={scene.frame}
          onReady={setReady}
        />
      </View>
      <View style={{ position: 'absolute', right: 0, bottom: 0 }}>
        <Goal scored={scene.scored} />
      </View>
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: [{ translateX: scene.ballX }, { translateY: scene.ballY }],
          opacity: scene.ballOpacity,
        }}
      >
        <Ball />
      </View>
    </View>
  );
}
