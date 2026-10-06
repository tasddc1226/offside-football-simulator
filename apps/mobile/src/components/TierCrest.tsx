// T-11-128 시즌 휘장(웹 TierCrest.svelte) — 티어 장식이 둘러싼 고리 가운데에 프로필(이니셜)이 들어간다(LoL 시즌 테두리처럼).
// 조각 · 색은 app-core tierCrest.ts(웹과 공용). initial이 없으면 가운데를 보석 빛으로 채운다(댓글 · 채팅 작은 표시).
// 장식이라 스크린 리더에는 숨긴다(티어 이름은 감싼 쪽이 읽힌다).
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
  type CrestPart,
} from '@offside/app-core/tierCrest';
import { DISPLAY } from '../theme/type';
import { Txt } from '../ui/Txt';

/** 문장 viewBox(160×128)의 세로 ÷ 가로. */
const RATIO = 128 / 160;

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
  const part = (p: CrestPart, i: number) => (
    <Path
      key={i}
      d={p.d}
      fill={p.kind === 'back' ? c.lo : p.kind === 'gem' ? gem : metal}
      stroke={p.kind === 'back' ? 'none' : c.lo}
      strokeWidth={0.7}
      strokeLinejoin="round"
    />
  );
  const scale = size / 160;
  const slot = CREST_RING.inner * 2 * scale;
  return (
    <View
      testID={`tier-crest-${tier}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size * RATIO }}
    >
      <Svg
        viewBox={CREST_VIEWBOX}
        width={size}
        height={size * RATIO}
        style={{ position: 'absolute' }}
      >
        <Defs>
          <LinearGradient id={`${uid}m`} x1="0" y1="0" x2="0.3" y2="1">
            <Stop offset="0" stopColor={c.hi} />
            <Stop offset="0.45" stopColor={c.base} />
            <Stop offset="1" stopColor={c.lo} />
          </LinearGradient>
          <RadialGradient id={`${uid}g`} cx="0.4" cy="0.3" r="0.8">
            <Stop offset="0" stopColor="#ffffff" />
            <Stop offset="0.35" stopColor={c.gem} />
            <Stop offset="1" stopColor={c.base} />
          </RadialGradient>
          <RadialGradient id={`${uid}in`} cx="0.5" cy="0.35" r="0.7">
            <Stop offset="0" stopColor={c.lo} />
            <Stop offset="1" stopColor="#0b100d" />
          </RadialGradient>
        </Defs>
        {shape.under.map(part)}
        <Circle
          cx={CREST_SLOT.cx}
          cy={CREST_SLOT.cy}
          r={CREST_RING.outer}
          fill={metal}
          stroke={c.lo}
          strokeWidth={0.9}
        />
        <Circle
          cx={CREST_SLOT.cx}
          cy={CREST_SLOT.cy}
          r={CREST_RING.outer - 1.6}
          fill="none"
          stroke={c.hi}
          strokeOpacity={0.6}
          strokeWidth={0.7}
        />
        <Circle
          cx={CREST_SLOT.cx}
          cy={CREST_SLOT.cy}
          r={CREST_RING.inner + 0.8}
          fill="none"
          stroke={c.lo}
          strokeWidth={1.2}
        />
        <Circle
          cx={CREST_SLOT.cx}
          cy={CREST_SLOT.cy}
          r={CREST_RING.inner}
          fill={initial === undefined ? gem : `url(#${uid}in)`}
        />
        {shape.over.map(part)}
      </Svg>
      {initial !== undefined ? (
        <View
          style={{
            position: 'absolute',
            left: CREST_SLOT.cx * scale - slot / 2,
            top: CREST_SLOT.cy * scale - slot / 2,
            width: slot,
            height: slot,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt
            style={{
              fontFamily: DISPLAY[700],
              fontSize: size * 0.17,
              lineHeight: size * 0.17 * 1.15,
              color: c.hi,
            }}
          >
            {initial}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}
