// T-11-819 서포터 휘장(별 방패, 웹 SupporterCrest.svelte). 방패 위 별 개수가 연속 구독 단계(1 · 3 · 6 · 9개월)다.
// 휘장은 목록 줄 · 이름 옆에 붙는 16~22px 장식이라 T-11-602(DECOR_MOTION_MIN) 규칙대로 움직이지 않고, 웹의 빛무리 · 궤도를
// 멈춘 모양으로 그린다(6개월 빛무리, 9개월 빛무리 + 궤도 테두리).
import { useId } from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import {
  CREST_HEART,
  CREST_HEART_TRANSFORM,
  CREST_INNER,
  CREST_PALETTE,
  CREST_SHIELD,
  CREST_VIEW,
  crestFx,
  crestStars,
} from '@offside/app-core/supporterCrest';
import type { SupporterTier } from '@offside/contracts/membership';

export function SupporterCrest({ tier, size = 18 }: { tier: SupporterTier; size?: number }) {
  const p = CREST_PALETTE[tier];
  const fx = crestFx(tier);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const h = Math.round((size * CREST_VIEW.h) / CREST_VIEW.w);
  const aura = size * 1.5;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: h, flexShrink: 0 }}
    >
      {fx.halo ? (
        <View style={{ position: 'absolute', left: (size - aura) / 2, top: (h - aura) / 2 }}>
          <Svg width={aura} height={aura} viewBox="0 0 80 80">
            <Defs>
              <RadialGradient id={`${uid}h`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={p.light} stopOpacity={0.5} />
                <Stop offset="1" stopColor={p.light} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={40} cy={40} r={39} fill={`url(#${uid}h)`} />
            {fx.orbit ? (
              <>
                <Circle
                  cx={40}
                  cy={40}
                  r={37}
                  fill="none"
                  stroke={p.light}
                  strokeWidth={2}
                  strokeDasharray="35 81"
                />
                <Circle
                  cx={40}
                  cy={40}
                  r={37}
                  fill="none"
                  stroke={p.base}
                  strokeWidth={2}
                  strokeDasharray="25 91"
                  strokeDashoffset={-58}
                />
              </>
            ) : null}
          </Svg>
        </View>
      ) : null}
      <Svg width={size} height={h} viewBox={`0 0 ${CREST_VIEW.w} ${CREST_VIEW.h}`}>
        <Defs>
          <LinearGradient id={`${uid}g`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={p.light} />
            <Stop offset="1" stopColor={p.base} />
          </LinearGradient>
        </Defs>
        <Path d={CREST_SHIELD} fill={`url(#${uid}g)`} stroke={p.edge} strokeWidth={2} />
        <Path d={CREST_INNER} fill="none" stroke={p.ink} strokeOpacity={0.45} strokeWidth={1.4} />
        <Path d={CREST_HEART} transform={CREST_HEART_TRANSFORM} fill={p.ink} />
        {crestStars(tier).map((pts) => (
          <Polygon
            key={pts}
            points={pts}
            fill={p.light}
            stroke={p.edge}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        ))}
      </Svg>
    </View>
  );
}
