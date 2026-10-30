// T-11-412 홈 '진행 중인 커리어' 카드 오른쪽 위(웹 HeroFigure.svelte): 선수 그림과 그 왼쪽에 마지막 계약서 사인을 다시 그린다.
// 둘 다 이름 줄 높이 안에서 끝나 아래 소속 · 시즌 줄은 전폭으로 쓴다. 사인은 이 기기에 남은 것만(platform/lastSign.ts), 없으면 그림만.
// 웹은 CSS 애니메이션으로 획을 긋지만 앱은 한 시계(경과 ms)로 획마다 dash 길이를 줄여 긋는다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { inkPaths } from '@offside/app-core/lastSign';
import { SKEW_X, SKEW_Y, signFlourish } from '@offside/app-core/signature';
import { avatarSpec, avatarWidth } from '@offside/game/avatar';
import { tn } from '@offside/game/i18n/names';
import type { GameState } from '@offside/game/types';
import { useEffect, useId, useMemo, useState } from 'react';
import { Easing, useWindowDimensions, View } from 'react-native';
import Svg, { ClipPath, Defs, G as SvgG, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import { loadLastSign } from '../../platform/lastSign';
import { Enter } from '../../sheets/anim';
import { prefs } from '../../store';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { PixelAvatar } from '../../ui/PixelAvatar';
import { Txt } from '../../ui/Txt';

/** 손 사인을 다 긋는 시간(ms) — 획 길이만큼 나눠 차례로 긋는다. */
const DRAW_MS = 1400;
const NAME_SIZE = 22;
/** 이름 사인: 글자가 드러나는 때 · 밑줄 꼬리를 긋는 때(ms). */
const REVEAL = [200, 600] as const;
const FLOURISH = [500, 400] as const;
const STAMP_EASE = Easing.bezier(0.2, 1.6, 0.4, 1);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function HeroFigure({ G }: { G: GameState }) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const { width } = useWindowDimensions();
  const clip = useId();
  const narrow = width < 360;
  const box = narrow ? { w: 92, h: 38 } : { w: 112, h: 44 };
  const spec = useMemo(() => avatarSpec(G), [G]);
  const sign = useMemo(() => loadLastSign(G.cid), [G.cid]);

  const ink = useMemo(() => {
    const m = sign?.mark;
    if (m?.kind !== 'ink') return null;
    const xs = m.strokes.flatMap((s) => s.filter((_, i) => i % 2 === 0));
    const ys = m.strokes.flatMap((s) => s.filter((_, i) => i % 2 === 1));
    const pad = 6;
    const x0 = Math.min(...xs) - pad,
      y0 = Math.min(...ys) - pad;
    const w = Math.max(...xs) - x0 + pad,
      h = Math.max(...ys) - y0 + pad;
    const paths = inkPaths(m);
    const total = paths.reduce((a, p) => a + p.len, 0);
    let at = 0;
    return {
      box: `${x0} ${y0} ${w} ${h}`,
      // 패드보다 작게 그리므로 획 굵기를 상자 크기에 맞춘다.
      width: Math.max(2, Math.max(w / box.w, h / box.h) * 2.4),
      paths: paths.map((p) => {
        const ms = (p.len / total) * DRAW_MS;
        const out = { d: p.d, len: p.len, delay: at, ms: Math.max(40, ms) };
        at += ms;
        return out;
      }),
    };
  }, [sign, box.w, box.h]);
  const stampAt = ink ? 1500 : 950;

  // 감속 모션이 아니면 경과 시간으로 획을 차례로 긋고, 다 그은 뒤 도장이 찍힌다.
  const [t, setT] = useState(motionOK && sign ? 0 : Infinity);
  useEffect(() => {
    if (!motionOK || !sign) return setT(Infinity);
    setT(0);
    const t0 = performance.now();
    let raf = 0;
    const step = () => {
      const e = performance.now() - t0;
      setT(e >= stampAt ? Infinity : e);
      if (e < stampAt) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [motionOK, sign, stampAt]);
  const part = (delay: number, ms: number) => clamp01((t - delay) / ms);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        top: 14,
        right: 14,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
      }}
    >
      {sign ? (
        <View testID="hero-sign" style={{ width: box.w, height: box.h, marginTop: 4 }}>
          {ink ? (
            <Svg width={box.w} height={box.h} viewBox={ink.box} preserveAspectRatio="xMidYMid meet">
              {ink.paths.map((p, i) => {
                const k = part(p.delay, p.ms);
                return k <= 0 ? null : (
                  <Path
                    key={i}
                    d={p.d}
                    fill="none"
                    stroke={c.onPitch}
                    strokeWidth={ink.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    {...(k < 1
                      ? { strokeDasharray: [p.len, p.len], strokeDashoffset: p.len * (1 - k) }
                      : null)}
                  />
                );
              })}
            </Svg>
          ) : sign.mark.kind === 'name' ? (
            <Svg width={box.w} height={box.h} viewBox="-66 -26 132 52">
              <Defs>
                <ClipPath id={clip}>
                  <Rect x={-66} y={-26} width={132 * part(...REVEAL)} height={52} />
                </ClipPath>
              </Defs>
              <SvgG transform={`matrix(1 ${SKEW_Y} ${SKEW_X} 1 0 4)`}>
                <SvgG clipPath={`url(#${clip})`}>
                  <SvgText
                    x={0}
                    y={0}
                    textAnchor="middle"
                    fontSize={NAME_SIZE}
                    fontWeight="500"
                    fontStyle="italic"
                    fill={c.onPitch}
                    {...(sign.mark.name.length > 6
                      ? { textLength: 110, lengthAdjust: 'spacingAndGlyphs' as const }
                      : null)}
                  >
                    {sign.mark.name}
                  </SvgText>
                </SvgG>
                {part(...FLOURISH) > 0 ? (
                  <Path
                    d={signFlourish(52, NAME_SIZE)}
                    fill="none"
                    stroke={c.onPitch}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    // 꼬리 길이를 모르니 넉넉한 길이(200)로 dash를 잡는다.
                    {...(part(...FLOURISH) < 1
                      ? {
                          strokeDasharray: [200, 200],
                          strokeDashoffset: 200 * (1 - part(...FLOURISH)),
                        }
                      : null)}
                  />
                ) : null}
              </SvgG>
            </Svg>
          ) : null}
          {t >= stampAt ? (
            <View style={{ position: 'absolute', right: -2, bottom: -12 }}>
              <Enter kind="scale" from={1.6} ms={260} ease={STAMP_EASE}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    gap: 4,
                    maxWidth: 120,
                    paddingVertical: 1,
                    paddingHorizontal: 6,
                    borderWidth: 1.5,
                    borderColor: c.accent,
                    borderRadius: RADIUS.xs,
                    transform: [{ rotate: '-6deg' }],
                  }}
                >
                  <Txt
                    style={{
                      color: c.accent,
                      fontSize: rem(FONT.caption2),
                      lineHeight: rem(FONT.caption2) * 1.3,
                      fontWeight: '800',
                      letterSpacing: 0.4,
                    }}
                  >
                    SIGNED
                  </Txt>
                  <Txt
                    numberOfLines={1}
                    style={{
                      flexShrink: 1,
                      color: c.accent,
                      fontSize: rem(FONT.caption2),
                      lineHeight: rem(FONT.caption2) * 1.3,
                    }}
                  >
                    {tn(sign.club)}
                  </Txt>
                </View>
              </Enter>
            </View>
          ) : null}
        </View>
      ) : null}
      <PixelAvatar spec={spec} width={avatarWidth(width)} />
    </View>
  );
}
