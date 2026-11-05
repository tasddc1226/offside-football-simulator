// T-11-639 강화 전체 화면 연출(웹 team/EnhanceFx.svelte). 판정이 끝난 뒤 보여 주기만 하고, 눌림을 막지 않으며 끝나면 사라진다.
// 충전: 어두워지며 입자가 가운데로 모이고 빛이 커진다. 성공: 터지는 빛 · 회전 광선 · 충격파 · 불꽃 · 큰 단계 숫자.
// 유지: 잿빛 연기. 하락: 붉은 번쩍임 · 깨진 조각이 떨어지고 숫자가 무너진다. 높은 단계 성공은 더 크게 터진다.
// TeamDialog 모달 안의 층이라 모달을 겹치지 않는다. 투명도 · 변환만 네이티브로 움직이고 무한 반복은 없다. 동작 줄이기면 그리지 않는다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSnapshot } from 'valtio';
import {
  ENHANCE_CHARGE_MS,
  enhanceFxBig,
  enhanceFxLabel,
  enhanceFxMs,
  enhanceParticles,
  enhanceResultKind,
} from '@offside/app-core/cardEnhance';
import type { EnhanceResponse } from '@offside/app-core/api/cardEnhance';
import { prefs } from '../store';

const GOLD = '#ffd35c';
const RAYS = Array.from({ length: 8 }, (_, i) => i);
const RAYS_BIG = Array.from({ length: 12 }, (_, i) => i);
const CENTER = {
  position: 'absolute',
  left: '50%',
  top: '50%',
} as const;

export function EnhanceFx({
  charging,
  result,
}: {
  charging: boolean;
  result: EnhanceResponse | null;
}) {
  const { motionOK } = useSnapshot(prefs);
  const { width, height } = useWindowDimensions();
  const R = Math.min(width, height) * 0.62;
  const charge = useRef(new Animated.Value(0)).current;
  const t = useRef(new Animated.Value(0)).current;
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!charging || !motionOK) return;
    charge.setValue(0);
    const a = Animated.timing(charge, {
      toValue: 1,
      duration: ENHANCE_CHARGE_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [charging, motionOK, charge]);

  useEffect(() => {
    if (!result || !motionOK) {
      setLive(false);
      return;
    }
    setLive(true);
    t.setValue(0);
    const a = Animated.timing(t, {
      toValue: 1,
      duration: enhanceFxMs(result),
      easing: Easing.linear,
      useNativeDriver: true,
    });
    a.start(({ finished }) => {
      if (finished) setLive(false);
    });
    return () => a.stop();
  }, [result, motionOK, t]);

  if (!motionOK) return null;
  if (charging) return <Charge v={charge} R={R} />;
  if (!result || !live) return null;
  return <Burst t={t} R={R} result={result} height={height} />;
}

