// 시즌별 몸값 꺾은선 그래프(웹 ValueChart.svelte, T-10-106): 커리어 탭과 은퇴 크레딧이 같이 쓴다.
// 화면에 들어오면 선이 왼쪽부터 그려지고 점이 차례로 올라온다(동작 줄이기면 처음부터 다 보인다).
// 시즌마다 세로 한 칸이 버튼이라, 칸을 누르면 그 시즌 값을 위에 보여 준다.
// go: 그려도 되는가 — 은퇴 크레딧은 장면이 올라오면 true를 준다. 안 주면(커리어 탭) 화면 아래쪽 15%를 넘어 들어올 때 스스로 잰다.
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import type { CareerRecord } from '@offside/game/types';
import { fmtValue, seasonLabelOf } from '@offside/app-core/format';
import { valuePoints } from '@offside/app-core/legendReport';
import { peakValue } from '@offside/contracts/market-value';
import { POP, useProgress } from '../screens/retired/credit';
import { prefs } from '../store';
import { alpha } from '../theme/colors';
import { useColors } from '../theme/useColors';
import { rem } from '../theme/type';
import { Txt } from '../ui/Txt';

type Pt = ReturnType<typeof valuePoints>[number];

export function ValueChart({
  rows,
  film = false,
  go: goProp,
}: {
  rows: CareerRecord[];
  /** 은퇴 크레딧의 어두운 필름 색(웹 .film-value .value-chart). */
  film?: boolean;
  go?: boolean;
}) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const peakV = peakValue(rows);
  const pts = valuePoints(rows, peakV?.value ?? 0);
  const [pick, setPick] = useState<number | null>(null);
  const picked = pick == null ? null : pts[pick];

  const col = film
    ? {
        line: c.pitchAccent,
        dot: c.onPitch,
        bg: '#08120d',
        muted: '#a9b8ae',
        rule: 'rgba(238,244,239,0.14)',
      }
    : { line: c.accent, dot: c.ink, bg: c.surface, muted: c.muted, rule: c.line };
  const plotH = film ? 120 : 96;
  /** 필름은 장면이 올라온 뒤에 선을 긋는다(웹 transition-delay 0.35s). */
  const lead = film ? 350 : 0;

  const [goSelf, setGoSelf] = useState(false);
  const box = useRef<View>(null);
  useEffect(() => {
    if (goProp !== undefined || goSelf || !motionOK) return;
    const t = setInterval(() => {
      box.current?.measureInWindow((_x, y, _w, h) => {
        if (y < Dimensions.get('window').height * 0.85 && y + h > 0) setGoSelf(true);
      });
    }, 150);
    return () => clearInterval(t);
  }, [goProp, goSelf, motionOK]);
  const go = goProp ?? (!motionOK || goSelf);

  const [w, setW] = useState(0);
  const draw = useProgress(go, 1200, {
    delay: lead,
    easing: Easing.bezier(0.45, 0, 0.25, 1),
    native: false,
  });

  if (!peakV) return null;
  const n = pts.length;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x * w},${10 + (p.y / 100) * plotH}`).join('');
  const last = pts[n - 1]!;
  const first = pts[0]!;
  const area = `${line}L${last.x * w},${10 + plotH}L${first.x * w},${10 + plotH}Z`;
  const sw = Math.max(12, w / n);

  return (
    <View ref={box} collapsable={false} testID="value-chart">
      <View style={{ minHeight: rem(0.75) * 1.5 * 1.5, marginBottom: 4 }} testID="value-pick">
        {picked ? (
          <Txt v="xs" style={{ color: col.dot }}>
            {picked.r.mil ? picked.r.year : seasonLabelOf(picked.r)} ({picked.r.age}) ·{' '}
            {picked.r.club} ·{' '}
            <Txt v="xs" bold>
              {fmtValue(picked.v)}
            </Txt>
          </Txt>
        ) : (
          <Txt v="xs" style={{ color: col.muted }}>
            시즌별 몸값 · 점을 누르면 시즌 값을 보여 줘요
          </Txt>
        )}
      </View>
      <View
        accessibilityLabel="시즌별 몸값"
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={{
          height: plotH,
          marginHorizontal: 6,
          borderBottomWidth: 1,
          borderBottomColor: col.rule,
        }}
      >
        {w > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              top: -10,
              height: plotH + 20,
              overflow: 'hidden',
              // 웹 clip-path inset(-10px …): 오른쪽 끝 선 굵기만큼 더 보인다.
              width: draw.interpolate({ inputRange: [0, 1], outputRange: [0, w + 10] }),
            }}
          >
            <Svg width={w + 10} height={plotH + 20}>
              <Path d={area} fill={alpha(col.line, 0.16)} />
              <Path
                d={line}
                fill="none"
                stroke={col.line}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </Svg>
          </Animated.View>
        ) : null}
        {w > 0
          ? pts.map((p, i) => (
              <Dot
                key={i}
                p={p}
                i={i}
                w={w}
                sw={sw}
                plotH={plotH}
                on={i === pick}
                peak={p.r === peakV.row}
                go={go}
                lead={lead}
                col={col}
                onPress={() => setPick(pick === i ? null : i)}
              />
            ))
          : null}
        {w > 0
          ? pts.map((p, i) =>
              p.r === peakV.row ? (
                <PeakTag
                  key={i}
                  p={p}
                  w={w}
                  plotH={plotH}
                  go={go}
                  delay={film ? 1650 : 1300}
                  color={col.line}
                />
              ) : null,
            )
          : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        <Txt v="xs" style={{ color: col.muted }}>
          {rows[0]!.year}
        </Txt>
        <Txt v="xs" style={{ color: col.muted }}>
          {rows[rows.length - 1]!.year}
        </Txt>
      </View>
    </View>
  );
}

/** 시즌 한 칸 = 세로 한 줄 버튼. 점은 위에서 y% 자리, 고른 칸은 점 둘레 링 + 아래로 점선 안내선. */
function Dot({
  p,
  i,
  w,
  sw,
  plotH,
  on,
  peak,
  go,
  lead,
  col,
  onPress,
}: {
  p: Pt;
  i: number;
  w: number;
  sw: number;
  plotH: number;
  on: boolean;
  peak: boolean;
  go: boolean;
  lead: number;
  col: { line: string; dot: string; bg: string };
  onPress: () => void;
}) {
  const scale = useProgress(go, 400, { delay: lead + p.x * 1100, easing: POP });
  const r = peak ? 6 : 4;
  const y = (p.y / 100) * plotH;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p.r.year} ${p.r.club} 몸값 ${fmtValue(p.v)}`}
      accessibilityState={{ selected: on }}
      testID={`value-dot-${i}`}
      onPress={onPress}
      style={{ position: 'absolute', top: 0, bottom: 0, left: p.x * w - sw / 2, width: sw }}
    >
      {on ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: sw / 2,
            top: y,
            bottom: 0,
            borderLeftWidth: 1,
            borderStyle: 'dashed',
            borderColor: col.dot,
          }}
        />
      ) : null}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: sw / 2 - r - 2,
          top: y - r - 2,
          width: (r + 2) * 2,
          height: (r + 2) * 2,
          borderRadius: r + 2,
          // 웹 box-shadow 0 0 0 2px 바탕색 — 점 둘레를 바탕색으로 살짝 띄운다.
          backgroundColor: col.bg,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale }],
        }}
      >
        <View
          style={{
            width: r * 2,
            height: r * 2,
            borderRadius: r,
            backgroundColor: peak ? col.line : col.dot,
          }}
        />
      </Animated.View>
      {on ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: sw / 2 - r - 4,
            top: y - r - 4,
            width: (r + 4) * 2,
            height: (r + 4) * 2,
            borderRadius: r + 4,
            borderWidth: 2,
            borderColor: col.dot,
          }}
        />
      ) : null}
    </Pressable>
  );
}

