// 숫자 카운트업(웹 CountUp.svelte) — 처음 그려질 때 0에서 value까지 올라간다. 동작 줄이기·animate=false면 바로 value.
// run=false인 동안은 0에 머문다(화면에 들어올 때 세기 시작).
import { useEffect, useState } from 'react';
import { useSnapshot } from 'valtio';
import { prefs } from '../store';

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function useCountUp(value: number, { animate = true, run = true, ms = 1200 } = {}): number {
  const { motionOK } = useSnapshot(prefs);
  const instant = !animate || !motionOK;
  const [cur, setCur] = useState(instant ? value : 0);
  useEffect(() => {
    if (instant) return setCur(value);
    if (!run) return setCur(0);
    let raf = 0;
    const t0 = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - t0) / ms);
      setCur(value * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, run, instant, ms]);
  return cur;
}

/** 글자 안에 넣는 숫자(<Txt>{...}<CountUp/></Txt>). */
export function CountUp({
  value,
  decimals = 0,
  ...opt
}: {
  value: number;
  decimals?: number;
  animate?: boolean;
  run?: boolean;
  ms?: number;
}) {
  return <>{useCountUp(value, opt).toFixed(decimals)}</>;
}
