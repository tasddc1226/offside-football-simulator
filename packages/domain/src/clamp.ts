/**
 * 값을 [min, max] 범위로 자른다. RULE-* 계산의 능력치·확률 clamp에 쓰인다.
 */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError('min은 max보다 클 수 없다.');
  }
  return Math.min(Math.max(value, min), max);
}
