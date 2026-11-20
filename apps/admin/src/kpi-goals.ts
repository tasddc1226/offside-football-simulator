// T-11-793 60일 목표 주간 표. 일일 수집(kpi_daily) 값을 KST 월~일 주로 묶는다. 날짜 문자열은 이미 KST 날짜다.
import { valueOn } from './kpi.ts';
import { storeKrwOn } from './kpi-money.ts';
import type { KpiView } from './kpi-page.ts';

const DAY_MS = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** 그 날짜가 든 주의 월요일. */
export function weekStart(day: string) {
  const ms = Date.parse(`${day}T00:00:00Z`);
  const fromMonday = (new Date(ms).getUTCDay() + 6) % 7;
  return iso(ms - fromMonday * DAY_MS);
}

export type GoalWeek = {
  /** 월요일 · 일요일. */
  start: string;
  end: string;
  /** 기간 안에 든 날 수. 끝난 주는 7. */
  days: number;
  /** 아직 일요일까지 수집되지 않은 주(합이 낮게 보인다). */
  open: boolean;
  /** 스토어 매출 합(정가 추정) · 광고 수익 합. 값이 든 날이 하루도 없으면 null. */
  storeKrw: number | null;
  adKrw: number | null;
  /** 멤버십 새 가입 · 전체 가입. */
  membersNew: number | null;
  signups: number | null;
  /** 지난 날 가운데 값이 없는 날 수. */
  missing: { store: number; ad: number };
};

/**
 * 주 단위 묶음(최근 주가 먼저). 기간 첫 날이 월요일이 아니면 앞이 잘린 첫 주는 뺀다(합이 낮게 읽힌다).
 * 마지막 주는 끝나지 않았어도 넣고 `open`으로 표시한다.
 */
export function goalWeeks(v: KpiView): GoalWeek[] {
  const last = v.days.at(-1);
  if (!last) return [];
  const byWeek = new Map<string, string[]>();
  for (const d of v.days) {
    const w = weekStart(d);
    const list = byWeek.get(w);
    if (list) list.push(d);
    else byWeek.set(w, [d]);
  }
  const weeks: GoalWeek[] = [];
  for (const [start, days] of byWeek) {
    if (days[0] !== start) continue;
    const end = iso(Date.parse(`${start}T00:00:00Z`) + 6 * DAY_MS);
    const sum = (at: (day: string) => number | null) => {
      let total: number | null = null;
      let missing = 0;
      for (const d of days) {
        const x = at(d);
        if (x === null) missing += 1;
        else total = (total ?? 0) + x;
      }
      return { total, missing };
    };
    const store = sum((d) => storeKrwOn(v, d));
    const ad = sum((d) => valueOn(v.idx, d, 'ad_revenue_krw'));
    weeks.push({
      start,
      end,
      days: days.length,
      open: last < end,
      storeKrw: store.total,
      adKrw: ad.total,
      membersNew: sum((d) => valueOn(v.idx, d, 'members_new')).total,
      signups: sum((d) => valueOn(v.idx, d, 'signups', ['all'])).total,
      missing: { store: store.missing, ad: ad.missing },
    });
  }
  return weeks.sort((a, b) => (a.start < b.start ? 1 : -1));
}

/** '2026-11-16' → '11-16'. */
export const shortDay = (day: string) => day.slice(5);
