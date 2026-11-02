import type { AdminRevenue } from '@offside/contracts';
import type { Db } from '../client.js';
import { readRevenueRows } from './revenueRead.js';
import { assembleRevenue } from './revenueView.js';

// List-price estimates, not settlement revenue. Purchases and notifications are not
// double-counted. Notification buyers and sales before recording began are unknown.
const DAY_MS = 86_400_000;
const KST_MS = 9 * 3_600_000;

/** 오늘(KST)을 포함한 최근 days일의 KST 날짜와 시작 시각(UTC ISO). */
export function kstWindow(now: Date, days: number) {
  const todayKst = Math.floor((now.getTime() + KST_MS) / DAY_MS) * DAY_MS;
  const first = todayKst - (days - 1) * DAY_MS;
  return {
    start: new Date(first - KST_MS).toISOString(),
    days: Array.from({ length: days }, (_, i) =>
      new Date(first + i * DAY_MS).toISOString().slice(0, 10),
    ),
  };
}

export async function revenueReport(db: Db, now: Date, days: number): Promise<AdminRevenue> {
  const window = kstWindow(now, days);
  return assembleRevenue(await readRevenueRows(db, window.start), now, days, window.days);
}
