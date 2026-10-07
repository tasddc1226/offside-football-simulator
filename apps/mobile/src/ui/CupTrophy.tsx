// T-11-145 컵 트로피 — 모양은 app-core/cupTrophy(웹과 같다), 효과는 등급 엠블럼(GradeEmblem)처럼 후광·광택, 우승은 반짝임까지.
// 받침대에는 name(구단주 이름)을 새기고, 넘치면 선수 카드 이름처럼 흘려 보낸다. 움직임 줄이기를 켰거나 앱이 뒤로 가면 멈춘다.
import { useEffect, useId, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  AppState,
  Easing as RNEasing,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
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
import {
  cupTrophy,
  TROPHY_CUP_VIEWBOX,
  TROPHY_PLATE as P,
  TROPHY_PLATE_MIN,
  TROPHY_VIEWBOX,
  type TrophyStage,
} from '@offside/app-core/cupTrophy';
import { prefs } from '../store';

const CYCLE: Record<TrophyStage, number> = { champion: 8500, runnerup: 8000, sf: 9500 };
const STAR = 'M8 0L10 6L16 8L10 10L8 16L6 10L0 8L6 6Z';

/** 움직임 없는 컵 그림(받침대 없이) — 닉네임 옆 작은 칭호(TitleBadge)처럼 여러 개가 한꺼번에 그려지는 자리. */
export function TrophyArt({ stage, size }: { stage: TrophyStage; size: number }) {
  const { layers, palette } = cupTrophy(stage);
  return (
    <Svg width={size} height={size} viewBox={TROPHY_CUP_VIEWBOX}>
      {layers
        .filter((layer) => !layer.plinth)
        .map((layer, index) => (
          <Path key={index} d={layer.d} fill={palette[layer.tone]} />
        ))}
    </Svg>
  );
}

/** 받침대에 새긴 이름. 자리보다 길면 2초 쉬고 끝까지 흘렀다가 처음으로 돌아온다(PlayerCard CardName과 같은 리듬). */
function PlateName({
  name,
  size,
  color,
  moving,
}: {
  name: string;
  size: number;
  color: string;
  moving: boolean;
}) {
  const [textWidth, setTextWidth] = useState(0);
  const offset = useRef(new RNAnimated.Value(0)).current;
  const width = (size * P.w) / 64;
  const distance = textWidth - width;
  useEffect(() => {
    offset.setValue(0);
    if (distance <= 1 || !moving) return;
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.delay(2000),
        RNAnimated.timing(offset, {
          toValue: -distance,
          duration: Math.max(4000, distance * 160),
          easing: RNEasing.linear,
          useNativeDriver: true,
        }),
        RNAnimated.delay(2000),
        RNAnimated.timing(offset, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [distance, moving, offset]);
  const style = {
    fontSize: (size * P.font) / 64,
    fontWeight: '800' as const,
    color,
    includeFontPadding: false,
    letterSpacing: 0.2,
  };
  const scroll = moving && distance > 1;
  return (
    <View
      style={{
        position: 'absolute',
        left: (size * P.x) / 64,
        top: (size * P.y) / 64,
        width,
        height: (size * P.h) / 64,
        overflow: 'hidden',
        justifyContent: 'center',
      }}
    >
      <RNText
        allowFontScaling={false}
        onTextLayout={(e) => setTextWidth(e.nativeEvent.lines[0]?.width ?? 0)}
        style={[style, { position: 'absolute', width: 1000, opacity: 0 }]}
      >
        {name}
      </RNText>
      <RNAnimated.Text
        allowFontScaling={false}
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[
          style,
          {
            width: scroll ? textWidth : width,
            textAlign: scroll ? 'left' : 'center',
            transform: [{ translateX: offset }],
          },
        ]}
      >
        {name}
      </RNAnimated.Text>
    </View>
  );
}

export function CupTrophy({
  stage,
  name,
  size = 40,
  bare = false,
}: {
  stage: TrophyStage;
  /** 받침대에 새길 이름(구단주). 없으면 비워 둔다. */
  name?: string;
  size?: number;
  /** 받침대 없이 컵만(홈 배너). 작게 그리면(TROPHY_PLATE_MIN 미만) 늘 컵만. */
  bare?: boolean;
}) {
  const trophy = cupTrophy(stage);
  const { palette } = trophy;
  const cupOnly = bare || size < TROPHY_PLATE_MIN;
  const layers = cupOnly ? trophy.layers.filter((l) => !l.plinth) : trophy.layers;
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
      <Svg width={size} height={size} viewBox={cupOnly ? TROPHY_CUP_VIEWBOX : TROPHY_VIEWBOX}>
        {layers.map((layer, index) => (
          <Path key={index} d={layer.d} fill={palette[layer.tone]} />
        ))}
      </Svg>
      {name && !cupOnly ? (
        <PlateName name={name} size={size} color={palette.engrave} moving={motionOK && active} />
      ) : null}
      {motionOK ? (
        <View
          style={{
            position: 'absolute',
            top: size * (cupOnly ? 0.18 : 0.06),
            left: size * 0.18,
            right: size * 0.18,
            bottom: size * (cupOnly ? 0.22 : 0.32),
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
