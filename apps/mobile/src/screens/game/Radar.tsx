// T-11-200 훈련 방향 육각형(시즌 탭, 웹 Radar.svelte). 능력치 축 이름표가 곧 그 능력치 훈련 버튼이다 — 약한 곳을 보고
// 그 축을 눌러 키운다. 고른 훈련이 올리는 축(피지컬은 피지컬·스피드, 개인 코치는 전부)에 바깥 화살표를 그리고, 주력 능력치는 ★,
// 자기 투자 특훈의 축은 점선 화살표.
// 현재 능력치 폴리곤은 시즌 시작 대비 값에서 순간 이동하지 않고 부드럽게 모핑한다(T-10-003). 좌표 계산은 app-core/format(radarData).
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';
import { radarData } from '@offside/app-core/format';
import { investTarget, trainingCard, trainingLabel, TRAININGS } from '@offside/game/engine';
import { focusOf } from '@offside/game/player';
import type { GameState } from '@offside/game/types';
import { useTween } from '../../sheets/useTween';
import { alpha } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Press } from '../../ui/Press';
import { Txt } from '../../ui/Txt';

// 이름표 버튼 자리를 둘 여백까지 넣은 viewBox(레이더 자체는 0~300).
const VB = { x: -20, y: -10, w: 340, h: 316 };
const BTN_W = 0.26;
const BTN_H = 46;

export function Radar({ s, onPick }: { s: GameState; onPick: (id: string) => void }) {
  const c = useColors();
  const d = radarData(s);
  const now = useTween(d.nowVals, 550);
  const nowPoly = d.toPoly(now);
  const [w, setW] = useState(0);
  const h = (w * VB.h) / VB.w;
  const focus = focusOf(s);
  // 자기 투자 특훈이 올리는 축 — 훈련 화살표와 겹치지 않을 때 점선 화살표로.
  const invKey = s.invest === 'weak' || s.invest === 'best' ? investTarget(s, s.invest) : null;
  const upKeys =
    s.training === 'coach'
      ? d.points.map((p) => p.key as string)
      : s.training === 'phy'
        ? ['phy', 'pac']
        : [s.training];
  const out = (x: number, y: number, r: number) => {
    const dx = x - d.CX,
      dy = y - d.CX,
      n = Math.hypot(dx, dy) || 1;
    return [x + (dx / n) * r, y + (dy / n) * r, dx / n, dy / n] as const;
  };
  return (
    <View
      style={{ width: '100%', maxWidth: 340, alignSelf: 'center', aspectRatio: VB.w / VB.h }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
        style={{ position: 'absolute' }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
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
        {d.dots.map(([x, y], i) => {
          const on = upKeys.includes(d.points[i]!.key);
          const inv = !on && d.points[i]!.key === invKey;
          if (!on && !inv)
            return <Circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={3} fill={c.accent} />;
          const len = inv ? 12 : s.training === 'coach' ? 8 : 16;
          const [x1, y1] = out(x, y, 6);
          const [x2, y2, ux, uy] = out(x, y, 6 + len);
          // 화살촉: 끝점에서 바깥으로 5, 양옆으로 4.
          const head = `${(x2 + ux * 5).toFixed(1)},${(y2 + uy * 5).toFixed(1)} ${(x2 - uy * 4).toFixed(1)},${(y2 + ux * 4).toFixed(1)} ${(x2 + uy * 4).toFixed(1)},${(y2 - ux * 4).toFixed(1)}`;
          return [
            <Circle
              key={`${i}-d`}
              cx={x.toFixed(1)}
              cy={y.toFixed(1)}
              r={inv ? 3 : 4.5}
              fill={c.accent}
            />,
            <Line
              key={`${i}-l`}
              x1={x1.toFixed(1)}
              y1={y1.toFixed(1)}
              x2={x2.toFixed(1)}
              y2={y2.toFixed(1)}
              stroke={c.good}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray={inv ? '3 3' : undefined}
              opacity={inv ? 0.85 : 1}
            />,
            <Polygon key={`${i}-h`} points={head} fill={c.good} opacity={inv ? 0.85 : 1} />,
          ];
        })}
      </Svg>
      {w > 0
        ? d.points.map((p) => {
            const ang = Math.atan2(p.y - d.CX, p.x - d.CX);
            const x = d.CX + Math.cos(ang) * 128,
              y = d.CX + Math.sin(ang) * 132;
            const tr = TRAININGS.find((t) => t.id === p.key)!;
            const cd = trainingCard(s, tr);
            const sel = s.training === p.key;
            const bw = w * BTN_W;
            return (
              <Press
                key={p.key}
                testID={`train-${p.key}`}
                scale={0.97}
                onPress={() => onPick(p.key)}
                accessibilityRole="button"
                accessibilityLabel={`${trainingLabel(s, tr)} · ${p.labelKr} ${p.value} · ${cd.effect[0]}${cd.tag ? ` · ${cd.tag}` : ''}`}
                accessibilityState={{ selected: sel }}
                style={{
                  position: 'absolute',
                  left: ((x - VB.x) / VB.w) * w - bw / 2,
                  top: ((y - VB.y) / VB.h) * h - BTN_H / 2,
                  width: bw,
                  height: BTN_H,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: sel ? c.accent : 'transparent',
                  backgroundColor: sel ? alpha(c.accent, 0.12) : 'transparent',
                }}
              >
                <Txt
                  numberOfLines={1}
                  style={{
                    fontSize: rem(0.75),
                    fontWeight: '600',
                    color: sel ? c.accentText : c.muted,
                  }}
                >
                  {p.labelKr}
                  {focus.includes(p.key) ? (
                    <Txt style={{ fontSize: rem(0.75), color: c.accentText }}>{' ★'}</Txt>
                  ) : null}
                </Txt>
                <Txt style={{ fontFamily: DISPLAY[700], fontSize: rem(1.125), color: c.ink }}>
                  {String(p.value)}
                  {p.delta > 0 ? (
                    <Txt style={{ fontSize: rem(0.75), color: c.good }}>{` +${p.delta}`}</Txt>
                  ) : p.delta < 0 ? (
                    <Txt style={{ fontSize: rem(0.75), color: c.bad }}>{` ${p.delta}`}</Txt>
                  ) : null}
                </Txt>
              </Press>
            );
          })
        : null}
    </View>
  );
}
