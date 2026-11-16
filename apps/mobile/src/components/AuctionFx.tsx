// T-11-735 명품 경매 상자 열기 연출(웹 auction/AuctionFx.svelte). 결과는 이미 정해져 저장된 뒤에 연다 — 연출은 보여 주기만 한다.
// 1) 상자가 세 번 흔들린다. 2) 상자가 열리고 등급색 고리와 함께 소장품이 튀어나온다. 전설은 배경이 금빛이 된다.
// 결과 화면은 '확인'이나 Android 뒤로로 닫는다. 감속 모션이면 흔들림 없이 짧게 결과로 넘어간다. 끝없이 도는 애니메이션은 쓰지 않는다.
import { RADIUS } from '@offside/app-core/design-tokens';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSnapshot } from 'valtio';
import type { AuctionOutcome } from '@offside/app-core/auction-view';
import { gameAuctionText as L } from '@offside/app-core/i18n/ko/gameAuction';
import { hapticsOn } from '../game/host';
import { prefs } from '../store';
import { alpha } from '../theme/colors';
import { useColors } from '../theme/useColors';
import { Btn } from '../ui/Btn';
import { Txt } from '../ui/Txt';
import { AuctionIcon, gradeColor } from './AuctionIcon';

export function AuctionFx({ out, onDone }: { out: AuctionOutcome; onDone: () => void }) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const [done, setDone] = useState(false);
  const tilt = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const gc = gradeColor(c, out.g);

  useEffect(() => {
    const wobble = motionOK
      ? Animated.loop(
          Animated.sequence(
            [-7, 6, -3, 0].map((toValue) =>
              Animated.timing(tilt, {
                toValue,
                duration: 105,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
            ),
          ),
          { iterations: 3 },
        )
      : Animated.delay(250);
    wobble.start(({ finished }) => {
      if (!finished) return;
      setDone(true);
      if (!motionOK) return;
      if (hapticsOn())
        void Haptics.notificationAsync(
          out.g >= 3
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
        ).catch(() => {});
      pop.setValue(0.3);
      Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    });
    return () => wobble.stop();
  }, [tilt, pop, motionOK, out.g]);

  const rotate = tilt.interpolate({ inputRange: [-10, 10], outputRange: ['-10deg', '10deg'] });
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
          backgroundColor: done && out.g === 4 ? 'rgba(60,40,0,0.78)' : 'rgba(0,0,0,0.62)',
        }}
      >
        <View
          testID={done ? `auction-fx-g${out.g}` : 'auction-fx-opening'}
          accessibilityViewIsModal
          accessibilityLiveRegion="polite"
          style={{
            width: '100%',
            maxWidth: 360,
            padding: 20,
            borderRadius: RADIUS.lg,
            borderWidth: 2,
            borderColor: done ? gc : c.line,
            backgroundColor: c.surface,
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Txt v="eyebrow">Auction</Txt>
          <View style={{ height: 104, alignItems: 'center', justifyContent: 'center' }}>
            {!done ? (
              <Animated.View style={{ width: 72, gap: 3, transform: [{ rotate }] }}>
                <View
                  style={{
                    height: 18,
                    marginHorizontal: -5,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: c.ink,
                    backgroundColor: c.surface2,
                  }}
                />
                <View
                  style={{
                    height: 51,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: c.ink,
                    backgroundColor: c.surface2,
                  }}
                />
              </Animated.View>
            ) : (
              <Animated.View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  borderWidth: 2,
                  borderColor: gc,
                  backgroundColor: alpha(gc, 0.14),
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ scale: pop }],
                }}
              >
                <AuctionIcon d={out.icon} size={64} color={gc} />
              </Animated.View>
            )}
          </View>
          {!done ? (
            <Txt v="h2" accessibilityRole="header">
              {L.rolling}
            </Txt>
          ) : (
            <>
              <Txt
                v="h2"
                accessibilityRole="header"
                style={{ color: out.g >= 2 ? gc : c.ink, textAlign: 'center' }}
              >
                {out.title}
              </Txt>
              <Txt v="sm" style={{ textAlign: 'center' }}>
                {out.text}
              </Txt>
              <Btn kind="primary" block testID="auction-fx-close" onPress={onDone}>
                {L.close}
              </Btn>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
