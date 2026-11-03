import type { AdminRevenue } from '@offside/contracts';
import type { RevenueRows, RevenueSumRow } from './revenueRead.js';
type Sum = { count: number; krw: number };

// Preserve the established response: ads are separate from total/allTime/daily.krw.
export function assembleRevenue(
  rows: RevenueRows,
  now: Date,
  days: number,
  dayList: string[],
): AdminRevenue {
  const [total, first, refunds, allTime, daily, products, stores, ads, adsSince, recent] = rows;
  const num = (v: unknown) => Number(v ?? 0);
  const sum = (row: RevenueSumRow | undefined): Sum => ({
    count: num(row?.count),
    krw: num(row?.krw),
  });
  const t = total!.results[0]!;
  const a = allTime!.results[0]!;
  const byDay = new Map(daily!.results.map((d) => [d.day, d]));
  const ad = { count: 0, refunds: 0, krw: 0 };
  const adAll = { ...ad };
  const adStores = new Map<string, typeof ad>();
  const adDays = new Map<string, Sum>();
  for (const row of ads!.results) {
    for (const key of ['count', 'refunds', 'krw'] as const) adAll[key] += num(row[key]);
    if (!row.day) continue;
    const store = row.store;
    const s = adStores.get(store) ?? { count: 0, refunds: 0, krw: 0 };
    for (const key of ['count', 'refunds', 'krw'] as const) {
      ad[key] += num(row[key]);
      s[key] += num(row[key]);
    }
    adStores.set(store, s);
    const day = row.day;
    const d = adDays.get(day) ?? { count: 0, krw: 0 };
    adDays.set(day, { count: d.count + num(row.count), krw: d.krw + num(row.krw) });
  }
  return {
    generatedAt: now.toISOString(),
    days,
    total: {
      ...sum(t),
      buyers: num(t.buyers),
      firstBuyers: num(first!.results[0]?.n),
      refunds: num(refunds!.results[0]?.count),
      refundKrw: num(refunds!.results[0]?.krw),
    },
    allTime: { ...sum(a), buyers: num(a.buyers) },
    daily: dayList.map((day) => ({
      day,
      ...sum(byDay.get(day)),
      adCount: adDays.get(day)?.count ?? 0,
      adKrw: adDays.get(day)?.krw ?? 0,
    })),
    products: products!.results.map((p) => ({
      productId: p.productId,
      ...sum(p),
      refunded: num(p.refunded),
    })),
    stores: stores!.results.map((s) => ({ store: s.store, ...sum(s) })),
    removeAds: {
      ...ad,
      since: adsSince!.results[0]?.since ?? null,
      allTime: adAll,
      stores: [...adStores].map(([store, s]) => ({ store, count: s.count, refunds: s.refunds })),
    },
    recent: recent!.results,
  };
}
