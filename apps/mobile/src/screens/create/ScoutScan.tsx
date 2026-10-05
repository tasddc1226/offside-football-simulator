// "후보 3명 보기"를 누르면 약 3초 동안 화면을 가리고 스카우트가 후보를 추리는 연출을 보여 준다(웹 ScoutScan.svelte).
// 스캔 빔이 피치를 훑으며 선수 점을 찍고, 마지막 훑기에서 내 포지션 구역의 세 명이 금색으로 확정된다.
// 연출용 난수는 Math.random이다(게임 RNG를 건드리지 않는다). 탭하면 건너뛸 수 있고, 동작 줄이기면
// 빔 없이 짧게 단계만 넘긴다.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import type { Pos } from '@offside/game/data';
import { createText as L } from '@offside/app-core/i18n/ko/create';
import { buzz } from '../../game/host';
import { prefs } from '../../store';
import { alpha } from '../../theme/colors';
import { DISPLAY, rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Txt, useShadow } from '../../ui';

const HOLD = 350;
// 공격 방향은 오른쪽. 포지션별로 후보가 잡히는 가로 구역(%).
const ZONE: Record<Pos, [number, number]> = {
  GK: [5, 9],
  DF: [14, 36],
  MF: [40, 64],
  FW: [68, 90],
};
const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface Scene {
  total: number;
  /** 빔이 피치를 한 번 훑는 시간 — 세 번째(마지막) 훑기에서 후보를 확정한다. */
  pass: number;
  z0: number;
  z1: number;
  dots: { x: number; y: number; at: number }[];
  picks: { x: number; y: number; at: number }[];
  scanned: number;
}

// 연출은 한 번만 그린다 — 열려 있는 동안 포지션이 바뀌지 않는다.
function makeScene(pos: Pos, motionOK: boolean): Scene {
  const total = motionOK ? 3000 : 1200;
  const pass = total / 3;
  const [z0, z1] = ZONE[pos];
  // 스캔된 선수: 앞의 두 번 훑기 중 빔이 지나갈 때 나타난다. 후보: 마지막 훑기에서 빔이 지나갈 때 확정된다.
  const dots = Array.from({ length: 16 }, () => {
    const x = rand(4, 96);
    return { x, y: rand(10, 90), at: (Math.floor(rand(0, 2)) + x / 100) * pass };
  });
  const picks = [0, 1, 2]
    .map((i) => {
      const x = pos === 'GK' ? rand(z0, z1) : z0 + ((z1 - z0) * (i + rand(0.15, 0.85))) / 3;
      return { x, y: pos === 'GK' ? 50 + (i - 1) * 16 : rand(18, 82), at: (2 + x / 100) * pass };
    })
    .sort((a, b) => a.at - b.at);
  return { total, pass, z0, z1, dots, picks, scanned: Math.round(rand(1100, 1600)) };
}

/** 켜지면 튀어 오르며 나타나는 점(웹 .ss-dot / .ss-pick 전환). */
function PopIn({
  on,
  to,
  size,
  motionOK,
  x,
  y,
  children,
}: {
  on: boolean;
  /** 켜졌을 때 불투명도. */
  to: number;
  size: number;
  motionOK: boolean;
  x: number;
  y: number;
  children: ReactNode;
}) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!motionOK) {
      v.setValue(on ? 1 : 0);
      return;
    }
    Animated.timing(v, {
      toValue: on ? 1 : 0,
      duration: 280,
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      useNativeDriver: true,
    }).start();
  }, [on, motionOK, v]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, to], extrapolate: 'clamp' }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** 지금 하는 단계 표시(웹 .now .ss-mark — 도는 고리). */
function Spinner({ motionOK }: { motionOK: boolean }) {
  const c = useColors();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!motionOK) return;
    const loop = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration: 700,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [motionOK, v]);
  return (
    <Animated.View
      style={{
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: c.accent,
        borderRightColor: 'transparent',
        transform: [
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
        ],
      }}
    />
  );
}

