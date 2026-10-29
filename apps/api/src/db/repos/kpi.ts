import {
  IAP_PRICE_KRW,
  REMOVE_ADS_PRICE_SQL,
  REMOVE_ADS_PRODUCT,
} from '@offside/contracts/admin-items';
import { SEASON_PASS_PRICE_KRW } from '@offside/contracts/season-pass';
import {
  KPI_EXTERNAL_METRICS,
  type KpiReport,
  type KpiRow,
  type KpiSource,
} from '@offside/contracts';
import { DAY_MS, KST_MS } from '@offside/contracts/kst';

// T-11-572 운영 지표 대시보드. 일일 cron `kpi` 단계가 운영 D1에서 KST 하루치를 모아 kpi_daily에 넣고,
// 대시보드(admin.offside-lab.com)는 GET /v1/admin/kpi로 이 표만 읽는다. 모든 집계는 시각 인덱스 범위 한 날만 읽는다.

/** 늦게 들어오는 기록(환불 · 스토어 알림)을 반영하려고 매일 최근 며칠을 다시 쓴다. */
export const KPI_REWRITE_DAYS = 3;
export const KPI_MAX_DAYS = 400;

const PRICE_SQL = `CASE product_id ${Object.entries(IAP_PRICE_KRW)
  .map(([id, krw]) => `WHEN '${id}' THEN ${Math.trunc(krw)}`)
  .join(' ')} ELSE 0 END`;

/** KST 날짜 'YYYY-MM-DD'의 [0시, 다음 날 0시) UTC ISO. */
export function kstDayRange(day: string) {
  const start = Date.parse(`${day}T00:00:00Z`) - KST_MS;
  return { start: new Date(start).toISOString(), end: new Date(start + DAY_MS).toISOString() };
}

/** at 기준 어제부터 거꾸로 n일(KST). */
export function kstPastDays(at: number, n: number) {
  const today = Math.floor((at + KST_MS) / DAY_MS) * DAY_MS;
  return Array.from({ length: n }, (_, i) =>
    new Date(today - (i + 1) * DAY_MS).toISOString().slice(0, 10),
  );
}

const num = (v: unknown) => Number(v ?? 0);

/** 운영 D1 지표 이름. `active`는 그날 바로 다음(어제)만 셀 수 있어 다시 쓰기 · 거꾸로 채우기에서 뺀다. */
export const D1_METRICS = [
  'signups',
  'careers_new',
  'careers_retired',
  'iap_count',
  'iap_krw',
  'iap_buyers',
  'ad_free_count',
  'ad_free_krw',
  'pass_count',
  'pass_krw',
  'members_active',
  'comments',
] as const;

/** 운영 D1에서 KST 하루치 지표를 모은다(쓰지 않는다). withActive: 접속자(세션 마지막 접속)도 센다. */
export async function collectD1Day(
  d1: D1Database,
  day: string,
  withActive: boolean,
): Promise<KpiRow[]> {
  const { start, end } = kstDayRange(day);
  const [signups, active, careersNew, retired, iap, adFree, passes, members, comments] =
    await d1.batch<Record<string, unknown>>([
      d1
        .prepare(
          `SELECT count(*) n, coalesce(sum(google_sub IS NOT NULL OR apple_sub IS NOT NULL), 0) linked
           FROM profiles WHERE created_at >= ?1 AND created_at < ?2 AND deleted_at IS NULL`,
        )
        .bind(start, end),
      // 다음 날 다시 들어온 세션은 last_seen_at이 넘어가 빠진다(수집 04:00 KST라 4시간분 근사).
      d1
        .prepare(
          `SELECT channel, count(DISTINCT profile_id) n FROM sessions
           WHERE last_seen_at >= ?1 AND last_seen_at < ?2 GROUP BY 1`,
        )
        .bind(start, end),
      d1
        .prepare(`SELECT count(*) n FROM careers WHERE created_at >= ?1 AND created_at < ?2`)
        .bind(start, end),
      d1
        .prepare(
          `SELECT count(*) n FROM careers WHERE status = 'retired' AND retired_at >= ?1 AND retired_at < ?2`,
        )
        .bind(start, end),
      d1
        .prepare(
          `SELECT store, count(*) n, coalesce(sum(${PRICE_SQL}), 0) krw, count(DISTINCT profile_id) buyers
           FROM iap_purchases WHERE test = 0 AND refunded_at IS NULL AND created_at >= ?1 AND created_at < ?2
           GROUP BY 1`,
        )
        .bind(start, end),
      d1
        .prepare(
          `SELECT store, coalesce(sum(kind = 'purchase'), 0) - coalesce(sum(kind = 'refund'), 0) n,
           coalesce(sum(CASE kind WHEN 'refund' THEN -1 ELSE 1 END * ${REMOVE_ADS_PRICE_SQL}), 0) krw
           FROM billing_alerts WHERE test = 0 AND product_id = ?3 AND kind IN ('purchase', 'refund')
           AND created_at >= ?1 AND created_at < ?2 GROUP BY 1`,
        )
        .bind(start, end, REMOVE_ADS_PRODUCT),
      d1
        .prepare(
          `SELECT store, count(*) n FROM season_passes
           WHERE test = 0 AND refunded_at IS NULL AND created_at >= ?1 AND created_at < ?2 GROUP BY 1`,
        )
        .bind(start, end),
      d1
        .prepare(
          `SELECT store, count(DISTINCT profile_id) n FROM memberships
           WHERE test = 0 AND created_at < ?1 AND until >= ?1 GROUP BY 1`,
        )
        .bind(end),
      d1
        .prepare(`SELECT count(*) n FROM board_comments WHERE created_at >= ?1 AND created_at < ?2`)
        .bind(start, end),
    ]);
  const rows: KpiRow[] = [];
  const add = (metric: string, dim: string, value: unknown) =>
    rows.push({ metric, dim, value: num(value) });
  const s = signups!.results[0];
  add('signups', 'all', s?.n);
  add('signups', 'linked', s?.linked);
  if (withActive) for (const r of active!.results) add('active', String(r.channel), r.n);
  add('careers_new', 'all', careersNew!.results[0]?.n);
  add('careers_retired', 'all', retired!.results[0]?.n);
  for (const r of iap!.results) {
    add('iap_count', String(r.store), r.n);
    add('iap_krw', String(r.store), r.krw);
    add('iap_buyers', String(r.store), r.buyers);
  }
  for (const r of adFree!.results) {
    add('ad_free_count', String(r.store), r.n);
    add('ad_free_krw', String(r.store), r.krw);
  }
  for (const r of passes!.results) {
    add('pass_count', String(r.store), r.n);
    add('pass_krw', String(r.store), num(r.n) * SEASON_PASS_PRICE_KRW);
  }
  for (const r of members!.results) add('members_active', String(r.store), r.n);
  add('comments', 'all', comments!.results[0]?.n);
  return rows;
}

