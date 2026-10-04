// T-10-076 영구결번 유니폼(웹 RnJersey.svelte · 기록실 타일·알림의 납작한 유니폼). 3D 엔진 없이 SVG 음영(몸통 원통 음영·소매·
// 주름·박음질)과 원근 회전으로 입체감을 낸다. 도안은 공유 이미지와 같은 JERSEY(app-core/rnStyle), 색은 구단 엠블럼 색.
// 웹은 부모의 CSS 변수(--rn-*)로 색을 받았다 — 앱은 clubId를 넘기거나(RnColorContext로 감싸도 된다) 없으면 기본 색.
// 뺀 것: 원단 결(feTurbulence)·주름 블러·등판 그림자 필터·유니폼 위로 지나가는 빛줄기(SVG 필터·블렌드 미지원).
import { createContext, useContext, useEffect, useId, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, {
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
  TextPath,
} from 'react-native-svg';
import { useSnapshot } from 'valtio';
import {
  JERSEY as J,
  RN_DEFAULT,
  RN_SHIRT,
  RN_TRIM,
  rnColors,
  type RnColors,
} from '@offside/app-core/rnStyle';
import { prefs } from '../store';
import { DISPLAY } from '../theme/type';

/** 부모가 색을 정해 주는 자리(웹 style="--rn-base:…"). clubId prop이 있으면 그쪽이 우선. */
export const RnColorContext = createContext<RnColors>(RN_DEFAULT);
export const useRnColors = (clubId?: string | null): RnColors => {
  const inherited = useContext(RnColorContext);
  return (clubId ? rnColors(clubId) : null) ?? inherited;
};

/** 납작한 유니폼 도안(120×124 좌표). 다른 Svg 안에 그릴 때 쓴다(기록실 타일은 바탕 그라디언트와 한 Svg로 그린다). */
export function RnShirtShape({ number, col }: { number: number; col: RnColors }) {
  return (
    <>
      <Path d={RN_SHIRT} fill={col.base} stroke={col.accent} strokeWidth={2} />
      <Path d={RN_TRIM} fill="none" stroke={col.accent} strokeWidth={4} />
      <SvgText
        x={60}
        y={92}
        textAnchor="middle"
        fontFamily={DISPLAY[400]}
        fontSize={46}
        fill={col.ink}
      >
        {String(number)}
      </SvgText>
    </>
  );
}

/** 납작한 결번 유니폼(웹 .rn-tile-shirt · 영구결번 알림) — 윤곽 + 깃 띠 + 등번호. width는 px(높이는 도안 비율). */
export function RnShirt({
  number,
  width = 52,
  clubId,
}: {
  number: number;
  width?: number;
  clubId?: string | null | undefined;
}) {
  const col = useRnColors(clubId);
  return (
    <Svg
      width={width}
      height={(width * 124) / 120}
      viewBox="0 0 120 124"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <RnShirtShape number={number} col={col} />
    </Svg>
  );
}

/** [위치, ±불투명도] → 흰색(+)·검정(−) 그라디언트 멈춤점. */
const stops = (shade: readonly (readonly [number, number])[]) =>
  shade.map(([offset, o]) => ({ offset, color: o > 0 ? '#fff' : '#000', o: Math.abs(o) }));

export function RnJersey({
  name,
  number,
  clubId,
}: {
  name: string;
  number: number;
  clubId?: string | null | undefined;
}) {
  const col = useRnColors(clubId);
  const { motionOK } = useSnapshot(prefs);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (s: string) => `${uid}${s}`;
  const { x0, x1, y0, yc } = J.arc;
  /** 글자 폭 어림(한글 ≈ 10, 로마자 ≈ 6.5, 글꼴 10px) + 자간 1.2 — 등판 폭을 넘을 이름만 글자를 줄여 맞춘다. */
  const nameW = [...name].reduce((n, ch) => n + (/[ㄱ-힝]/.test(ch) ? 11.2 : 7.7), -1.2);
  const nameScale = nameW > J.nameMax ? J.nameMax / nameW : 1;

  // 원근 속에서 천천히 몸을 돌리고(±18°), 바닥 그림자가 따라온다. 동작 줄이기면 멈춘다.
  const sway = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motionOK) return;
    sway.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, {
          toValue: 1,
          duration: 7000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sway, {
          toValue: 0,
          duration: 7000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [motionOK, sway]);

  const W = 196;
  const H = (W * 124) / 120;
  const arc = `M${x0} ${y0} Q60 ${yc} ${x1} ${y0}`;
  const printText = (fill: string, opacity = 1) => (
    <>
      <SvgText
        fill={fill}
        opacity={opacity}
        fontFamily={DISPLAY[400]}
        fontSize={10 * nameScale}
        letterSpacing={1.2 * nameScale}
        textAnchor="middle"
      >
        <TextPath href={`#${id('arc')}`} startOffset="50%">
          {name}
        </TextPath>
      </SvgText>
    </>
  );
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${name} ${number}번 영구결번 유니폼`}
      style={{ width: W, paddingTop: 6, paddingBottom: 18, alignSelf: 'center' }}
    >
      {/* 뒤 조명 */}
      <Svg
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: '-30%',
          right: '-30%',
          top: '-12%',
          bottom: '8%',
          opacity: 0.55,
        }}
      >
        <Defs>
          <RadialGradient id={id('glow')} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={col.accent} stopOpacity={0.3} />
            <Stop offset="1" stopColor={col.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id('glow')})`} />
      </Svg>
      {/* 바닥 그림자 */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: 0,
          left: (W - 150) / 2,
          width: 150,
          height: 18,
          transform: motionOK
            ? [{ scaleX: sway.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }) }]
            : [],
          opacity: motionOK ? sway.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) : 1,
        }}
      >
        <Svg width={150} height={18}>
          <Defs>
            <RadialGradient id={id('floor')} cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#000" stopOpacity={0.6} />
              <Stop offset="1" stopColor="#000" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={150} height={18} fill={`url(#${id('floor')})`} />
        </Svg>
      </Animated.View>
      <Animated.View
        style={{
          width: W,
          height: H,
          transform: motionOK
            ? [
                { perspective: 640 },
                {
                  rotateY: sway.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['-18deg', '18deg'],
                  }),
                },
                { rotateX: '3deg' },
                { translateY: sway.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
              ]
            : [],
        }}
      >
        <Svg width={W} height={H} viewBox="0 0 120 124">
          <Defs>
            <ClipPath id={id('clip')}>
              <Path d={J.shirt} />
            </ClipPath>
            <LinearGradient id={id('body')} x1="0" y1="0" x2="1" y2="0">
              {stops(J.bodyShade).map((s) => (
                <Stop key={s.offset} offset={s.offset} stopColor={s.color} stopOpacity={s.o} />
              ))}
            </LinearGradient>
            <LinearGradient id={id('vert')} x1="0" y1="0" x2="0" y2="1">
              {stops(J.vertShade).map((s) => (
                <Stop key={s.offset} offset={s.offset} stopColor={s.color} stopOpacity={s.o} />
              ))}
            </LinearGradient>
            <Path id={id('arc')} d={arc} />
          </Defs>

          <Path d={J.shirt} fill={col.base} />
          <G clipPath={`url(#${id('clip')})`}>
            {J.sleeves.map((s) => (
              <Path key={s.d} d={s.d} fill="#000" opacity={s.o} />
            ))}
            {J.cuffs.map((d) => (
              <Path key={d} d={d} fill={col.trim} />
            ))}
            <Rect width={120} height={124} fill={`url(#${id('body')})`} />
            <Rect width={120} height={124} fill={`url(#${id('vert')})`} />
            <G fill="none" strokeLinecap="round">
              {J.folds.map((f) => (
                <Path
                  key={f.d}
                  d={f.d}
                  stroke={f.o > 0 ? '#fff' : '#000'}
                  strokeOpacity={Math.abs(f.o) * 0.7}
                  strokeWidth={f.w}
                />
              ))}
            </G>
            <G fill="none">
              {J.seams.map((d) => (
                <Path key={d} d={d} stroke="#000" strokeOpacity={0.38} strokeWidth={0.8} />
              ))}
              {J.stitches.map((d) => (
                <Path
                  key={d}
                  d={d}
                  stroke="#fff"
                  strokeOpacity={0.3}
                  strokeWidth={0.45}
                  strokeDasharray="1.2 1.1"
                />
              ))}
            </G>
          </G>
          <Path d={J.collarInside} fill="#000" opacity={0.3} />
          <Path d={J.collar} fill={col.trim} />
          <Path
            d={J.shirt}
            fill="none"
            stroke="#000"
            strokeOpacity={0.35}
            strokeWidth={0.8}
            strokeLinejoin="round"
          />

          {/* 등판 인쇄: 이름(어깨선 곡선을 따라), 등번호(테두리 + 살짝 눌린 그림자). */}
          <G transform="translate(0 1.1)">
            {printText('#000', 0.45)}
            <SvgText
              x={60}
              y={J.numberY}
              textAnchor="middle"
              fontFamily={DISPLAY[400]}
              fontSize={50}
              fill="#000"
              opacity={0.45}
            >
              {String(number)}
            </SvgText>
          </G>
          {printText(col.ink)}
          <SvgText
            x={60}
            y={J.numberY}
            textAnchor="middle"
            fontFamily={DISPLAY[400]}
            fontSize={50}
            fill={col.trim}
            stroke={col.trim}
            strokeWidth={1.3}
          >
            {String(number)}
          </SvgText>
          <SvgText
            x={60}
            y={J.numberY}
            textAnchor="middle"
            fontFamily={DISPLAY[400]}
            fontSize={50}
            fill={col.ink}
          >
            {String(number)}
          </SvgText>
        </Svg>
      </Animated.View>
    </View>
  );
}
