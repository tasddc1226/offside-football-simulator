// T-11-639 강화 창 윗부분(웹 team/EnhanceSheet.svelte의 .stage): 단계 · 게이지 · 결과 문구. 전체 화면 연출은 EnhanceFx가 맡는다.
// 충전 중 숫자가 점점 세게 떨리고, 결과에 따라 창이 흔들리며 진동이 난다. 무한 반복은 없고 동작 줄이기면 결과만 보인다.
import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSnapshot } from 'valtio';
import { ENHANCE_CHARGE_MS } from '@offside/app-core/cardEnhance';
import { hapticsOn } from '../game/host';
import { prefs } from '../store';
import { useColors } from '../theme/useColors';
import { Txt } from '../ui/Txt';

type Kind = 'success' | 'keep' | 'down';

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
  const tremble = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    gauge.setValue(0);
    if (!charging || !motionOK) return;
    if (hapticsOn()) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const step = ENHANCE_CHARGE_MS / 6;
    const a = Animated.parallel([
      Animated.timing(gauge, {
        toValue: 1,
        duration: ENHANCE_CHARGE_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(scale, {
        toValue: 1.25,
        duration: ENHANCE_CHARGE_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence(
        [1, -2, 3, -4, 5, 0].map((toValue) =>
          Animated.timing(tremble, { toValue, duration: step, useNativeDriver: true }),
        ),
      ),
    ]);
    a.start();
    return () => a.stop();
  }, [charging, motionOK, gauge, scale, tremble]);

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
    const steps = (kind === 'down' ? [-16, 14, -10, 7, -3, 0] : [-4, 4, 0]).map((toValue) =>
      Animated.timing(shake, { toValue, duration: 80, useNativeDriver: true }),
    );
    if (kind === 'success') scale.setValue(0.4);
    const a = Animated.parallel([
      kind === 'success'
        ? Animated.spring(scale, { toValue: 1, friction: 3, useNativeDriver: true })
        : Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.sequence(steps),
    ]);
    a.start();
    return () => a.stop();
  }, [kind, motionOK, scale, shake]);

  return (
    <Animated.View
      style={{
        alignItems: 'center',
        gap: 4,
        padding: 12,
        borderRadius: 12,
        backgroundColor: c.surface2,
        transform: [{ translateX: shake }],
      }}
    >
      <Txt bold style={{ textAlign: 'center' }}>
        {name}
      </Txt>
      <Animated.View style={{ transform: [{ translateX: tremble }, { scale }] }}>
        <Txt
          bold
          num
          testID="enhance-level"
          style={{ color: kind === 'down' ? c.bad : c.accentText, fontSize: 46, lineHeight: 54 }}
        >
          {`+${level}`}
        </Txt>
      </Animated.View>
      <View
        style={{
          width: '82%',
          height: 10,
          borderRadius: 5,
          backgroundColor: c.line,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            height: '100%',
            backgroundColor: '#ffc23c',
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
