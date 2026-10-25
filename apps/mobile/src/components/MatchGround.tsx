// T-11-492 문자중계 2D 그라운드(웹 team/MatchGround.svelte) — 22명과 공을 그라운드 위에 그리고, 줄마다 app-core
// matchGround가 정한 자리로 옮긴다. 위치는 네이티브 드라이버 transform으로만 움직이고(SVG 필터 없음), 동작 줄이기면 자리만
// 바꾼다. 위치는 연출이라 결과와 상관없다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';
import {
  arrowShape,
  type GroundArrow,
  type GroundSide,
  type GroundSpot,
  type Pt,
} from '@offside/app-core/matchGround';
import { teamLiveText as L } from '@offside/app-core/i18n/ko/teamLive';
import { DISPLAY, rem } from '../theme/type';
import { useColors } from '../theme/useColors';
import { Txt } from '../ui/Txt';

const HOME_INK = '#1b1405';
const AWAY = '#22324f';
const AWAY_INK = '#f2f6f1';
const MOVE = Easing.bezier(0.45, 0.05, 0.35, 1);
const BALL_MOVE = Easing.bezier(0.3, 0.1, 0.3, 1);

/** 그라운드 좌표(0~100)를 픽셀 자리로 옮기는 값. 처음엔 그 자리에 두고, 바뀌면 dur 동안 미끄러진다. */
function useSlide(
  x: number,
  y: number,
  dur: number,
  easing: (t: number) => number,
  motionOK: boolean,
) {
  const v = useRef(new Animated.ValueXY({ x, y })).current;
  useEffect(() => {
    if (!motionOK || dur <= 0) return v.setValue({ x, y });
    const a = Animated.timing(v, {
      toValue: { x, y },
      duration: dur,
      easing,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [v, x, y, dur, easing, motionOK]);
  return v;
}

function Dot({
  p,
  w,
  h,
  size,
  dur,
  motionOK,
}: {
  p: GroundSpot;
  w: number;
  h: number;
  size: number;
  dur: number;
  motionOK: boolean;
}) {
  const c = useColors();
  const pos = useSlide((p.x / 100) * w, (p.y / 100) * h, dur, MOVE, motionOK);
  const home = p.side === 'home';
  const ink = home ? HOME_INK : AWAY_INK;
  const ring = p.on || (home && p.mate);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: -size / 2,
        top: -size / 2,
        zIndex: p.on ? 4 : p.mate ? 3 : 2,
        opacity: p.dim ? 0.45 : 1,
        transform: [{ translateX: pos.x }, { translateY: pos.y }],
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: home ? c.pitchAccent : AWAY,
          borderWidth: 1.5,
          borderColor: ink,
          transform: [{ scale: p.on ? 1.25 : 1 }],
          ...(ring
            ? {
                shadowColor: home ? c.pitchAccent : '#f2f6f1',
                shadowOpacity: 0.9,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 0 },
                elevation: 3,
              }
            : {}),
        }}
      >
        <Txt
          style={{
            fontFamily: DISPLAY[700],
            fontSize: size * 0.56,
            lineHeight: size * 0.7,
            color: ink,
            fontVariant: ['tabular-nums'],
          }}
        >
          {p.no}
        </Txt>
      </View>
      {p.tag ? (
        <View
          style={{
            position: 'absolute',
            top: size + 3,
            left: size / 2 - 60,
            width: 120,
            alignItems: 'center',
          }}
        >
          <Txt
            numberOfLines={1}
            style={{
              paddingHorizontal: 5,
              paddingVertical: 1,
              borderRadius: 4,
              overflow: 'hidden',
              backgroundColor: 'rgba(10,24,17,0.85)',
              color: '#f2f6f1',
              fontSize: 10,
              lineHeight: 14,
              fontWeight: '500',
            }}
          >
            {p.tag}
          </Txt>
        </View>
      ) : null}
    </Animated.View>
  );
}

