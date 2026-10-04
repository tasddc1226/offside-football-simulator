// 영구결번 알림(웹 RetiredNumberAlert.svelte). 서버 어딘가에서 결번이 막 확정되면(홈 라이브 소켓, retiredNumber 처리)
// 어느 화면에 있든 화면 위에 9초 띄운다 — 화면을 누르고 있는 동안은 기다린다. '보기'는 그 선수의 은퇴 상세를 연다.
// 다른 유저의 결번이라 구단은 그 유저가 바꿔 부른 이름이 아니라 게임 기본 이름으로.
// 루트에서 화면 위에 얹는다(화면 전체를 덮는 자리 — 배너 밖은 터치를 통과시킨다).
import { useEffect, useState } from 'react';
import { Animated, Easing, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import type { LiveRetiredNumber } from '@offside/contracts';
import { defaultClubName } from '@offside/contracts/club-names';
import { RN_DEFAULT, RN_SHIRT, RN_TRIM, rnColors } from '@offside/app-core/rnStyle';
import { openPublicLegendById } from '../game/host';
import { prefs, rnAlert } from '../store';
import { alpha } from '../theme/colors';
import { DISPLAY, rem } from '../theme/type';
import { useColors } from '../theme/useColors';
import { Btn, Txt } from '../ui';
import { BannerClose } from './TopBanner';
import { useFly } from './useFly';

const SHOW_MS = 9_000;

const close = () => (rnAlert.item = null);

export function RetiredNumberAlert() {
  const snap = useSnapshot(rnAlert);
  const [holding, setHolding] = useState(false);
  const item = snap.item;
  const { mounted, style } = useFly(!!item, 240);
  // 사라지는 동안에도 내용이 남도록 마지막 결번을 붙들어 둔다.
  const [last, setLast] = useState<LiveRetiredNumber | null>(null);
  if (item && last?.seq !== item.seq) setLast({ ...item });
  const cur = item ?? last;

  // 9초 뒤 닫는다 — 누르고 있는 동안, 새 결번이 오면 다시 센다.
  useEffect(() => {
    if (!item || holding) return;
    const t = setTimeout(close, SHOW_MS);
    return () => clearTimeout(t);
  }, [item, holding]);

  if (!mounted || !cur) return null;
  return <AlertCard key={cur.seq} item={cur} fly={style} onHold={setHolding} />;
}

function AlertCard({
  item,
  fly,
  onHold,
}: {
  item: LiveRetiredNumber;
  fly: object;
  onHold: (holding: boolean) => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { motionOK } = useSnapshot(prefs);
  const jc = rnColors(item.clubId) ?? RN_DEFAULT;
  // 배너 폭(웹 min(448px, 100% - 32px)) + 금빛 고리 3px씩.
  const W = Math.min(448, width - 32);

  // 유니폼이 튀어 오르고(0.5초, 0.15초 뒤 시작), 빛이 두 번 지나간다(1.6초씩, 0.3초 뒤 시작).
  const [pop] = useState(() => new Animated.Value(motionOK ? 0 : 1));
  const [shine] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!motionOK) return;
    const sweep = () =>
      Animated.timing(shine, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
    const a = Animated.timing(pop, {
      toValue: 1,
      duration: 500,
      delay: 150,
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      useNativeDriver: true,
    });
    const b = Animated.sequence([
      Animated.delay(300),
      sweep(),
      Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: true }),
      sweep(),
    ]);
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [motionOK, pop, shine]);

  const open = () => {
    const id = item.careerId;
    close();
    void openPublicLegendById(id);
  };

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', zIndex: 9 }}
    >
      <Animated.View
        onTouchStart={() => onHold(true)}
        onTouchEnd={() => onHold(false)}
        onTouchCancel={() => onHold(false)}
        style={[
          {
            marginTop: insets.top + 8 - 3,
            width: W + 6,
            padding: 3,
            borderRadius: 17,
            backgroundColor: alpha(c.pitchAccent, 0.25),
            shadowColor: '#000',
            shadowOpacity: 0.4,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 10 },
            elevation: 6,
          },
          fly,
        ]}
      >
        <View
          testID={`rn-alert-${item.seq}`}
          accessibilityRole="alert"
          accessibilityLabel={`${item.name}, ${item.number}번 영구결번`}
          style={{
            overflow: 'hidden',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: c.pitch,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: c.pitchAccent,
            paddingVertical: 10,
            paddingLeft: 10,
            paddingRight: 10,
          }}
        >
          <Animated.View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: 40,
              transform: [
                { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                {
                  rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }),
                },
              ],
            }}
          >
            <Svg width={40} height={(40 * 124) / 120} viewBox="0 0 120 124">
              <Path d={RN_SHIRT} fill={jc.base} stroke={jc.accent} strokeWidth={2} />
              <Path d={RN_TRIM} fill="none" stroke={jc.accent} strokeWidth={4} />
              <SvgText
                x={60}
                y={92}
                textAnchor="middle"
                fontFamily={DISPLAY[700]}
                fontSize={46}
                fill={jc.ink}
              >
                {String(item.number)}
              </SvgText>
            </Svg>
          </Animated.View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt
              bold
              style={{ fontSize: rem(0.875), lineHeight: rem(0.875) * 1.4, color: c.pitchAccent }}
            >
              👑 {item.name}, {item.number}번 영구결번
            </Txt>
            <Txt
              style={{
                fontSize: rem(0.8125),
                lineHeight: rem(0.8125) * 1.4,
                color: alpha(c.onPitch, 0.85),
              }}
            >
              {defaultClubName(item.clubId) ?? item.club} · 서버 {item.seq}번째 결번
            </Txt>
          </View>
          <Btn kind="accent" sm testID="rn-alert-open" onPress={open}>
            보기
          </Btn>
          <BannerClose testID="rn-alert-close" onPress={close} />
          {/* 한 번 지나가는 빛 */}
          {motionOK ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: W,
                transform: [
                  { translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-W, W] }) },
                ],
              }}
            >
              <LinearGradient
                pointerEvents="none"
                colors={[
                  alpha(c.pitchAccent, 0),
                  alpha(c.pitchAccent, 0.35),
                  alpha(c.pitchAccent, 0),
                ]}
                locations={[0.3, 0.5, 0.7]}
                start={{ x: 0, y: 0.4 }}
                end={{ x: 1, y: 0.6 }}
                style={{ flex: 1 }}
              />
            </Animated.View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}
