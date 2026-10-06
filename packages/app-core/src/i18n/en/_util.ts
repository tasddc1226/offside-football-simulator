// 영어 사전이 함께 쓰는 도우미(T-11-102). 영어 청크에만 실린다.

/** 수 + 단수/복수: plural(1, 'goal') → '1 goal', plural(3, 'goal') → '3 goals'. */
export const plural = (n: number, one: string, many = `${one}s`): string =>
  `${n} ${n === 1 ? one : many}`;

/** 서수: ordinal(1) → '1st', ordinal(12) → '12th', ordinal(22) → '22nd'. */
export function ordinal(n: number): string {
  const r = n % 100;
  if (r >= 11 && r <= 13) return `${n}th`;
  const s = n % 10;
  return `${n}${s === 1 ? 'st' : s === 2 ? 'nd' : s === 3 ? 'rd' : 'th'}`;
}
