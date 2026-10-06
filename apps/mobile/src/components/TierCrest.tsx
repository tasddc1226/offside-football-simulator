// T-11-128 시즌 휘장(웹 TierCrest.svelte) — 티어 날개 문장 가운데에 프로필(이니셜)이 들어간다(LoL 지난 시즌 티어 테두리처럼).
// 좌표 · 색은 app-core tierCrest.ts(웹과 공용). initial이 없으면 가운데를 보석 빛으로 채운다(작은 표시용).
// 장식이라 스크린 리더에는 숨긴다(티어 이름은 옆 글자가 읽힌다).
import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import type { OwnerTier } from '@offside/contracts/owner-tier';
import {
  CREST_RING,
  CREST_SLOT,
  CREST_VIEWBOX,
  TIER_PALETTE,
  crestShape,
} from '@offside/app-core/tierCrest';
import { DISPLAY } from '../theme/type';
import { Txt } from '../ui/Txt';

/** 문장 viewBox(160×120)의 세로 ÷ 가로. */
const RATIO = 120 / 160;

export function TierCrest({
  tier,
  size,
  initial,
}: {
  tier: OwnerTier;
  size: number;
  initial?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const shape = crestShape(tier);
  const c = TIER_PALETTE[tier];
  const metal = `url(#${uid}m)`;
  const gem = `url(#${uid}g)`;
  const slot = (CREST_RING.inner * 2 * size) / 160;
  return (
    <View
      testID={`tier-crest-${tier}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size * RATIO, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg
        viewBox={CREST_VIEWBOX}
        width={size}
        height={size * RATIO}
        style={{ position: 'absolute' }}
      >
        <Defs>
          <LinearGradient id={`${uid}m`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.hi} />
            <Stop offset="0.5" stopColor={c.base} />
            <Stop offset="1" stopColor={c.lo} />
          </LinearGradient>
          <RadialGradient id={`${uid}g`} cx="0.5" cy="0.4" r="0.6">
            <Stop offset="0" stopColor={c.gem} />
            <Stop offset="1" stopColor={c.base} />
          </RadialGradient>
          <RadialGradient id={`${uid}in`} cx="0.5" cy="0.35" r="0.7">
            <Stop offset="0" stopColor={c.lo} />
            <Stop offset="1" stopColor="#0b100d" />
          </RadialGradient>
        </Defs>
        <Path d={shape.wingsBack} fill={c.lo} opacity={0.9} />
        <Path
          d={shape.wingsFront}
          fill={metal}
          stroke={c.lo}
          strokeWidth={0.7}
          strokeLinejoin="round"
        />
        {shape.crown ? (
          <Path
            d={shape.crown}
            fill={metal}
            stroke={c.lo}
            strokeWidth={0.7}
            strokeLinejoin="round"
          />
        ) : null}
        <Circle
          cx={CREST_SLOT.cx}
          cy={CREST_SLOT.cy}
          r={CREST_RING.outer}
          fill={metal}
          stroke={c.lo}
          strokeWidth={0.8}
        />
        <Circle
          cx={CREST_SLOT.cx}
          cy={CREST_SLOT.cy}
          r={CREST_RING.outer - 2.2}
          fill="none"
          stroke={c.hi}
          strokeOpacity={0.55}
          strokeWidth={0.8}
        />
        <Circle
          cx={CREST_SLOT.cx}
          cy={CREST_SLOT.cy}
          r={CREST_RING.inner}
          fill={initial === undefined ? gem : `url(#${uid}in)`}
          stroke={c.lo}
          strokeWidth={1}
        />
        <Path d={shape.gem} fill={gem} stroke={c.lo} strokeWidth={0.7} />
      </Svg>
      {initial !== undefined ? (
        <Txt
          style={{
            width: slot,
            textAlign: 'center',
            fontFamily: DISPLAY[700],
            fontSize: size * 0.12,
            lineHeight: size * 0.12 * 1.15,
            color: c.hi,
          }}
        >
          {initial}
        </Txt>
      ) : null}
    </View>
  );
}