function Ball({
  b,
  w,
  h,
  dur,
  motionOK,
}: {
  b: Pt;
  w: number;
  h: number;
  dur: number;
  motionOK: boolean;
}) {
  const pos = useSlide(
    (b[0] / 100) * w,
    (b[1] / 100) * h,
    Math.round(dur * 0.8),
    BALL_MOVE,
    motionOK,
  );
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: -4.5,
        top: -4.5,
        zIndex: 5,
        width: 9,
        height: 9,
        borderRadius: 4.5,
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#0a1811',
        transform: [{ translateX: pos.x }, { translateY: pos.y }],
      }}
    />
  );
}

/** 골망 번쩍임과 GOAL! 배너(웹 mg-net · mg-pop). */
function GoalFx({ goal, motionOK }: { goal: GroundSide; motionOK: boolean }) {
  const c = useColors();
  const net = useRef(new Animated.Value(motionOK ? 0.2 : 1)).current;
  const pop = useRef(new Animated.Value(motionOK ? 0 : 1)).current;
  useEffect(() => {
    if (!motionOK) return;
    const a = Animated.parallel([
      Animated.timing(pop, {
        toValue: 1,
        duration: 500,
        easing: Easing.bezier(0.2, 1.4, 0.4, 1),
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(net, { toValue: 1, duration: 360, useNativeDriver: true }),
          Animated.timing(net, { toValue: 0.3, duration: 540, useNativeDriver: true }),
        ]),
        { iterations: 2 },
      ),
    ]);
    a.start();
    return () => a.stop();
  }, [motionOK, net, pop]);
  return (
    <>
      <Animated.View
        style={{
          position: 'absolute',
          top: '39%',
          height: '22%',
          width: 6,
          borderRadius: 2,
          backgroundColor: c.pitchAccent,
          opacity: net,
          ...(goal === 'away' ? { left: 0 } : { right: 0 }),
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 6,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
          transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
        }}
      >
        <Txt
          style={{
            fontFamily: DISPLAY[800],
            fontSize: rem(3),
            lineHeight: rem(3) * 1.1,
            letterSpacing: 0.06 * rem(3),
            color: c.pitchAccent,
            textShadowColor: 'rgba(0,0,0,0.55)',
            textShadowRadius: 10,
            textShadowOffset: { width: 0, height: 2 },
          }}
        >
          GOAL!
        </Txt>
      </Animated.View>
    </>
  );
}