/** 최고 몸값 꼬리표 — 점 위에 뜨고, 가장자리에서는 x 비율만큼 안쪽으로 밀려 잘리지 않는다. */
function PeakTag({
  p,
  w,
  plotH,
  go,
  delay,
  color,
}: {
  p: Pt;
  w: number;
  plotH: number;
  go: boolean;
  delay: number;
  color: string;
}) {
  const c = useColors();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const scale = useProgress(go, 450, { delay, easing: POP });
  // 자리(translate)는 바깥 View, 튀어 오르는 크기(scale)는 안쪽 Animated.View가 맡는다 — 한 transform에 섞으면
  // 네이티브 애니메이션이 transform을 가져가서, 나중에 잰 폭으로 고친 translateX가 반영되지 않는다.
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{
        position: 'absolute',
        left: p.x * w,
        top: (p.y / 100) * plotH,
        transform: [{ translateX: -p.x * size.w }, { translateY: -size.h - 10 }],
      }}
    >
      <Animated.View
        style={{
          paddingVertical: 1,
          paddingHorizontal: 6,
          borderRadius: 999,
          backgroundColor: color,
          transform: [{ scale }],
        }}
      >
        <Txt style={{ fontSize: rem(0.6875), fontWeight: '700', color: c.accentInk }}>
          {fmtValue(p.v)}
        </Txt>
      </Animated.View>
    </View>
  );
}
