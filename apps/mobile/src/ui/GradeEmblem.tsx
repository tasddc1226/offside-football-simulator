// Common grade artwork and effects in rankings, summaries and achievement alerts.
import { useEffect, useId, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { useSnapshot } from 'valtio';
import { EMBLEM_PALETTE, gradeEmblem } from '@offside/app-core/gradeEmblem';
import type { AchGrade } from '@offside/contracts/owner-team';
import { prefs } from '../store';

const CYCLE: Record<AchGrade['id'], number> = {
  rookie: 9000,
  bronze: 9000,
  silver: 8000,
  gold: 8500,
  platinum: 7000,
  diamond: 7000,
  legend: 6000,
};
const STAR = 'M8 0L10 6L16 8L10 10L8 16L6 10L0 8L6 6Z';

export function GradeEmblem({ id, size = 20 }: { id: string; size?: number }) {
  const grade = (id in EMBLEM_PALETTE ? id : 'rookie') as AchGrade['id'];
  const { layers, palette } = gradeEmblem(grade);
  const { motionOK } = useSnapshot(prefs);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const phase = useSharedValue(0);
  const orbit = useSharedValue(0);
  const movingHalo = grade === 'platinum' || grade === 'legend';
  const shine = grade !== 'rookie' && grade !== 'platinum';
  const sparks = grade === 'gold' || grade === 'diamond' || grade === 'legend';

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    phase.value = 0;
    orbit.value = 0;
    if (motionOK && active && grade !== 'rookie') {
      phase.value = withRepeat(
        withTiming(1, { duration: CYCLE[grade], easing: Easing.linear }),
        -1,
      );
      if (movingHalo)
        orbit.value = withRepeat(
          withTiming(1, { duration: grade === 'legend' ? 10000 : 12000, easing: Easing.linear }),
          -1,
        );
    }
    return () => {
      cancelAnimation(phase);
      cancelAnimation(orbit);
    };
  }, [motionOK, active, grade, movingHalo, phase, orbit]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity:
      movingHalo && motionOK
        ? interpolate(phase.value, [0, 0.5, 1], [0.5, 0.95, 0.5])
        : grade === 'rookie'
          ? 0.35
          : 0.65,
    transform: [
      {
        scale: movingHalo && motionOK ? interpolate(phase.value, [0, 0.5, 1], [0.92, 1, 0.92]) : 1,
      },
    ],
  }));
  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbit.value * (grade === 'legend' ? -360 : 360)}deg` }],
  }));
  const polishStyle = useAnimatedStyle(() => ({
    opacity: interpolate(phase.value, [0, 0.65, 0.7, 0.82, 0.87, 1], [0, 0, 0.7, 0.7, 0, 0]),
    transform: [
      {
        translateX: interpolate(
          phase.value,
          [0, 0.65, 0.82, 1],
          [-size * 1.2, -size * 1.2, size * 1.2, size * 1.2],
        ),
      },
    ],
  }));
  const sparkStyle = useAnimatedStyle(() => ({
    opacity: motionOK
      ? interpolate(phase.value, [0, 0.55, 0.68, 0.82, 1], [0.15, 0.15, 0.9, 0.2, 0.15])
      : 0.4,
    transform: [{ scale: motionOK ? interpolate(phase.value, [0, 0.68, 1], [0.7, 1.1, 0.7]) : 1 }],
  }));
  const auraSize = size * 1.25;
  return (
    <View
      testID={`grade-emblem-${grade}`}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      <Animated.View style={[{ position: 'absolute', top: -size / 8, left: -size / 8 }, haloStyle]}>
        <Svg width={auraSize} height={auraSize} viewBox="0 0 80 80">
          <Defs>
            <RadialGradient id={`${uid}halo`} cx="50%" cy="50%" r="50%">
              <Stop
                offset="0"
                stopColor={palette.base}
                stopOpacity={grade === 'legend' ? 0.42 : 0.24}
              />
              <Stop offset="0.65" stopColor={palette.light} stopOpacity={0.12} />
              <Stop offset="1" stopColor={palette.base} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={40} cy={40} r={39} fill={`url(#${uid}halo)`} />
          {['bronze', 'silver', 'diamond'].includes(grade) ? (
            <Circle
              cx={40}
              cy={40}
              r={37}
              fill="none"
              stroke={palette.light}
              strokeOpacity={grade === 'diamond' ? 0.38 : 0.2}
            />
          ) : null}
        </Svg>
      </Animated.View>
      {movingHalo ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: -size / 8,
              left: -size / 8,
              opacity: grade === 'legend' ? 0.8 : 0.5,
            },
            orbitStyle,
          ]}
        >
          <Svg width={auraSize} height={auraSize} viewBox="0 0 80 80">
            <Circle
              cx={40}
              cy={40}
              r={37}
              fill="none"
              stroke={palette.light}
              strokeWidth={1.5}
              strokeDasharray="35 81"
            />
            <Circle
              cx={40}
              cy={40}
              r={37}
              fill="none"
              stroke={palette.trim}
              strokeWidth={1.5}
              strokeDasharray="25 91"
              strokeDashoffset={-58}
            />
          </Svg>
        </Animated.View>
      ) : null}
      <Svg width={size} height={size} viewBox="0 0 64 64">
        {layers.map((layer, index) => (
          <Path key={index} d={layer.d} fill={palette[layer.tone]} />
        ))}
      </Svg>
      {shine && motionOK ? (
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: size / 2 }]}>
          <Animated.View style={[StyleSheet.absoluteFill, polishStyle]}>
            <Svg width={size} height={size} viewBox="0 0 64 64">
              <Defs>
                <LinearGradient id={`${uid}shine`} x1="0%" y1="0%" x2="100%" y2="30%">
                  <Stop offset="0.36" stopColor={palette.mark} stopOpacity={0} />
                  <Stop offset="0.48" stopColor={palette.mark} stopOpacity={0.55} />
                  <Stop offset="0.62" stopColor={palette.mark} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect width={64} height={64} fill={`url(#${uid}shine)`} />
            </Svg>
          </Animated.View>
        </View>
      ) : null}
      {sparks ? (
        <Animated.View style={[StyleSheet.absoluteFill, sparkStyle]}>
          <Svg width={size} height={size} viewBox="0 0 64 64">
            <Path
              d={STAR}
              fill={grade === 'legend' ? palette.trim : palette.light}
              transform="translate(54 2) scale(.625)"
            />
            {grade !== 'gold' ? (
              <Path
                d={STAR}
                fill={grade === 'legend' ? palette.trim : palette.mark}
                transform="translate(-2 52) scale(.5)"
              />
            ) : null}
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}
