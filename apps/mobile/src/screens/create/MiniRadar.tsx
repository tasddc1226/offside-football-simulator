// 선수 생성 화면용 작은 육각형 레이더(웹 MiniRadar.svelte). 라벨 없이 모양만 보여 주고, 값이 바뀌면 모핑한다.
import { useEffect, useRef, useState } from 'react';
import Svg, { Polygon } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import { attrLabels, type AttrKey, type Pos } from '@offside/game/data';
import { radarOrder } from '@offside/game/attributes';
import { polyPoints } from '@offside/app-core/format';
import { prefs } from '../../store';
import { alpha } from '../../theme/colors';
import { useColors } from '../../theme/useColors';

const R = 40;
const rings = [100, 66, 33].map((r) => polyPoints([r, r, r, r, r, r], R, R));
const MORPH_MS = 320;
const cubicOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** 값이 바뀌면 이전 값에서 새 값으로 부드럽게 옮겨 간다(웹 svelte Tween). 동작 줄이기면 바로 바꾼다. */
function useTween(target: number[], motionOK: boolean): number[] {
  const [cur, setCur] = useState(target);
  const curRef = useRef(target);
  const key = target.join(',');
  useEffect(() => {
    const to = key.split(',').map(Number);
    if (!motionOK) {
      curRef.current = to;
      setCur(to);
      return;
    }
    const from = curRef.current;
    const t0 = Date.now();
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - t0) / MORPH_MS);
      const e = cubicOut(t);
      const next = to.map((v, i) => (from[i] ?? v) + (v - (from[i] ?? v)) * e);
      curRef.current = next;
      setCur(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [key, motionOK]);
  return cur;
}

export function MiniRadar({
  pos,
  attrs,
  size = 80,
  onPitch,
}: {
  pos: Pos;
  attrs: Readonly<Record<AttrKey, number>>;
  size?: number;
  /** 초록 라이브 카드 위에 그린다 — 링 색이 분필색이 된다(웹 .live-card .rd-ring). */
  onPitch?: boolean;
}) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const order = radarOrder(pos);
  // 능력치는 20~70대라 80을 바깥 링으로 잡아야 작은 크기에서도 모양 차이가 보인다.
  const vals = useTween(
    order.map((k) => Math.min(100, attrs[k] * 1.25)),
    motionOK,
  );
  const L = attrLabels(pos);
  const ring = onPitch ? alpha(c.onPitch, 0.25) : c.line;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      accessibilityRole="image"
      accessibilityLabel={order.map((k) => `${L[k]} ${Math.round(attrs[k])}`).join(', ')}
    >
      {rings.map((points) => (
        <Polygon key={points} points={points} fill="none" stroke={ring} strokeWidth={1} />
      ))}
      <Polygon
        points={polyPoints(vals, R, R)}
        fill={alpha(c.accent, 0.35)}
        stroke={c.accent}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