function Charge({ v, R }: { v: Animated.Value; R: number }) {
  const parts = useMemo(() => enhanceParticles(22), []);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: '#000',
            opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.55, 0.72] }),
          },
        ]}
      />
      {/* 가운데 빛: 겹친 원으로 번짐을 만든다(iOS에서 느린 SVG 필터를 쓰지 않는다). */}
      {[
        [150, '#ff9d0040'],
        [100, '#ffc23c80'],
        [56, '#ffe28a'],
        [26, '#ffffff'],
      ].map(([size, color]) => (
        <Animated.View
          key={size}
          style={[
            CENTER,
            {
              width: size as number,
              height: size as number,
              marginLeft: -(size as number) / 2,
              marginTop: -(size as number) / 2,
              borderRadius: 999,
              backgroundColor: color as string,
              transform: [
                { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.15, 2.4] }) },
              ],
            },
          ]}
        />
      ))}
      {parts.map((p, i) => {
        const from = p.delay * 0.45;
        return (
          <Animated.View
            key={i}
            style={[
              CENTER,
              {
                width: p.size,
                height: p.size,
                borderRadius: p.size / 2,
                backgroundColor: '#ffe28a',
                opacity: v.interpolate({
                  inputRange: [from, from + 0.1, 1],
                  outputRange: [0, 1, 1],
                  extrapolate: 'clamp',
                }),
                transform: [
                  { rotate: `${p.angle}deg` },
                  {
                    translateY: v.interpolate({
                      inputRange: [from, from + 0.55],
                      outputRange: [-R * p.dist, 0],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function Burst({
  t,
  R,
  result,
  height,
}: {
  t: Animated.Value;
  R: number;
  result: EnhanceResponse;
  height: number;
}) {
  const kind = enhanceResultKind(result);
  const big = enhanceFxBig(result);
  const parts = useMemo(
    () => enhanceParticles(kind === 'success' ? (big ? 56 : 32) : kind === 'down' ? 16 : 9),
    [kind, big],
  );
  const veil = kind === 'down' ? '#5a000c' : '#000';
  const flash = kind === 'success' ? '#fff4c4' : kind === 'down' ? '#ff1e2d' : '#c7d0ca';
  const numColor = big
    ? '#fff6cf'
    : kind === 'success'
      ? GOLD
      : kind === 'down'
        ? '#ff5a5f'
        : '#d9e2dc';
  const glow = kind === 'success' ? '#ff9d00' : kind === 'down' ? '#ff1e2d' : '#000';
  const fontSize = big ? 136 : 104;
  const end = t.interpolate({ inputRange: [0, 0.78, 1], outputRange: [1, 1, 0] });
  const numTransform =
    kind === 'down'
      ? [
          {
            translateY: t.interpolate({
              inputRange: [0, 0.16, 1],
              outputRange: [-70, 0, 46],
            }),
          },
          {
            rotate: t.interpolate({
              inputRange: [0, 0.16, 1],
              outputRange: ['0deg', '0deg', '-11deg'],
            }),
          },
        ]
      : kind === 'keep'
        ? [
            {
              translateX: t.interpolate({
                inputRange: [0, 0.15, 0.3, 0.45, 1],
                outputRange: [0, -10, 8, -3, 0],
              }),
            },
          ]
        : [
            {
              scale: t.interpolate({
                inputRange: [0, 0.14, 0.24, 1],
                outputRange: [3.4, 0.88, 1, 1.06],
              }),
            },
          ];
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: end }]}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: veil, opacity: kind === 'down' ? 0.72 : 0.68 },
        ]}
      />
      {kind === 'success' ? (
        <>
          <Animated.View
            style={[
              CENTER,
              {
                opacity: t.interpolate({
                  inputRange: [0, 0.16, 0.7, 1],
                  outputRange: [0, 1, 0.75, 0],
                }),
                transform: [
                  { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '48deg'] }) },
                  {
                    scale: t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.35, 0.9, 1] }),
                  },
                ],
              },
            ]}
          >
            {(big ? RAYS_BIG : RAYS).map((i, _, all) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  width: big ? 26 : 20,
                  height: R * 3.4,
                  marginLeft: big ? -13 : -10,
                  marginTop: -R * 1.7,
                  backgroundColor: i % 2 ? '#ffffff55' : '#ffd35c66',
                  transform: [{ rotate: `${(i * 180) / all.length}deg` }],
                }}
              />
            ))}
          </Animated.View>
          {[0, 0.09, 0.18].map((at, i) => (
            <Animated.View
              key={at}
              style={[
                CENTER,
                {
                  width: 80,
                  height: 80,
                  marginLeft: -40,
                  marginTop: -40,
                  borderRadius: 40,
                  borderWidth: big ? 8 : 5,
                  borderColor: i === 1 ? '#fff' : '#ffe28a',
                  opacity: t.interpolate({
                    inputRange: [at, at + 0.02, at + 0.55],
                    outputRange: [0, 1, 0],
                    extrapolate: 'clamp',
                  }),
                  transform: [
                    {
                      scale: t.interpolate({
                        inputRange: [at, at + 0.55],
                        outputRange: [0.2, big ? 9 : 7],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </>
      ) : null}
      {parts.map((p, i) => {
        if (kind === 'success') {
          const from = p.delay * 0.05;
          const size = p.size + 2;
          return (
            <Animated.View
              key={i}
              style={[
                CENTER,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: i % 3 ? '#ffe28a' : '#ffffff',
                  opacity: t.interpolate({
                    inputRange: [from, from + 0.02, 0.5, 0.72],
                    outputRange: [0, 1, 1, 0],
                    extrapolate: 'clamp',
                  }),
                  transform: [
                    { rotate: `${p.angle}deg` },
                    {
                      translateY: t.interpolate({
                        inputRange: [from, 0.2, 0.72],
                        outputRange: [0, -R * 0.75 * p.dist, -R * 1.15 * p.dist],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                },
              ]}
            />
          );
        }
        if (kind === 'down') {
          const size = p.size * 2.4;
          return (
            <Animated.View
              key={i}
              style={[
                CENTER,
                {
                  width: size,
                  height: size * 1.6,
                  backgroundColor: i % 2 ? '#ff5a5f' : '#c4001a',
                  opacity: t.interpolate({
                    inputRange: [0, 0.03, 0.7, 0.95],
                    outputRange: [0, 1, 1, 0],
                  }),
                  transform: [
                    {
                      translateX: t.interpolate({
                        inputRange: [0, 0.25],
                        outputRange: [0, Math.sin((p.angle * Math.PI) / 180) * R * 0.55 * p.dist],
                        extrapolate: 'clamp',
                      }),
                    },
                    {
                      translateY: t.interpolate({
                        inputRange: [0, 0.2, 1],
                        outputRange: [0, -R * 0.3 * p.dist, height * 0.55],
                      }),
                    },
                    {
                      rotate: t.interpolate({
                        inputRange: [0, 1],
                        outputRange: [`${p.angle}deg`, `${p.angle + 260}deg`],
                      }),
                    },
                  ],
                },
              ]}
            />
          );
        }
        const size = p.size * 6;
        return (
          <Animated.View
            key={i}
            style={[
              CENTER,
              {
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                borderRadius: size / 2,
                backgroundColor: '#aab4ad',
                opacity: t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.32, 0] }),
                transform: [
                  { rotate: `${p.angle}deg` },
                  {
                    translateY: t.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-R * 0.1 * p.dist, -R * 0.55 * p.dist],
                    }),
                  },
                  { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.7] }) },
                ],
              },
            ]}
          />
        );
      })}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: flash,
            opacity: t.interpolate({
              inputRange: [0, kind === 'keep' ? 0.25 : 0.42],
              outputRange: [kind === 'keep' ? 0.5 : 1, 0],
              extrapolate: 'clamp',
            }),
          },
        ]}
      />
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Animated.Text
          allowFontScaling={false}
          style={{
            fontSize,
            lineHeight: fontSize * 1.12,
            fontWeight: '900',
            color: numColor,
            textShadowColor: glow,
            textShadowRadius: 26,
            opacity: t.interpolate({
              inputRange: [0, 0.08],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            }),
            transform: numTransform,
          }}
        >
          {`+${result.to}`}
        </Animated.Text>
        <Text
          allowFontScaling={false}
          style={{
            fontSize: 30,
            fontWeight: '900',
            letterSpacing: 1,
            color: '#ffffff',
            textShadowColor: glow,
            textShadowRadius: 14,
          }}
        >
          {enhanceFxLabel(result)}
        </Text>
      </View>
    </Animated.View>
  );
}
