// 숫자 배열을 목표값까지 부드럽게 옮긴다(웹 svelte/motion Tween). 목표가 바뀌면 지금 값에서 다시 출발하고,
// 동작 줄이기면 바로 목표로 간다. from을 주면 처음 그릴 때 거기서 출발한다(카운트업).
import { useEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { prefs } from '../store';

export const linear = (t: number) => t;
export const cubicOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function useTween(
  target: readonly number[],
  ms: number,
  opt: { from?: readonly number[]; ease?: (t: number) => number } = {},
): number[] {
  const { motionOK } = useSnapshot(prefs);
  const ease = opt.ease ?? linear;
  const key = target.join(',');
  const [cur, setCur] = useState<number[]>(() => [...(opt.from ?? target)]);
  // 애니메이션이 도는 중에 목표가 바뀌면 그 순간의 값에서 다시 출발한다.
  const now = useRef<number[]>(cur);
  useEffect(() => {
    const to = key ? key.split(',').map(Number) : [];
    const from = now.current.length === to.length ? now.current : to;
    // 이미 목표에 있으면 애니메이션을 돌리지 않는다(처음 그릴 때 프레임마다 다시 그리는 낭비를 막는다).
    if (from.every((v, i) => v === to[i])) {
      now.current = to;
      const id = requestAnimationFrame(() => setCur((p) => (p.length === to.length ? p : to)));
      return () => cancelAnimationFrame(id);
    }
    if (!motionOK || ms <= 0) {
      now.current = to;
      const id = requestAnimationFrame(() => setCur(to));
      return () => cancelAnimationFrame(id);
    }
    const t0 = Date.now();
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - t0) / ms);
      const k = ease(t);
      // 끝에서 1e-16 같은 찌꺼기가 지수 표기로 SVG transform 문자열에 들어가지 않게 소수 넷째 자리로 맞춘다.
      const next = to.map((v, i) =>
        t === 1 ? v : Math.round((from[i]! + (v - from[i]!) * k) * 1e4) / 1e4,
      );
      now.current = next;
      setCur(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [key, ms, motionOK, ease]);
  return cur;
}
