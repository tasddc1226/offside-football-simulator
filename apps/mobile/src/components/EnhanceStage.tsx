// T-11-639 카드 강화 연출(웹 team/EnhanceSheet.svelte의 .stage). 판정은 서버가 끝낸 뒤라 보여 주기만 한다.
// 누르면 게이지가 차고, 결과에 따라 성공은 단계가 튀어 오르며 빛이 퍼지고, 하락은 붉게 흔들리고, 유지는 살짝 흔들린다.
// 강화 창(Modal) 안이라 Modal을 겹치지 않고, 무한 반복 없이 짧게 끝낸다. 동작 줄이기면 움직임 없이 결과만 보인다.
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSnapshot } from 'valtio';
import { ENHANCE_CHARGE_MS } from '@offside/app-core/cardEnhance';
import { hapticsOn } from '../game/host';
import { prefs } from '../store';
import { useColors } from '../theme/useColors';
import { Txt } from '../ui/Txt';

type Kind = 'success' | 'keep' | 'down';
const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315];

export function EnhanceStage({
  name,
  level,
  charging,
  kind,
  text,
}: {
  name: string;
  level: number;
  charging: boolean;
  kind: Kind | null;
  text: string;
}) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const gauge = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    gauge.setValue(0);
    if (!charging || !motionOK) return;
    const a = Animated.parallel([
      Animated.timing(gauge, {
        toValue: 1,
        duration: ENHANCE_CHARGE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(scale, {
        toValue: 1.12,
        duration: ENHANCE_CHARGE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    a.start();
    return () => a.stop();
  }, [charging, motionOK, gauge, scale]);

  useEffect(() => {
    if (!kind) return;
    if (hapticsOn()) {
      void (
        kind === 'keep'
          ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          : Haptics.notificationAsync(
              kind === 'success'
                ? Haptics.NotificationFeedbackType.Success
                : Haptics.NotificationFeedbackType.Error,
            )
      ).catch(() => {});
    }
    if (!motionOK) {
      scale.setValue(1);
      return;
    }
    flash.setValue(0.4);
    burst.setValue(0);
    const steps = (kind === 'down' ? [-8, 6, -3, 0] : [-3, 3, 0]).map((toValue) =>
      Animated.timing(shake, { toValue, duration: 80, useNativeDriver: true }),
    );
    if (kind === 'success') scale.setValue(0.4);
    const a = Animated.parallel([
      Animated.timing(flash, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      kind === 'success'
        ? Animated.parallel([
            Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
            Animated.timing(burst, {
              toValue: 1,
              duration: 620,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ])
        : Animated.parallel([
            Animated.sequence(steps),
            Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
          ]),
    ]);
    a.start();
    return () => a.stop();
  }, [kind, motionOK, flash, burst, scale, shake]);

  const tint = kind === 'success' ? c.accent : kind === 'down' ? c.bad : c.line;
  const fade = burst.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  return (
    <Animated.View
      style={{
        overflow: 'hidden',
        alignItems: 'center',
        gap: 4,
        padding: 12,
        borderRadius: 12,
        backgroundColor: c.surface2,
        transform: [{ translateX: shake }],
      }}
    >
      {kind && motionOK ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: flash }]}
        />
      ) : null}
      {kind === 'success' && motionOK ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
        >
          <Animated.View
            style={{
              position: 'absolute',
              width: 60,
              height: 60,
              borderRadius: 30,
              borderWidth: 3,
              borderColor: c.accent,
              opacity: fade,
              transform: [
                { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.6] }) },
              ],
            }}
          />
          {SPARKS.map((a) => (
            <Animated.View
              key={a}
              style={{
                position: 'absolute',
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: c.accent,
                opacity: fade,
                transform: [
                  { rotate: `${a}deg` },
                  {
                    translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [-22, -78] }),
                  },
                ],
              }}
            />
          ))}
        </View>
      ) : null}
      <Txt bold style={{ textAlign: 'center' }}>
        {name}
      </Txt>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Txt
          bold
          num
          testID="enhance-level"
          style={{ color: kind === 'down' ? c.bad : c.accentText, fontSize: 38, lineHeight: 44 }}
        >
          {`+${level}`}
        </Txt>
      </Animated.View>
      <View
        style={{
          width: '70%',
          height: 4,
          borderRadius: 2,
          backgroundColor: c.line,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            height: '100%',
            backgroundColor: c.accent,
            width: gauge.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }}
        />
      </View>
      <Txt
        bold
        v="sm"
        tone={kind === 'success' ? 'good' : kind === 'down' ? 'bad' : 'ink'}
        testID={kind ? `enhance-result-${kind}` : undefined}
        style={{ textAlign: 'center', minHeight: 20, marginTop: 4 }}
      >
        {text}
      </Txt>
    </Animated.View>
  );
}