export function MatchGround({
  spots,
  ball,
  dur,
  goal = null,
  trail = [],
  arrows = [],
  home,
  away,
  motionOK,
}: {
  spots: readonly GroundSpot[];
  ball: Pt;
  /** 이번 동작의 전환 시간(ms). */
  dur: number;
  /** 골이 들어간 팀(골망 · GOAL 배너). */
  goal?: GroundSide | null;
  /** 골까지 공이 지난 길. */
  trail?: readonly Pt[];
  /** 장면 카드 선택지 화살표. */
  arrows?: readonly GroundArrow[];
  home: string;
  away: string;
  motionOK: boolean;
}) {
  const c = useColors();
  const [w, setW] = useState(0);
  const h = (w * 68) / 105;
  const size = Math.max(16, Math.min(24, w * 0.05));
  const px = (p: Pt) => `${(p[0] / 100) * w},${(p[1] / 100) * h}`;
  // 그라운드 표시(105 × 68 m)를 픽셀로.
  const mx = w / 105;
  const my = h / 68;
  const m = (x: number, y: number) => `${x * mx} ${y * my}`;
  const markings = [
    `M${m(52.5, 1.5)}L${m(52.5, 66.5)}`,
    `M${m(1.5, 13.85)}H${18 * mx}V${54.15 * my}H${1.5 * mx}`,
    `M${m(1.5, 24.85)}H${7 * mx}V${43.15 * my}H${1.5 * mx}`,
    `M${m(103.5, 13.85)}H${87 * mx}V${54.15 * my}H${103.5 * mx}`,
    `M${m(103.5, 24.85)}H${98 * mx}V${43.15 * my}H${103.5 * mx}`,
    `M${m(18, 26.7)}Q${m(22.5, 34)} ${m(18, 41.3)}`,
    `M${m(87, 26.7)}Q${m(82.5, 34)} ${m(87, 41.3)}`,
  ];
  const arrowD = (a: GroundArrow) => {
    const q = arrowShape(a).ctrl;
    return `M${px(a.from)}${q ? `Q${px(q)} ` : 'L'}${px(a.to)}`;
  };

  return (
    <View
      testID="match-ground"
      accessible
      accessibilityLabel={L.groundAria({ home, away })}
      style={{ gap: 5 }}
    >
      <View
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={{
          height: h || undefined,
          aspectRatio: w ? undefined : 105 / 68,
          borderRadius: RADIUS.md,
          overflow: 'hidden',
          backgroundColor: c.pitch,
        }}
      >
        {w ? (
          <>
            {Array.from({ length: 5 }, (_, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: ((i * 2 + 1) * w) / 10,
                  width: w / 10,
                  backgroundColor: c.pitch2,
                }}
              />
            ))}
            <Svg width={w} height={h} style={{ position: 'absolute' }}>
              <Rect
                x={1.5 * mx}
                y={1.5 * my}
                width={102 * mx}
                height={65 * my}
                fill="none"
                stroke={c.chalk}
                strokeWidth={1}
              />
              <Circle
                cx={52.5 * mx}
                cy={34 * my}
                r={9.15 * mx}
                fill="none"
                stroke={c.chalk}
                strokeWidth={1}
              />
              {markings.map((d) => (
                <Path key={d} d={d} fill="none" stroke={c.chalk} strokeWidth={1} />
              ))}
            </Svg>
            {arrows.length ? (
              <View
                style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(6,18,12,0.28)' }}
              />
            ) : null}
            {goal && trail.length > 1 ? (
              <Svg width={w} height={h} style={{ position: 'absolute', zIndex: 3 }}>
                <Polyline
                  points={trail.map(px).join(' ')}
                  fill="none"
                  stroke="rgba(255,255,255,0.75)"
                  strokeWidth={1.6}
                  strokeDasharray="2 4"
                  strokeLinecap="round"
                />
              </Svg>
            ) : null}
            {arrows.length ? (
              <>
                <Svg width={w} height={h} style={{ position: 'absolute', zIndex: 3 }}>
                  {arrows.map((a) => (
                    <Path
                      key={a.n}
                      d={arrowD(a)}
                      fill="none"
                      stroke={c.pitchAccent}
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      strokeLinecap="round"
                    />
                  ))}
                  {arrows.map((a) => (
                    <Circle
                      key={`e${a.n}`}
                      cx={(a.to[0] / 100) * w}
                      cy={(a.to[1] / 100) * h}
                      r={3}
                      fill={c.pitchAccent}
                    />
                  ))}
                </Svg>
                {arrows.map((a) => {
                  const k = arrowShape(a).key;
                  return (
                    <View
                      key={`k${a.n}`}
                      style={{
                        position: 'absolute',
                        zIndex: 4,
                        left: (k[0] / 100) * w - 11,
                        top: (k[1] / 100) * h - 11,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: c.pitch,
                        borderWidth: 1.5,
                        borderColor: c.pitchAccent,
                      }}
                    >
                      <Txt
                        style={{
                          fontFamily: DISPLAY[700],
                          fontSize: 12,
                          lineHeight: 14,
                          color: c.pitchAccent,
                        }}
                      >
                        {a.n}
                      </Txt>
                    </View>
                  );
                })}
              </>
            ) : null}
            {spots.map((p) => (
              <Dot key={p.key} p={p} w={w} h={h} size={size} dur={dur} motionOK={motionOK} />
            ))}
            <Ball b={ball} w={w} h={h} dur={dur} motionOK={motionOK} />
            {goal ? <GoalFx goal={goal} motionOK={motionOK} /> : null}
          </>
        ) : null}
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}
      >
        <Txt tone="muted" style={{ fontSize: rem(FONT.caption) }}>
          {L.attackHome({ t: home })}
        </Txt>
        <Txt tone="muted" style={{ fontSize: rem(FONT.caption) }}>
          {L.attackAway({ t: away })}
        </Txt>
      </View>
    </View>
  );
}
