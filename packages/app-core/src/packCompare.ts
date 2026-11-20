/**
 * T-11-770a 묶음 장당 가격 비교(웹 · 앱 공용, 기획 T-11-747 R4). 스토어 · 서버가 준 숫자 가격과 통화 코드만 쓴다. 현지화된 가격
 * 문자열을 잘라 숫자로 바꾸지 않고, 통화가 섞였거나 숫자 가격이 없는 묶음이 하나라도 있으면 장당 가격을 모두 숨긴다(총액만
 * 보인다). '가장 낮아요' 표시는 같은 통화의 묶음이 둘 이상이고 한 묶음만 가장 쌀 때만 붙인다.
 */
export type PackPrice = { qty: number; amount?: number | null; currency?: string | null };
export type PackUnit = {
  /** 장당 가격(그 통화의 자릿수로 적은 문자열). 비교할 수 없으면 null. */
  unit: string | null;
  /** 장당 가격 숫자(그 통화의 자릿수로 반올림). 화면이 자기 서식으로 적을 때 쓴다. */
  value: number | null;
  /** 이 묶음만 장당 가격이 가장 낮다. */
  lowest: boolean;
};

const NONE: PackUnit = { unit: null, value: null, lowest: false };

export function packUnits(packs: readonly PackPrice[], locale: string): PackUnit[] {
  const none = packs.map(() => NONE);
  if (packs.length < 2) return none;
  const currency = packs[0]?.currency;
  if (!currency || !/^[A-Z]{3}$/.test(currency)) return none;
  const ok = packs.every(
    (p) =>
      p.currency === currency &&
      typeof p.amount === 'number' &&
      Number.isFinite(p.amount) &&
      p.amount > 0 &&
      Number.isInteger(p.qty) &&
      p.qty > 0,
  );
  if (!ok) return none;
  let fmt: Intl.NumberFormat;
  try {
    fmt = new Intl.NumberFormat(locale, { style: 'currency', currency });
  } catch {
    return none;
  }
  const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
  const scale = 10 ** digits;
  // 화면에 적는 자릿수로 맞춘 뒤 비교한다(적힌 숫자가 같은데 '가장 낮아요'가 붙지 않게).
  const units = packs.map((p) => Math.round(((p.amount as number) / p.qty) * scale) / scale);
  const min = Math.min(...units);
  const single = units.filter((u) => u === min).length === 1;
  return units.map((u) => ({ unit: fmt.format(u), value: u, lowest: single && u === min }));
}
