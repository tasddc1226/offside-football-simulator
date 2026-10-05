// 엔진 영어 문구의 복수형·서수(season·turn·stats 네임스페이스가 함께 쓴다).
export const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

export function ordinal(n: number): string {
  const m100 = n % 100;
  if (m100 >= 11 && m100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}
