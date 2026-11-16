import { fmtMoney } from '@offside/game/engine';
import type { Chip } from '@offside/game/stats';

/** 변화 칩의 값 글자. range(구간 리포트)면 능력치 · OVR을 화면 값 전후 "68 → 72"로 쓴다.
 *  소수로 쌓인 성장이라 화면 값이 그대로면(68.2 → 68.6) 오른 폭(+0.4)을 쓴다. */
export function chipValue(c: Chip, range = false): string {
  if (c.text) return c.text;
  if (c.money) return (c.d > 0 ? '+' : '') + fmtMoney(c.d);
  if (range && c.from !== undefined && c.to !== undefined && c.from !== c.to)
    return `${c.from} → ${c.to}`;
  return (c.d > 0 ? '+' : '') + c.d;
}
