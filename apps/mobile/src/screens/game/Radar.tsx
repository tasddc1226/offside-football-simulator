// 능력치 레이더(웹 Radar.svelte). 현재 능력치 폴리곤(rd-now)은 시즌 시작 대비 값에서 순간 이동하지 않고 부드럽게
// 모핑한다(T-10-003). 점(dot)은 웹처럼 목표 위치에 바로 찍는다. 좌표 계산은 app-core/format(radarData).
import { View } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText, TSpan } from 'react-native-svg';
import { radarData } from '@offside/app-core/format';
import type { GameState } from '@offside/game/types';
import { useTween } from '../../sheets/useTween';
import { alpha } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';

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
        {d.points.map((p) => (
          <SvgText
            key={`${p.key}-a`}
            x={p.labelX.toFixed(1)}
            y={p.labelY.toFixed(1)}
            textAnchor={p.anchor}
            fill={c.muted}
            fontFamily={DISPLAY[700]}
            fontSize={rem(0.75)}
            letterSpacing={rem(0.75) * 0.08}
          >
            {`${p.abbr} `}
            <TSpan fontWeight="600" letterSpacing={0}>
              {p.labelKr}
            </TSpan>
          </SvgText>
        ))}
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
