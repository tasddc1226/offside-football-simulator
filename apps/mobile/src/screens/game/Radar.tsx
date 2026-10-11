// 능력치 레이더(웹 Radar.svelte). 현재 능력치 폴리곤(rd-now)은 시즌 시작 대비 값에서 순간 이동하지 않고 부드럽게
// 모핑한다(T-10-003). 점(dot)은 웹처럼 목표 위치에 바로 찍는다. 좌표 계산은 app-core/format(radarData).
import { View } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText, TSpan } from 'react-native-svg';
import { radarData, type RadarPoint } from '@offside/app-core/format';
import type { GameState } from '@offside/game/types';
import { useTween } from '../../sheets/useTween';
import { alpha } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';

// 라벨 'PAC 스피드'는 영문 약자(Barlow)와 한글(시스템 서체)이 섞여 있다. react-native-svg는 섞인 글자의 폭을 잘못 재서
// 가운데·끝 정렬이면 둘이 겹친다 — 두 조각을 왼쪽 정렬로 따로 그리고 시작 위치는 추정 폭으로 직접 계산한다.
const LABEL = rem(0.75);
const GAP = 4;
const abbrWidth = (abbr: string) => abbr.length * LABEL * 0.54;
const labelStart = (p: RadarPoint) => {
  const w = abbrWidth(p.abbr) + GAP + p.labelKr.length * LABEL * 0.86;
  const x = p.anchor === 'middle' ? p.labelX - w / 2 : p.anchor === 'end' ? p.labelX - w : p.labelX;
  // SVG 밖으로 나간 글자는 잘리므로 viewBox(0~300) 안에 가둔다.
  return Math.min(Math.max(x, 1), 299 - w);
};

export function Radar({ s }: { s: GameState }) {
  const c = useColors();
  const d = radarData(s);
  const now = useTween(d.nowVals, 550);
  const nowPoly = d.toPoly(now);
  return (
    <View style={{ maxWidth: 320, alignSelf: 'center', width: '100%', marginTop: 4 }}>
      <Svg
        width="100%"
        viewBox="0 0 300 300"
        style={{ aspectRatio: 1, overflow: 'visible' }}
        accessibilityRole="image"
        accessibilityLabel={d.ariaLabel}
      >
        {d.rings.map((ring) => (
          <Polygon key={ring} points={ring} fill="none" stroke={c.line} strokeWidth={1} />
        ))}
        {d.spokes.map(([x, y], i) => (
          <Line
            key={i}
            x1={d.CX}
            y1={d.CX}
            x2={x.toFixed(1)}
            y2={y.toFixed(1)}
            stroke={c.line}
            strokeWidth={1}
          />
        ))}
        {d.prev ? (
          <Polygon
            points={d.prev}
            fill="none"
            stroke={c.muted}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            opacity={0.8}
          />
        ) : null}
        <Polygon
          points={nowPoly}
          fill={alpha(c.accent, 0.28)}
          stroke={c.accent}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {d.dots.map(([x, y], i) => (
          <Circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={3} fill={c.accent} />
        ))}
        {d.points.map((p) => {
          const x = labelStart(p);
          return [
            <SvgText
              key={`${p.key}-a`}
              x={x.toFixed(1)}
              y={p.labelY.toFixed(1)}
              fill={c.muted}
              fontFamily={DISPLAY[700]}
              fontSize={LABEL}
              letterSpacing={LABEL * 0.08}
            >
              {p.abbr}
            </SvgText>,
            <SvgText
              key={`${p.key}-k`}
              x={(x + abbrWidth(p.abbr) + GAP).toFixed(1)}
              y={p.labelY.toFixed(1)}
              fill={c.muted}
              fontSize={LABEL}
              fontWeight="600"
            >
              {p.labelKr}
            </SvgText>,
          ];
        })}
        {d.points.map((p) => (
          <SvgText
            key={`${p.key}-v`}
            x={p.labelX.toFixed(1)}
            y={(p.labelY + 20).toFixed(1)}
            textAnchor={p.anchor}
            fill={c.ink}
            fontFamily={DISPLAY[700]}
            fontSize={rem(1.25)}
          >
            {String(p.value)}
            {p.delta > 0 ? (
              <TSpan fill={c.good} fontSize={rem(0.8125)}>{` +${p.delta}`}</TSpan>
            ) : p.delta < 0 ? (
              <TSpan fill={c.bad} fontSize={rem(0.8125)}>{` ${p.delta}`}</TSpan>
            ) : null}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