export function ScoutScan({
  pos,
  steps,
  onDone,
}: {
  pos: Pos;
  steps: string[];
  onDone: () => void;
}) {
  const c = useColors();
  const shadow = useShadow();
  const [motionOK] = useState(() => prefs.motionOK);
  const [scene] = useState(() => makeScene(pos, motionOK));
  const { total, pass, z0, z1, dots, picks, scanned } = scene;

  const [t, setT] = useState(0);
  const p = Math.min(1, t / total);
  const count = Math.round(scanned * (1 - (1 - p) ** 2));
  const active = Math.min(steps.length - 1, Math.floor(p * steps.length));
  const beam = ((t % pass) / pass) * 100;
  const locked = picks.filter((k) => t >= k.at).length;

  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  };

  // 오버레이 페이드 인(웹 transition:fade 200ms).
  const [fade] = useState(() => new Animated.Value(motionOK ? 0 : 1));
  useEffect(() => {
    if (motionOK)
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [motionOK, fade]);

  // 시간 흐름: total + HOLD ms 동안 선형으로 0 → 끝. 후보가 하나 더 확정될 때마다 짧게 진동한다.
  const [clock] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let lastLocked = 0;
    const id = clock.addListener(({ value }) => {
      setT(value);
      const n = picks.filter((k) => value >= k.at).length;
      if (n > lastLocked) {
        lastLocked = n;
        buzz();
      }
    });
    const anim = Animated.timing(clock, {
      toValue: total + HOLD,
      duration: total + HOLD,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) finish();
    });
    return () => {
      clock.removeListener(id);
      anim.stop();
    };
    // 한 번만 시작한다 — finish는 ref만 쓴다.
  }, []);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity: fade, zIndex: 50 }]}
      testID="scout-scan"
    >
      <Pressable
        onPress={finish}
        accessibilityRole="button"
        accessibilityLabel={L.scanSkipLabel}
        accessibilityLiveRegion="polite"
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          backgroundColor: alpha(c.bg, 0.88),
        }}
      >
        <View
          style={[
            {
              width: '100%',
              maxWidth: 420,
              gap: 10,
              paddingTop: 18,
              paddingHorizontal: 16,
              paddingBottom: 14,
              borderRadius: 16,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.line,
            },
            shadow,
          ]}
        >
          <Txt v="eyebrow">Scouting</Txt>
          <Txt v="h2" accessibilityRole="header" style={{ fontSize: rem(1.15) }}>
            {L.scanTitle}
          </Txt>

          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ aspectRatio: 16 / 10, borderRadius: 10, overflow: 'hidden' }}
          >
            {/* 10%씩 번갈아 깔린 잔디 줄 */}
            <View style={StyleSheet.absoluteFill}>
              <View style={{ flex: 1, flexDirection: 'row' }}>
                {Array.from({ length: 10 }, (_, i) => (
                  <View
                    key={i}
                    style={{ flex: 1, backgroundColor: i % 2 === 0 ? c.pitch : c.pitch2 }}
                  />
                ))}
              </View>
            </View>
            <Svg
              width="100%"
              height="100%"
              viewBox="0 0 160 100"
              preserveAspectRatio="none"
              style={StyleSheet.absoluteFill}
            >
              <Rect x={3} y={3} width={154} height={94} {...chalk(c.chalk)} />
              <Line x1={80} y1={3} x2={80} y2={97} {...chalk(c.chalk)} />
              <Circle cx={80} cy={50} r={12} {...chalk(c.chalk)} />
              <Rect x={3} y={28} width={20} height={44} {...chalk(c.chalk)} />
              <Rect x={137} y={28} width={20} height={44} {...chalk(c.chalk)} />
            </Svg>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: '3%',
                bottom: '3%',
                left: `${z0}%`,
                width: `${z1 - z0}%`,
                backgroundColor: alpha(c.pitchAccent, 0.12),
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderColor: alpha(c.pitchAccent, 0.45),
              }}
            />
            {dots.map((d, i) => (
              <PopIn key={i} on={t >= d.at} to={0.55} size={7} motionOK={motionOK} x={d.x} y={d.y}>
                <View style={{ flex: 1, borderRadius: 3.5, backgroundColor: c.onPitch }} />
              </PopIn>
            ))}
            {picks.map((k, i) => (
              <PopIn key={i} on={t >= k.at} to={1} size={30} motionOK={motionOK} x={k.x} y={k.y}>
                <View
                  style={{
                    flex: 1,
                    borderRadius: 15,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: alpha(c.pitchAccent, 0.3),
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: c.pitchAccent,
                    }}
                  >
                    <Txt
                      style={{
                        fontFamily: DISPLAY[700],
                        fontSize: rem(0.8),
                        lineHeight: rem(0.8) * 1.2,
                        color: c.accentInk,
                        includeFontPadding: false,
                      }}
                    >
                      {i + 1}
                    </Txt>
                  </View>
                </View>
              </PopIn>
            ))}
            {motionOK && t < total ? (
              <LinearGradient
                pointerEvents="none"
                colors={[alpha(c.pitchAccent, 0), alpha(c.pitchAccent, 0.28)]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${beam - 28}%`,
                  width: '28%',
                  borderRightWidth: 2,
                  borderRightColor: c.pitchAccent,
                }}
              />
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt tone="muted" style={{ fontSize: rem(0.85) }}>
              {L.scannedBefore}{' '}
              <Txt num style={{ fontSize: rem(1.05) }}>
                {count.toLocaleString('ko-KR')}
              </Txt>
              {L.scannedAfter}
            </Txt>
            <Txt tone="muted" style={{ fontSize: rem(0.85) }}>
              {L.scanCand}{' '}
              <Txt num style={{ fontSize: rem(1.05) }}>
                {locked}
              </Txt>
              /3
            </Txt>
          </View>
          <View
            style={{ height: 4, borderRadius: 2, backgroundColor: c.surface2, overflow: 'hidden' }}
          >
            <View style={{ height: '100%', width: `${p * 100}%`, backgroundColor: c.accent }} />
          </View>

          <View style={{ gap: 6, marginTop: 2 }}>
            {steps.map((s, i) => {
              const done = p >= 1 || i < active;
              const now = !done && i === active;
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {done ? (
                      <Txt style={{ fontSize: rem(0.75), color: c.good }}>✓</Txt>
                    ) : now ? (
                      <Spinner motionOK={motionOK} />
                    ) : (
                      <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                        ·
                      </Txt>
                    )}
                  </View>
                  <Txt
                    style={{
                      flex: 1,
                      fontSize: rem(0.88),
                      color: done ? c.good : now ? c.ink : c.muted,
                      fontWeight: now ? '600' : '400',
                    }}
                  >
                    {s}
                  </Txt>
                </View>
              );
            })}
          </View>
          <Txt tone="muted" center style={{ fontSize: rem(0.8), marginTop: 2 }}>
            {p >= 1 ? L.scanDone : L.scanSkip}
          </Txt>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** 피치 분필 선(비율 유지 안 하는 뷰박스라 굵기를 작게 잡는다). */
const chalk = (stroke: string) => ({ fill: 'none', stroke, strokeWidth: 0.45 });
