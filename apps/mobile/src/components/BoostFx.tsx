// T-11-083 잠재력 강화 연출(웹 BoostFx.svelte). 결과는 이미 정해져 저장된 뒤에 연다 — 연출은 보여 주기만 한다.
// 1) 강화 중: 게이지가 차오른다(끝으로 갈수록 느려진다). 2) 결과: 성공이면 새 단계 칸이 튀어 오르고, 실패면 카드가 흔들린다.
// 결과 화면은 '확인'이나 Android 뒤로로 닫는다. 감속 모션이면 게이지 없이 짧게 결과로 넘어간다.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSnapshot } from 'valtio';
import type { BoostOutcome } from '@offside/app-core/boost-view';
import { gameBoostText as L } from '@offside/app-core/i18n/ko/gameBoost';
import { prefs } from '../store';
import { useColors } from '../theme/useColors';
import { rem } from '../theme/type';
import { Btn } from '../ui/Btn';
import { Txt } from '../ui/Txt';

export function BoostFx({ out, onDone }: { out: BoostOutcome; onDone: () => void }) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const [done, setDone] = useState(false);
  const gauge = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const roll = Animated.timing(gauge, {
      toValue: 1,
      duration: motionOK ? 1600 : 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    roll.start(({ finished }) => {
      if (!finished) return;
      setDone(true);
      if (!motionOK) return;
      void Haptics.notificationAsync(
        out.ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
      if (out.ok) {
        pop.setValue(0.4);
        Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }).start();
      } else {
        Animated.sequence(
          [-8, 6, -3, 0].map((toValue) =>
            Animated.timing(shake, { toValue, duration: 90, useNativeDriver: true }),
          ),
        ).start();
      }
    });
    return () => roll.stop();
  }, [gauge, pop, shake, motionOK, out.ok]);

  // 강화 중에는 결과 전 단계, 결과에서는 결과 단계를 켠다.
  const lit = done || !out.ok ? out.lv : out.lv - 1;
  return (
    <Modal
      visible
      transparent
      animationType={motionOK ? 'fade' : 'none'}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => done && onDone()}
    >
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          backgroundColor: 'rgba(0,0,0,0.62)',
        }}
      >
        <Animated.View
          testID={done ? (out.ok ? 'boost-fx-ok' : 'boost-fx-fail') : 'boost-fx-rolling'}
          accessibilityViewIsModal
          accessibilityLiveRegion="polite"
          style={{
            width: '100%',
            maxWidth: 360,
            padding: 20,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: c.line,
            backgroundColor: c.surface,
            alignItems: 'center',
            gap: 10,
            transform: [{ translateX: shake }],
          }}
        >
          <Txt v="eyebrow">Potential</Txt>
          <View style={{ flexDirection: 'row', gap: 10 }} accessible={false}>
            {Array.from({ length: out.max }, (_, i) => {
              const on = i < lit;
              const fresh = done && out.ok && i === out.lv - 1;
              return (
                <Animated.View
                  key={i}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    borderWidth: 2,
                    borderColor: on ? c.accent : c.line,
                    backgroundColor: on ? c.accent : 'transparent',
                    transform: fresh ? [{ scale: pop }] : [],
                  }}
                />
              );
            })}
          </View>
          {!done ? (
            <>
              <Txt v="h2" accessibilityRole="header">
                {L.rolling}
              </Txt>
              <View
                style={{
                  alignSelf: 'stretch',
                  height: 10,
                  borderRadius: 99,
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
              <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
                {L.chance({ n: out.chance })}
              </Txt>
            </>
          ) : (
            <>
              <Txt
                v="h2"
                accessibilityRole="header"
                style={{ color: out.ok ? c.accentText : c.bad }}
              >
                {out.title}
              </Txt>
              <Txt v="sm" style={{ textAlign: 'center' }}>
                {out.text}
              </Txt>
              <Btn kind="primary" block testID="boost-fx-close" onPress={onDone}>
                {L.close}
              </Btn>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}
