import { rollInt, type RngState } from './rng.js';

/**
 * `[min, max]` 양끝 포함 정수를 뽑는다. `rng.ts`의 `rollInt`(0..maxExclusive-1) 위에 얇게 얹은
 * 헬퍼로, `rng.ts` 자체는 바꾸지 않는다(제약: rng 변경 금지).
 */
export function rollRange(state: RngState, min: number, max: number): { value: number; state: RngState } {
  const span = max - min + 1;
  const rolled = rollInt(state, span);
  return { value: rolled.value + min, state: rolled.state };
}
