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
/** 값이 하나라도 들어온 계열만(0도 들어온 값이다. 모두 빈 날이면 아직 수집 전). */
export const nonEmpty = (series: Series[]) =>
  series.filter((s) => s.values.some((v) => v !== null));

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

/** 기간 합과 값이 빠진 날 수. 하루도 없으면 sum은 null(0과 구별). */
export function periodSum(days: readonly string[], at: (day: string) => number | null) {
  let sum: number | null = null;
  let missing = 0;
  for (const d of days) {
    const v = at(d);
    if (v === null) missing += 1;
    else sum = (sum ?? 0) + v;
  }
  return { sum, missing };
}

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

// T-11-577 화면 이름표 · 시각.
export const DIM_LABEL: Record<string, string> = {
  all: '전체',
  web: '웹',
  app: '앱',
  toss: '토스',
  ios: 'iOS',
  android: 'Android',
  apple: 'iOS',
  google: 'Android',
  xsolla: '웹 결제',
  linked: '로그인 연결',
};
export const dimLabel = (dim: string) => DIM_LABEL[dim] ?? dim;

const ITEM_LABEL: Record<string, string> = {
  reroll: '리롤권',
  boost: '잠재력 강화권',
  scout: '스카우트권',
  rename: '이름 변경권',
};
/** 'com.offsidelab.app.reroll_40' → '리롤권 ×40'. 모르는 상품은 id 끝부분. */
export function productLabel(productId: string) {
  const tail = productId.split('.').at(-1) ?? productId;
  if (tail === 'remove_ads') return '광고 제거';
  if (tail === 'club_monthly') return '클럽 멤버십';
  const m = /^([a-z]+)_(\d+)$/.exec(tail);
  return m && ITEM_LABEL[m[1]!] ? `${ITEM_LABEL[m[1]!]} ×${m[2]}` : tail;
}

/** UTC ISO → 'M. D. HH:mm'(KST). */
export const kstTime = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

/** a 대비 b 비율(0.12 = 12%). b가 0이면 null. */
export const ratio = (a: number, b: number) => (b ? a / b : null);

/** 그 지표에 들어온 나눔(dim) 목록과 이름표. */
export const dimsOf = (r: KpiReport, metric: string) =>
  [...new Set(r.rows.filter((x) => x.metric === metric).map((x) => x.dim))]
    .sort()
    .map((dim) => ({ dim, label: dimLabel(dim) }));

/** 운영 DB 일일 지표가 아직 없을 때 차트 자리에 쓰는 말. */
export const KPI_EMPTY = '매일 04:00(KST) 수집이 시작되면 보여요.';

/** 어제(KST) 대비 마지막 행이 며칠 밀렸는지. 행이 없으면 null. */
export function sourceLag(lastDay: string | undefined, yesterday: string | undefined) {
  if (!lastDay || !yesterday) return null;
  return Math.round((Date.parse(yesterday) - Date.parse(lastDay)) / 86_400_000);
}
