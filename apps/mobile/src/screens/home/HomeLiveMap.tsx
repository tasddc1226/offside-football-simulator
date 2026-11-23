// T-11-815 홈 라이브 지도(웹 HomeLive.svelte의 .live-map). 지금 뛰는 선수들이 있는 나라를 작은 세계 지도 위 점으로
// 보여 준다. 점 위치 · 크기 · 고를 나라는 app-core live-map이 정하고, 여기서는 그리기와 누르기만 맡는다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import type { LiveEvent, LiveMap } from '@offside/contracts';
import {
  LIVE_MAP_H,
  LIVE_MAP_W,
  latestIn,
  liveMapDots,
  liveSpots,
  pickSpot,
  spotOfLeague,
} from '@offside/app-core/live-map';
import { what, who } from '@offside/app-core/homeLive';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, ScrollView, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { homeLiveText as L } from '@offside/app-core/i18n/ko/homeLive';
import { DISPLAY, rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Press, Txt } from '../../ui';

const nfmt = (n: number) => n.toLocaleString('en-US');

/** map이 null이면 응답 전 자리표시 — 머리 · 지도 판 · 칩 줄이 같은 높이를 잡는다. */
export function HomeLiveMap({
  map,
  feed,
  motionOK,
}: {
  map: LiveMap | null;
  feed: LiveEvent[];
  motionOK: boolean;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const spots = useMemo(() => liveSpots(map), [map]);
  const drawn = useMemo(() => [...spots].reverse(), [spots]);
  const dots = useMemo(() => liveMapDots(), []);
  const latestSeason = feed.find((e) => e.kind === 'season');
  const pingCode =
    latestSeason && latestSeason.kind === 'season' ? spotOfLeague(latestSeason.league) : null;
  // 새 시즌 소식이 들어오면 고른 나라를 비워 그 소식의 나라를 따라간다.
  const latestKey = latestSeason ? `${latestSeason.at}:${latestSeason.club}` : '';
  useEffect(() => setPicked(null), [latestKey]);
  const sel = pickSpot(spots, feed, picked);
  const selLatest = sel ? latestIn(feed, sel.code) : undefined;
  const scale = width / LIVE_MAP_W;
  const n = nfmt(map?.careers ?? 0);
  const text = L.mapHeadline({ n });
  const at = text.indexOf(n);
  const [before, after] =
    at < 0 ? [`${text} `, ''] : [text.slice(0, at), text.slice(at + n.length)];
  const ping = drawn.find((s) => s.code === pingCode);

  return (
    <View
      testID="home-live-map"
      style={{
        backgroundColor: c.pitch,
        borderRadius: RADIUS.md,
        padding: 12,
        paddingBottom: 10,
        gap: 6,
      }}
    >
      <View style={{ minHeight: 48 }}>
        {map ? (
          <>
            <Txt style={{ color: c.onPitch, fontSize: rem(FONT.body2), fontWeight: '600' }}>
              {before}
              <Txt
                style={{
                  color: c.pitchAccent,
                  fontFamily: DISPLAY[700],
                  fontSize: rem(2.125),
                  lineHeight: rem(2.25),
                }}
              >
                {n}
              </Txt>
              {after}
            </Txt>
            <Txt style={{ color: c.onPitch, opacity: 0.78, fontSize: rem(FONT.caption2) }}>
              {L.mapSub({ nations: map.nations, countries: spots.length })}
            </Txt>
          </>
        ) : null}
      </View>

      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible={!!map}
        accessibilityRole="image"
        accessibilityLabel={map ? L.mapA11y({ countries: spots.length, n }) : undefined}
        style={{ width: '100%', aspectRatio: LIVE_MAP_W / LIVE_MAP_H }}
      >
        {map && width > 0 ? (
          <>
            <Svg width="100%" height="100%" viewBox={`0 0 ${LIVE_MAP_W} ${LIVE_MAP_H}`}>
              <Path
                d={dots.d}
                stroke={c.onPitch}
                strokeOpacity={0.2}
                strokeWidth={dots.w}
                strokeLinecap="round"
                fill="none"
              />
              {drawn.map((s) => {
                const on = s.code === sel?.code;
                return (
                  <Circle
                    key={s.code}
                    cx={s.x}
                    cy={s.y}
                    r={s.r}
                    fill={c.pitchAccent}
                    fillOpacity={on ? 1 : 0.78}
                    stroke={on ? c.onPitch : c.pitch}
                    strokeWidth={on ? 1.4 : 0.8}
                  />
                );
              })}
            </Svg>
            {ping && motionOK ? (
              <Ping
                x={ping.x * scale}
                y={ping.y * scale}
                size={ping.r * 2 * scale}
                color={c.pitchAccent}
              />
            ) : null}
            {sel ? (
              <View
                key={sel.code}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  // 위쪽 나라(유럽 등)는 점 아래로 — 위로 띄우면 제목을 가린다.
                  ...(sel.y < LIVE_MAP_H * 0.45
                    ? { top: sel.y * scale + 12 }
                    : { bottom: (LIVE_MAP_H - sel.y) * scale + 10 }),
                  ...(sel.x > LIVE_MAP_W * 0.62
                    ? { right: (LIVE_MAP_W - sel.x) * scale - 14 }
                    : { left: sel.x * scale - 14 }),
                  maxWidth: 220,
                  backgroundColor: c.surface,
                  borderRadius: RADIUS.sm,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  gap: 1,
                  shadowColor: '#080e0b',
                  shadowOpacity: 0.35,
                  shadowRadius: 7,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 4,
                }}
              >
                <Txt bold style={{ color: c.accentText, fontSize: rem(FONT.caption2) }}>
                  {L.spotCount({ country: sel.country, n: sel.n })}
                </Txt>
                <Txt numberOfLines={1} style={{ fontSize: rem(FONT.caption), fontWeight: '600' }}>
                  {selLatest ? `${who(selLatest)} ${what(selLatest)}` : L.spotEmpty}
                </Txt>
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -12 }}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 6, minHeight: 32 }}
      >
        {spots.slice(0, 6).map((s) => {
          const on = s.code === sel?.code;
          return (
            <Press
              key={s.code}
              testID={`live-spot-${s.code}`}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={L.spotA11y({ country: s.country, n: s.n })}
              onPress={() => setPicked(s.code)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                minHeight: 32,
                paddingHorizontal: 12,
                borderRadius: RADIUS.pill,
                borderWidth: 1,
                borderColor: on ? c.pitchAccent : c.chalk,
                backgroundColor: on ? c.pitchAccent : 'transparent',
              }}
            >
              <Txt style={{ color: on ? c.accentInk : c.onPitch, fontSize: rem(FONT.caption) }}>
                {s.country}
              </Txt>
              <Txt
                style={{
                  color: on ? c.accentInk : c.onPitch,
                  fontFamily: DISPLAY[700],
                  fontSize: rem(FONT.body2),
                }}
              >
                {s.n}
              </Txt>
            </Press>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** 가장 최근 소식이 난 나라에서 고리가 퍼진다(웹 .live-map-ping). */
function Ping({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: v.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0.55, 0, 0] }),
        transform: [
          { scale: v.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 3.2, 3.2] }) },
        ],
      }}
    />
  );
}