/**
 * 한 날 · 한 원천에서 metrics(없으면 rows에 있는 지표)를 통째로 바꾼다. 그날 사라진 나눔이 남지 않게 먼저 지운다.
 * 넣지 않은 다른 지표는 그대로 둔다(외부 원천이 지표를 나눠 보내도 된다).
 */
export async function writeKpiDay(
  d1: D1Database,
  day: string,
  source: KpiSource,
  rows: KpiRow[],
  now: string,
  metrics: readonly string[] = [...new Set(rows.map((r) => r.metric))],
) {
  if (!metrics.length) return;
  await d1.batch([
    d1
      .prepare(
        `DELETE FROM kpi_daily WHERE day = ? AND source = ? AND metric IN (${metrics.map(() => '?').join(',')})`,
      )
      .bind(day, source, ...metrics),
    ...rows.map((r) =>
      d1
        .prepare(
          `INSERT INTO kpi_daily (day, metric, dim, value, source, updated_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(day, metric, dim) DO UPDATE SET value = excluded.value, source = excluded.source,
           updated_at = excluded.updated_at`,
        )
        .bind(day, r.metric, r.dim, r.value, source, now),
    ),
  ]);
}

/** 외부 원천이 넣을 수 있는 지표인지(운영 D1 지표를 덮어쓰지 못하게). */
export const externalMetricAllowed = (source: KpiSource, metric: string) =>
  source !== 'd1' && (KPI_EXTERNAL_METRICS[source] as readonly string[]).includes(metric);

export async function kpiReport(d1: D1Database, now: Date, days: number): Promise<KpiReport> {
  const list = kstPastDays(now.getTime(), days).reverse();
  const [rows, sources] = await d1.batch<Record<string, unknown>>([
    d1
      .prepare(
        'SELECT day, metric, dim, value FROM kpi_daily WHERE day >= ? ORDER BY day, metric, dim',
      )
      .bind(list[0]),
    d1.prepare(
      'SELECT source, max(day) day, max(updated_at) updatedAt FROM kpi_daily GROUP BY source',
    ),
  ]);
  return {
    generatedAt: now.toISOString(),
    days: list,
    rows: rows!.results.map((r) => ({
      day: String(r.day),
      metric: String(r.metric),
      dim: String(r.dim),
      value: num(r.value),
    })),
    sources: sources!.results.map((r) => ({
      source: r.source as KpiSource,
      lastDay: String(r.day),
      updatedAt: String(r.updatedAt),
    })),
  };
}

/** 처음 켤 때 거꾸로 채울 날 수와 한 번(cron 한 걸음)에 채울 날 수. */
export const KPI_BACKFILL_DAYS = 90;
const KPI_BACKFILL_STEP = 7;

export type KpiDailyResult = { done: boolean; written: string[] };

/**
 * 일일 cron `kpi` 단계. 첫 걸음은 최근 KPI_REWRITE_DAYS일을 다시 쓰고, 운영 D1 기록이 KPI_BACKFILL_DAYS일보다 짧으면
 * 걸음마다 KPI_BACKFILL_STEP일씩 거꾸로 채운다(이어 가는 걸음은 prior가 있다).
 */
export async function runKpiDaily(
  d1: D1Database,
  at: number,
  prior?: KpiDailyResult,
): Promise<KpiDailyResult> {
  const now = new Date(at).toISOString();
  const targets = prior ? [] : kstPastDays(at, KPI_REWRITE_DAYS);
  const oldest = kstPastDays(at, KPI_BACKFILL_DAYS).at(-1)!;
  const first = await d1
    .prepare("SELECT min(day) day FROM kpi_daily WHERE source = 'd1'")
    .first<{ day: string | null }>();
  const from = first?.day ? first.day : targets.at(-1);
  const older = from
    ? kstPastDays(Date.parse(`${from}T00:00:00Z`), KPI_BACKFILL_DAYS)
        .filter((d) => d >= oldest)
        .slice(0, KPI_BACKFILL_STEP)
    : [];
  const days = [...targets, ...older.filter((d) => !targets.includes(d))];
  const yesterday = kstPastDays(at, 1)[0];
  for (const day of days) {
    const withActive = day === yesterday && !prior;
    const rows = await collectD1Day(d1, day, withActive);
    await writeKpiDay(
      d1,
      day,
      'd1',
      rows,
      now,
      withActive ? [...D1_METRICS, 'active'] : D1_METRICS,
    );
  }
  return { done: older.length < KPI_BACKFILL_STEP || older.at(-1) === oldest, written: days };
}
