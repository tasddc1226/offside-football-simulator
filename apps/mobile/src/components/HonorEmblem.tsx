// T-11-128 기록 배지(웹 HonorEmblem.svelte) — 단계별 틀(동 메달 · 은 방패 · 금 날개 방패 + 왕관) 안에 종류 문양,
// 아래 리본에 단계 글자. 좌표는 app-core honorEmblem.ts(웹과 공용). 금 휘장의 빛 스침은 앱에서 뺐다.
// 장식이라 스크린 리더에는 숨긴다(이름 · 단계는 옆 글자가 읽힌다).
import { useId } from 'react';
import Svg, { Defs, G, LinearGradient, Path, RadialGradient, Stop, Text } from 'react-native-svg';
import {
  EMBLEM_FRAME,
  GLYPH_AT,
  HONOR_GLYPH,
  RIBBON,
  RIBBON_TEXT,
} from '@offside/app-core/honorEmblem';
import type { HonorView } from '@offside/app-core/seasonRecap';
import { mix } from '../theme/colors';
import { DISPLAY } from '../theme/type';
import { useMedal } from './Laurel';

/** 문양 viewBox(80×88)의 가로세로 비. */
const RATIO = 88 / 80;

export function HonorEmblem({ h, size }: { h: HonorView; size: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { leaf: medal } = useMedal(h.medal);
  const frame = EMBLEM_FRAME[h.medal];
  const edge = mix(medal, '#000000', 0.55);
  const glyph = mix(medal, '#ffffff', 0.7);
  const metal = `url(#${uid}metal)`;
  return (
    <Svg
      viewBox="0 0 80 88"
      width={size}
      height={size * RATIO}
      style={{ overflow: 'visible' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <LinearGradient id={`${uid}metal`} x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={mix(medal, '#ffffff', 0.55)} />
          <Stop offset="0.55" stopColor={medal} />
          <Stop offset="1" stopColor={mix(medal, '#000000', 0.6)} />
        </LinearGradient>
        <RadialGradient id={`${uid}field`} cx="0.5" cy="0.38" r="0.65">
          <Stop offset="0" stopColor={mix(medal, '#17201b', 0.3)} />
          <Stop offset="1" stopColor="#0d1310" />
        </RadialGradient>
      </Defs>
      {frame.wings ? (
        <Path d={frame.wings} fill={metal} stroke={edge} strokeWidth={0.8} strokeLinejoin="round" />
      ) : null}
      <Path d={frame.outer} fill={metal} stroke={edge} strokeWidth={0.8} strokeLinejoin="round" />
      <Path d={frame.shine} fill="#ffffff" opacity={0.18} />
      <Path
        d={frame.inner}
        fill={`url(#${uid}field)`}
        stroke={mix(medal, '#000000', 0.7)}
        strokeWidth={0.8}
      />
      <G transform={`translate(${GLYPH_AT.x} ${GLYPH_AT.y}) scale(${GLYPH_AT.scale})`}>
        {HONOR_GLYPH[h.kind].map((part, i) =>
          part.stroke ? (
            <Path
              key={i}
              d={part.d}
              fill="none"
              stroke={glyph}
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          ) : (
            <Path key={i} d={part.d} fill={glyph} />
          ),
        )}
      </G>
      {frame.crown ? (
        <Path d={frame.crown} fill={metal} stroke={edge} strokeWidth={0.8} strokeLinejoin="round" />
      ) : null}
      <Path d={RIBBON} fill={metal} stroke={edge} strokeWidth={0.8} strokeLinejoin="round" />
      <Text
        x={RIBBON_TEXT.x}
        y={RIBBON_TEXT.y}
        fill="#1a1206"
        fontFamily={DISPLAY[800]}
        fontSize={10}
        letterSpacing={0.4}
        textAnchor="middle"
      >
        {h.ribbon}
      </Text>
    </Svg>
  );
}
