// 숫자 카운트업(웹 CountUp.svelte) — 처음 그려질 때 0에서 value까지 올라간다. 동작 줄이기·animate=false면 바로 value.
// run=false인 동안은 0에 머문다(화면에 들어올 때 세기 시작). 값이 바뀌면 지금 보이는 숫자에서 새 값으로 이어 간다
// (웹 Tween이 목표만 바꾸는 것과 같다) — 0부터 다시 세면 폴링·소켓으로 숫자가 바뀔 때마다 홈 현황이 0에서 다시 오른다.
import { useEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { prefs } from '../store';

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function useCountUp(value: number, { animate = true, run = true, ms = 1200 } = {}): number {
  const { motionOK } = useSnapshot(prefs);
  const instant = !animate || !motionOK;
  const [cur, setCur] = useState(instant ? value : 0);
  /** 지금 화면에 보이는 값 — 애니메이션이 끊겨도(새 값이 와도) 여기서 이어 간다. */
  const shown = useRef(cur);
  useEffect(() => {
    const show = (v: number) => {
      shown.current = v;
      setCur(v);
    };
    if (instant) return show(value);
    if (!run) return show(0);
    const from = shown.current;
    let raf = 0;
    const t0 = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - t0) / ms);
      show(from + (value - from) * easeOut(t));
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
