// T-11-739 아이템 화면 계산. 남은 장수(items_held)는 수집 때(다음 날 04:00 KST)의 지금 상태, 사용 · 구매는 KST 하루치다.
import { ITEM_LABEL, valueOn } from './kpi.ts';
import type { KpiView } from './kpi-page.ts';

/** 화면에 보이는 순서(많이 쌓이는 것부터). */
export const ITEMS = ['boost', 'reroll', 'scout', 'rename'] as const;
export const itemName = (item: string) => ITEM_LABEL[item] ?? item;

/**
 * 하루 들어온 양 = 그날 남은 장수 − 전날 남은 장수 + 그날 쓴 장수. 두 날 모두 남은 장수가 있어야 센다(첫날은 null).
 * 환불 회수 · 운영 조정으로 줄어든 만큼은 빠져 음수가 될 수 있다.
 */
export function inflow(v: KpiView, item: string): (number | null)[] {
  return v.days.map((day, i) => {
    const prev = i > 0 ? valueOn(v.idx, v.days[i - 1]!, 'items_held', [item]) : null;
    const now = valueOn(v.idx, day, 'items_held', [item]);
    if (prev === null || now === null) return null;
    return now - prev + (valueOn(v.idx, day, 'items_used', [item]) ?? 0);
  });
}

/** 들어온 양을 산 것(아이템 팩)과 받은 것(보상 · 선물 · 상점 등 나머지)으로 나눈다. 받은 것은 0 아래로 내리지 않는다. */
export function inflowSplit(v: KpiView, item: string) {
  const all = inflow(v, item);
  const bought = v.days.map((d) => valueOn(v.idx, d, 'items_bought', [item]));
  return {
    bought: all.map((x, i) => (x === null ? null : (bought[i] ?? 0))),
    free: all.map((x, i) => (x === null ? null : Math.max(0, x - (bought[i] ?? 0)))),
  };
}

/** 최근 n일 하루 평균 사용(값이 있는 날만). 한 날도 없으면 null. */
export function avgUse(v: KpiView, item: string, n = 7) {
  const vals = v.days
    .slice(-n)
    .map((d) => valueOn(v.idx, d, 'items_used', [item]))
    .filter((x): x is number => x !== null);
  return vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null;
}

/** 남은 장수로 버티는 날 수 = 남은 장수 ÷ 최근 7일 하루 평균 사용. 쓰지 않으면 null. */
export const supplyDays = (held: number | null, avg: number | null) =>
  held === null || !avg ? null : held / avg;
