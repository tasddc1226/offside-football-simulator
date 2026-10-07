// T-11-145 컵 트로피 — 모양은 app-core/cupTrophy(웹과 같다), 효과는 등급 엠블럼(GradeEmblem)처럼 후광·광택, 우승은 반짝임까지.
// 움직임 줄이기를 켰거나 앱이 뒤로 가면 멈춘다.
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
  Text,
} from 'react-native-svg';
import { useSnapshot } from 'valtio';
import {
  cupTrophy,
  TROPHY_NUMBER as N,
  TROPHY_VIEWBOX,
  type TrophyStage,
} from '@offside/app-core/cupTrophy';
import { prefs } from '../store';

const CYCLE: Record<TrophyStage, number> = { champion: 8500, runnerup: 8000, sf: 9500 };
const STAR = 'M8 0L10 6L16 8L10 10L8 16L6 10L0 8L6 6Z';

/** 움직임 없는 트로피 그림 — 닉네임 옆 작은 칭호(TitleBadge)처럼 여러 개가 한꺼번에 그려지는 자리. */
export function TrophyArt({
  stage,
  edition,
  size,
}: {
  stage: TrophyStage;
  edition: number;
  size: number;
}) {
  const { layers, palette } = cupTrophy(stage);
  return (
    <Svg width={size} height={size} viewBox={TROPHY_VIEWBOX}>
      {layers.map((layer, index) => (
        <Path key={index} d={layer.d} fill={palette[layer.tone]} />
      ))}
      <Text
        x={N.x}
        y={N.y}
        fontSize={N.size}
        fontWeight="900"
        textAnchor="middle"
        fill={palette.number}
      >
        {edition}
      </Text>
    </Svg>
  );
}

export function CupTrophy({
  stage,
  edition,
  size = 40,
}: {
  stage: TrophyStage;
  edition: number;
  size?: number;
}) {
  const { palette } = cupTrophy(stage);
  const { motionOK } = useSnapshot(prefs);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const phase = useSharedValue(0);
  const champion = stage === 'champion';

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    phase.value = 0;
    if (motionOK && active)
      phase.value = withRepeat(
        withTiming(1, { duration: CYCLE[stage], easing: Easing.linear }),
        -1,
      );
    return () => cancelAnimation(phase);
  }, [motionOK, active, stage, phase]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: champion && motionOK ? interpolate(phase.value, [0, 0.5, 1], [0.5, 0.95, 0.5]) : 0.7,
  }));
  const polishStyle = useAnimatedStyle(() => ({
    opacity: interpolate(phase.value, [0, 0.62, 0.68, 0.82, 0.87, 1], [0, 0, 0.75, 0.75, 0, 0]),
    transform: [
      {
        translateX: interpolate(
          phase.value,
          [0, 0.62, 0.82, 1],
          [-size * 1.2, -size * 1.2, size * 1.2, size * 1.2],
        ),
      },
    ],
  }));
  const sparkStyle = useAnimatedStyle(() => ({
    opacity: motionOK
      ? interpolate(phase.value, [0, 0.55, 0.68, 0.82, 1], [0.15, 0.15, 0.95, 0.2, 0.15])
      : 0.4,
    transform: [{ scale: motionOK ? interpolate(phase.value, [0, 0.68, 1], [0.7, 1.1, 0.7]) : 1 }],
  }));
  const spark = size * 0.16;
  return (
    <View
      testID={`cup-trophy-${stage}`}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      <Animated.View
        style={[{ position: 'absolute', top: -size / 10, left: -size / 10 }, haloStyle]}
      >
        <Svg width={size * 1.2} height={size * 1.2} viewBox="0 0 80 80">
          <Defs>
            <RadialGradient id={`${uid}halo`} cx="50%" cy="42%" r="50%">
              <Stop offset="0" stopColor={palette.base} stopOpacity={0.26} />
              <Stop offset="0.62" stopColor={palette.base} stopOpacity={0.08} />
              <Stop offset="1" stopColor={palette.base} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={40} cy={34} r={34} fill={`url(#${uid}halo)`} />
        </Svg>
      </Animated.View>
      <TrophyArt stage={stage} edition={edition} size={size} />
      {motionOK ? (
        <View
          style={{
            position: 'absolute',
            top: size * 0.06,
            left: size * 0.18,
            right: size * 0.18,
            bottom: size * 0.32,
            overflow: 'hidden',
          }}
        >
          <Animated.View style={[StyleSheet.absoluteFill, polishStyle]}>
            <Svg width="100%" height="100%" viewBox="0 0 64 64" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id={`${uid}shine`} x1="0%" y1="0%" x2="100%" y2="30%">
                  <Stop offset="0.36" stopColor={palette.mark} stopOpacity={0} />
                  <Stop offset="0.48" stopColor={palette.mark} stopOpacity={0.6} />
                  <Stop offset="0.62" stopColor={palette.mark} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect width={64} height={64} fill={`url(#${uid}shine)`} />
            </Svg>
          </Animated.View>
        </View>
      ) : null}
      {champion ? (
        <Animated.View style={[StyleSheet.absoluteFill, sparkStyle]}>
          <Svg
            width={spark}
            height={spark}
            viewBox="0 0 16 16"
            style={{ position: 'absolute', top: 0, right: size * 0.02 }}
          >
            <Path d={STAR} fill={palette.light} />
          </Svg>
          <Svg
            width={spark * 0.75}
            height={spark * 0.75}
            viewBox="0 0 16 16"
            style={{ position: 'absolute', top: size * 0.3, left: 0 }}
          >
            <Path d={STAR} fill={palette.light} />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}
