// T-11-572 kpi_daily 행(날짜 · 지표 · 나눔)을 화면이 쓰는 모양(타일 · 쌓은 막대 · 표)으로 바꾼다. 화면 코드와 떼어 테스트한다.
import type { KpiReport } from '@offside/contracts';

export type Index = Map<string, Map<string, number>>;

const key = (metric: string, dim: string) => `${metric}|${dim}`;

/** 날짜 → (지표|나눔 → 값). */
export function indexRows(r: KpiReport): Index {
  const idx: Index = new Map();
  for (const row of r.rows) {
    let day = idx.get(row.day);
    if (!day) idx.set(row.day, (day = new Map()));
    day.set(key(row.metric, row.dim), row.value);
  }
  return idx;
}

/** 그날 지표 값. dims를 주면 그 나눔만 더하고, 없으면 그 지표의 모든 나눔을 더한다. 기록이 하나도 없으면 null. */
export function valueOn(idx: Index, day: string, metric: string, dims?: readonly string[]) {
  const m = idx.get(day);
  if (!m) return null;
  let sum = 0;
  let seen = false;
  for (const [k, v] of m) {
    const [mk, dk] = k.split('|') as [string, string];
    if (mk !== metric || (dims && !dims.includes(dk))) continue;
    sum += v;
    seen = true;
  }
  return seen ? sum : null;
}

/** 여러 지표의 합(예: 인앱 + 광고 제거 + 시즌 패스). 모두 비면 null. */
export function totalOn(idx: Index, day: string, metrics: readonly string[]) {
  const vals = metrics.map((m) => valueOn(idx, day, m));
  return vals.every((v) => v === null) ? null : vals.reduce<number>((s, v) => s + (v ?? 0), 0);
}

export type Series = { key: string; label: string; values: (number | null)[] };

/** 쌓은 막대 한 묶음: 나눔(dim)마다 한 줄. */
export function dimSeries(
  idx: Index,
  days: readonly string[],
  metric: string,
  dims: readonly { dim: string; label: string }[],
): Series[] {
  return dims.map(({ dim, label }) => ({
    key: dim,
    label,
    values: days.map((d) => valueOn(idx, d, metric, [dim])),
  }));
}

/** 지표 여러 개를 한 묶음으로(예: 매출 = 인앱 · 광고 제거 · 시즌 패스 · 광고). */
export function metricSeries(
  idx: Index,
  days: readonly string[],
  metrics: readonly { metric: string; label: string }[],
): Series[] {
  return metrics.map(({ metric, label }) => ({
    key: metric,
    label,
    values: days.map((d) => valueOn(idx, d, metric)),
  }));
}

/** 줄이 전부 비었으면 뺀다(아직 연결 안 된 원천). */
export const nonEmpty = (series: Series[]) =>
  series.filter((s) => s.values.some((v) => v !== null && v !== 0));

export type Tile = { value: number | null; prev: number | null; change: number | null };

/** 마지막 날 값과 7일 전 같은 요일 값. change는 비율(0.12 = +12%), 비교할 수 없으면 null. */
export function tile(days: readonly string[], at: (day: string) => number | null): Tile {
  const last = days.at(-1);
  const before = days.at(-8);
  const value = last ? at(last) : null;
  const prev = before ? at(before) : null;
  const change = value !== null && prev ? (value - prev) / prev : null;
  return { value, prev, change };
}

/** 기간 합(값이 없는 날은 건너뛴다). */
export const periodSum = (days: readonly string[], at: (day: string) => number | null) =>
  days.reduce((s, d) => s + (at(d) ?? 0), 0);

/** 표 · CSV: 날짜 × (지표|나눔). */
export function tableOf(r: KpiReport) {
  const cols = [...new Set(r.rows.map((x) => key(x.metric, x.dim)))].sort();
  const idx = indexRows(r);
  const rows = r.days.map((d) => ({
    day: d,
    cells: cols.map((c) => idx.get(d)?.get(c) ?? null),
  }));
  return { cols, rows };
}

export function toCsv(r: KpiReport) {
  const { cols, rows } = tableOf(r);
  const lines = [['day', ...cols].join(',')];
  for (const row of rows) lines.push([row.day, ...row.cells.map((v) => v ?? '')].join(','));
  return `${lines.join('\n')}\n`;
}

const won = new Intl.NumberFormat('ko-KR');
export const fmt = (v: number | null, unit: 'n' | 'krw' | 'pct' = 'n') => {
  if (v === null) return '—';
  if (unit === 'krw') return `₩${won.format(Math.round(v))}`;
  if (unit === 'pct') return `${(v * 100).toFixed(1)}%`;
  return won.format(Math.round(v * 10) / 10);
};
export const fmtChange = (c: number | null) =>
  c === null ? '' : `${c >= 0 ? '+' : '−'}${Math.abs(c * 100).toFixed(0)}%`;
