// 해외 이적 비행 시트(웹 sheets/Flight.svelte, T-11-039): 육지 점 지도 위로 지금 나라 공항에서 새 리그 나라 공항까지
// 비행기가 날아가고, 지나간 경로가 그려진다. 도착하면 도착 공항에 고리가 퍼진다. 동작 줄이기면 경로·비행기를 도착한
// 모습으로만 그린다. 진행률 p는 requestAnimationFrame으로 올리고, 매 프레임 바뀌는 건 경로·비행기·진행 막대뿐이라
// 큰 정적 문자열인 육지 점 path는 memo로 다시 그리지 않는다.
import { memo, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import { alongRoute, flightProgress, type FlightMap } from '@offside/app-core/flight';
import type { SheetView } from '@offside/app-core/sheets';
import { prefs } from '../store';
import { useColors } from '../theme/useColors';
import { DISPLAY, rem } from '../theme/type';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';

/** 웹 Flight.svelte의 비행기 모양(코가 +x). */
const PLANE =
  'M10 0 3.5-1.4-1-8h-2.6l2.2 6.6H-5.6L-7.8-4h-1.8l1.3 4-1.3 4h1.8l2.2-2.6h4.2L-3.6 8H-1l4.5-6.6Z';
/** 도착 고리가 한 번 퍼지는 시간(웹 ping 0.9s). */
const PING_MS = 900;

/** 육지 점 + 점선 밑그림 경로 — 장면 동안 안 바뀐다. */
const Backdrop = memo(function Backdrop({
  dots,
  route,
  land,
  ghost,
}: {
  dots: string;
  route: string;
  land: string;
  ghost: string;
}) {
  return (
    <>
      <Path d={dots} fill={land} />
      <Path
        d={route}
        fill="none"
        stroke={ghost}
        strokeOpacity={0.35}
        strokeWidth={1.2}
        strokeDasharray={[3, 4]}
      />
    </>
  );
});

/** 도착 공항에 퍼지는 고리(웹 .ping: 1배 → 3.2배, 선이 옅어진다). 동작 줄이기면 가만히 있는 고리. */
function Ping({ color, motionOK }: { color: string; motionOK: boolean }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!motionOK) return;
    const t0 = performance.now();
    let raf = 0;
    const frame = () => {
      setT(((performance.now() - t0) % PING_MS) / PING_MS);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [motionOK]);
  const e = 1 - (1 - t) * (1 - t);
  return (
    <Circle
      r={motionOK ? 4 * (1 + 2.2 * e) : 4}
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeOpacity={motionOK ? 0.9 * (1 - e) : 1}
    />
  );
}

/** 2차 베지어 경로 길이 — react-native-svg는 pathLength가 미덥지 않아 점 41개를 이어 어림한다. */
function routeLength(m: Pick<FlightMap, 'from' | 'to' | 'ctrl'>): number {
  let len = 0;
  let prev = alongRoute(m, 0);
  for (let i = 1; i <= 40; i++) {
    const q = alongRoute(m, i / 40);
    len += Math.hypot(q.x - prev.x, q.y - prev.y);
    prev = q;
  }
  return len;
}

export function Flight({ v }: { v: Extract<SheetView, { kind: 'flight' }> }) {
  const s = useSnapshot(v);
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const [p, setP] = useState(motionOK ? 0 : 1);

  useEffect(() => {
    if (!motionOK) {
      setP(1);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const frame = () => {
      // 원본 뷰를 읽는다 — 이 루프는 done이 켜지는 순간을 구독 없이 바로 본다.
      const next = v.done ? 1 : flightProgress(performance.now() - t0);
      setP(next);
      if (next < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [motionOK, v]);

  const m = s.map;
  const len = useMemo(() => routeLength(m), [m]);
  // 끝점이 어림 길이보다 살짝 모자라지 않게 여유를 둔다.
  const dash = len + 2;
  const plane = alongRoute(m, p);
  const arrived = p >= 1;

  return (
    <>
      <Txt v="eyebrow">{s.eyebrow}</Txt>
      <Txt v="h2" accessibilityRole="header">
        {s.title}
      </Txt>
      <Txt v="sm" tone="muted" style={{ marginTop: -6 }}>
        {s.sub}
      </Txt>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${s.from.city}에서 ${s.to.city}까지 비행 경로`}
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: c.pitch,
          aspectRatio: 320 / 190,
        }}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${m.w} ${m.h}`}>
          <Backdrop dots={m.dots} route={m.route} land={c.chalk} ghost={c.onPitch} />
          <Path
            d={m.route}
            fill="none"
            stroke={c.pitchAccent}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeDasharray={[dash, dash]}
            strokeDashoffset={dash * (1 - p)}
          />
          <G transform={`translate(${m.from.x} ${m.from.y})`}>
            <Circle r={3.5} fill={c.onPitch} />
            <Hub code={s.from.code} fill={c.onPitch} />
          </G>
          <G transform={`translate(${m.to.x} ${m.to.y})`}>
            {arrived ? <Ping color={c.pitchAccent} motionOK={motionOK} /> : null}
            <Circle r={3.5} fill={arrived ? c.pitchAccent : c.onPitch} />
            <Hub code={s.to.code} fill={c.onPitch} />
          </G>
          <G transform={`translate(${plane.x} ${plane.y}) rotate(${plane.deg})`}>
            <Path d={PLANE} fill={c.onPitch} stroke={c.pitch} strokeWidth={0.8} />
          </G>
        </Svg>
      </View>
      {/* 탑승권 줄: 출발 · 진행 막대 · 도착. 지도 설명이 이미 있어 화면 낭독에서는 뺀다. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <Airport code={s.from.code} city={s.from.city} />
        <View
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor: c.line,
            overflow: 'hidden',
          }}
        >
          <View style={{ width: `${p * 100}%`, height: '100%', backgroundColor: c.accent }} />
        </View>
        <Airport code={s.to.code} city={s.to.city} end />
      </View>
      {s.skip ? (
        <Press
          testID="an-skip"
          onPress={() => v.skip?.()}
          hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
          style={{ alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 2 }}
        >
          <Txt tone="muted" style={{ fontSize: rem(0.75), textDecorationLine: 'underline' }}>
            건너뛰기
          </Txt>
        </Press>
      ) : null}
    </>
  );
}

/** 지도 위 공항 코드(웹 .hub text) — 점 아래 16에 가운데 맞춤(비행기가 위에서 내려와 겹치지 않게). */
function Hub({ code, fill }: { code: string; fill: string }) {
  return (
    <SvgText
      y={16}
      textAnchor="middle"
      fontFamily={DISPLAY[700]}
      fontSize={11}
      letterSpacing={0.44}
      fill={fill}
    >
      {code}
    </SvgText>
  );
}

/** 탑승권 줄의 공항 한쪽: 큰 코드 + 도시. */
function Airport({ code, city, end }: { code: string; city: string; end?: boolean }) {
  return (
    <View style={{ alignItems: end ? 'flex-end' : 'flex-start' }}>
      <Txt
        style={{
          fontFamily: DISPLAY[700],
          fontSize: rem(1.5),
          lineHeight: rem(1.5) * 1.1,
          letterSpacing: rem(1.5) * 0.03,
        }}
      >
        {code}
      </Txt>
      <Txt tone="muted" style={{ fontSize: rem(0.75), lineHeight: rem(0.75) * 1.1 }}>
        {city}
      </Txt>
    </View>
  );
}
