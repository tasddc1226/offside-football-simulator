import {
  IAP_PRICE_KRW,
  REMOVE_ADS_PRICE_SQL,
  REMOVE_ADS_PRODUCT,
} from '@offside/contracts/admin-items';
import { MEMBERSHIP_PRODUCT_ID } from '@offside/contracts/membership';
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

/**
 * 운영 D1 지표 이름. `active` · `members_autorenew_off`는 지금 상태라 그날 바로 다음(어제)만 셀 수 있어 다시 쓰기 · 거꾸로 채우기에서 뺀다.
 * T-11-577 멤버십 흐름: 새 가입(구독 묶음이 처음 생긴 날) · 갱신(스토어 갱신 알림) · 만료(지금 끝난 묶음의 끝난 날, 다시 결제하면 날이 옮겨 간다).
 * `client_errors`는 그날 앱 · 웹 오류 횟수(플랫폼별).
 */
export const D1_SNAPSHOT_METRICS = [
  'active',
  'members_autorenew_off',
  'push_devices',
  'db_size_mb',
] as const;
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
  'members_new',
  'members_renewed',
  'members_expired',
  'comments',
  'client_errors',
  'cup_entries',
  'api_requests',
  'api_errors',
  'api_slow',
  'api_avg_ms',
] as const;
/**
 * T-11-693 보낸 알림 하루치(주제별). 대시보드 푸시 화면이 운영 표를 다시 훑지 않게 일일 수집으로 옮겼다.
 * 받는 사람 = 알림 한 건, 도달 = 엑스포가 받은 건, 누름 = 도달한 알림을 누른 건, 실패 = 기기 단위 발송 실패.
 */
export const PUSH_METRICS = [
  'push_recipients',
  'push_delivered',
  'push_clicked',
  'push_failed',
] as const;
/** 라운지 채팅은 채팅방 저장소에 CHAT_KEEP_MS(7일)만 남아, 다시 쓰는 최근 며칠만 센다. */
export const CHAT_METRICS = ['chat', 'chat_writers'] as const;
/** 방마다 그 구간의 메시지 수 · 쓴 사람 수(채팅방 저장소가 답한다). */
export type ChatCounter = (
  startMs: number,
  endMs: number,
) => Promise<{ room: string; messages: number; writers: number }[]>;
const DIM = /[^a-z0-9_:.-]/g;
const dimOf = (v: unknown, fallback: string) =>
  String(v ?? '')
    .toLowerCase()
    .replace(DIM, '_')
    .slice(0, 64) || fallback;

/** 운영 D1에서 KST 하루치 지표를 모은다(쓰지 않는다). withActive: 접속자(세션 마지막 접속) · 자동 갱신 끈 구독자처럼 지금 상태도 센다. */
export async function collectD1Day(
  d1: D1Database,
  day: string,
  withActive: boolean,
  /** T-11-662 클라이언트 오류는 운영 기록 DB에 있다(없으면 게임 DB). */
  ops: D1Database = d1,
): Promise<KpiRow[]> {
  const { start, end } = kstDayRange(day);
  const [
    signups,
    active,
    careersNew,
    retired,
    iap,
    adFree,
    passes,
    members,
    comments,
    memberNew,
    memberRenewed,
    memberExpired,
    autoRenewOff,
    cupEntries,
    devices,
  ] = await d1.batch<Record<string, unknown>>([
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
    d1
      .prepare(
        `SELECT store, count(*) n FROM memberships
           WHERE test = 0 AND created_at >= ?1 AND created_at < ?2 GROUP BY 1`,
      )
      .bind(start, end),
    d1
      .prepare(
        `SELECT store, count(*) n FROM billing_alerts WHERE test = 0 AND kind = 'renewal' AND product_id = ?3
           AND created_at >= ?1 AND created_at < ?2 GROUP BY 1`,
      )
      .bind(start, end, MEMBERSHIP_PRODUCT_ID),
    d1
      .prepare(
        `SELECT store, count(*) n FROM memberships WHERE test = 0 AND until >= ?1 AND until < ?2 GROUP BY 1`,
      )
      .bind(start, end),
    d1
      .prepare(
        `SELECT store, count(DISTINCT profile_id) n FROM memberships
           WHERE test = 0 AND auto_renew = 0 AND created_at < ?1 AND until >= ?1 GROUP BY 1`,
      )
      .bind(end),
    // 대회는 몇 개뿐이라 최근 대회만 고른 뒤 그 대회의 참가 줄(기본 키 앞부분)만 읽는다.
    d1
      .prepare(
        `SELECT count(*) n FROM cups c JOIN cup_entries e ON e.cup_id = c.id
           WHERE c.created_at >= ?3 AND e.created_at >= ?1 AND e.created_at < ?2`,
      )
      .bind(start, end, new Date(Date.parse(start) - 60 * DAY_MS).toISOString()),
    // 지금 상태(기기 등록 표는 수천 줄). 권한을 아직 보내지 않은 옛 앱은 unknown.
    d1.prepare(
      `SELECT platform, coalesce(permission, 'unknown') permission, count(*) n FROM push_devices GROUP BY 1, 2`,
    ),
  ]);
  const [errors, api] = await ops.batch<Record<string, unknown>>([
    ops
      .prepare('SELECT platform, sum(count) n FROM client_errors WHERE day = ?1 GROUP BY 1')
      .bind(day),
    ops
      .prepare(
        `SELECT sum(requests) requests, sum(errors) errors, sum(slow) slow, sum(total_ms) ms
           FROM api_status_buckets WHERE bucket >= ?1 AND bucket < ?2`,
      )
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
  for (const r of memberNew!.results) add('members_new', String(r.store), r.n);
  for (const r of memberRenewed!.results) add('members_renewed', String(r.store), r.n);
  for (const r of memberExpired!.results) add('members_expired', String(r.store), r.n);
  if (withActive)
    for (const r of autoRenewOff!.results) add('members_autorenew_off', String(r.store), r.n);
  for (const r of errors!.results) add('client_errors', String(r.platform), r.n);
  add('cup_entries', 'all', cupEntries!.results[0]?.n);
  const a = api!.results[0];
  if (num(a?.requests) > 0) {
    add('api_requests', 'all', a?.requests);
    add('api_errors', 'all', a?.errors);
    add('api_slow', 'all', a?.slow);
    add('api_avg_ms', 'all', Math.round(num(a?.ms) / num(a?.requests)));
  }
  if (withActive) {
    for (const r of devices!.results)
      add('push_devices', `${dimOf(r.platform, 'unknown')}:${dimOf(r.permission, 'unknown')}`, r.n);
    // D1이 쿼리마다 돌려주는 파일 크기. 로컬 · 테스트 D1은 값이 없어 건너뛴다.
    const size = (m: unknown) => num((m as { size_after?: number } | undefined)?.size_after);
    const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);
    if (size(signups!.meta) > 0) add('db_size_mb', 'game', mb(size(signups!.meta)));
    if (ops !== d1 && size(errors!.meta) > 0) add('db_size_mb', 'ops', mb(size(errors!.meta)));
  }
  return rows;
}

/** 그날 만든 알림의 발송 결과(주제별). 알림 시각 인덱스 범위 하루만 읽고 발송 결과 · 누름은 알림 ID로 붙인다. */
const PUSH_DAY_SQL = `SELECT coalesce(n.topic, CASE WHEN n.kind = 'news' THEN json_extract(n.target_json, '$.board') END, n.kind) cat,
         count(DISTINCT n.id) recipients,
         count(DISTINCT CASE WHEN r.accepted_at IS NOT NULL THEN n.id END) delivered,
         count(DISTINCT CASE WHEN r.accepted_at IS NOT NULL AND i.clicked_at IS NOT NULL THEN n.id END) clicked,
         coalesce(sum(r.state = 'failed'), 0) failed
       FROM notifications n JOIN push_results r ON r.notification_id = n.id
       LEFT JOIN push_interactions i ON i.notification_id = n.id
       WHERE n.created_at >= ?1 AND n.created_at < ?2 AND n.kind <> 'test' GROUP BY 1`;

/** 여러 날의 알림 지표를 한 번의 왕복으로 모은다(날마다 한 문장, 돌려주는 순서는 days와 같다). */
export async function collectPushDays(
  d1: D1Database,
  days: readonly string[],
): Promise<KpiRow[][]> {
  if (!days.length) return [];
  const got = await d1.batch<Record<string, unknown>>(
    days.map((day) => {
      const { start, end } = kstDayRange(day);
      return d1.prepare(PUSH_DAY_SQL).bind(start, end);
    }),
  );
  return got.map((g) =>
    g.results.flatMap((r) => {
      const dim = dimOf(r.cat, 'etc');
      return [
        { metric: 'push_recipients', dim, value: num(r.recipients) },
        { metric: 'push_delivered', dim, value: num(r.delivered) },
        { metric: 'push_clicked', dim, value: num(r.clicked) },
        { metric: 'push_failed', dim, value: num(r.failed) },
      ];
    }),
  );
}
export const collectPushDay = async (d1: D1Database, day: string) =>
  (await collectPushDays(d1, [day]))[0]!;

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
  await d1.batch(kpiDayStatements(d1, day, source, rows, now, metrics));
}
function kpiDayStatements(
  d1: D1Database,
  day: string,
  source: KpiSource,
  rows: KpiRow[],
  now: string,
  metrics: readonly string[],
) {
  return [
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
  ];
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

export type KpiDailyResult = { done: boolean; written: string[]; push?: string[] };
/** 알림 지표를 처음 켤 때 거꾸로 채울 날 수와 한 걸음에 채울 날 수(하루가 알림 표 하루 범위 한 번). */
export const PUSH_BACKFILL_DAYS = 30;
const PUSH_BACKFILL_STEP = 3;

/**
 * 일일 cron `kpi` 단계. 첫 걸음은 최근 KPI_REWRITE_DAYS일을 다시 쓰고, 운영 D1 기록이 KPI_BACKFILL_DAYS일보다 짧으면
 * 걸음마다 KPI_BACKFILL_STEP일씩 거꾸로 채운다(이어 가는 걸음은 prior가 있다).
 */
export async function runKpiDaily(
  d1: D1Database,
  at: number,
  prior?: KpiDailyResult,
  /** T-11-662 kpi_daily · client_errors가 있는 운영 기록 DB(없으면 게임 DB). */
  ops: D1Database = d1,
  /** T-11-693 라운지 채팅 수(채팅방이 없으면 세지 않는다). */
  chat?: ChatCounter,
): Promise<KpiDailyResult> {
  const now = new Date(at).toISOString();
  const targets = prior ? [] : kstPastDays(at, KPI_REWRITE_DAYS);
  const oldest = kstPastDays(at, KPI_BACKFILL_DAYS).at(-1)!;
  const first = await ops
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
    const rows = await collectD1Day(d1, day, withActive, ops);
    await writeKpiDay(
      ops,
      day,
      'd1',
      rows,
      now,
      withActive ? [...D1_METRICS, ...D1_SNAPSHOT_METRICS] : D1_METRICS,
    );
  }
  // 알림 · 채팅은 따로 쓴다. 늦게 누른 알림을 반영하려고 최근 며칠을 다시 쓰고, 알림은 걸음마다 며칠씩 거꾸로 채운다.
  const pushOldest = kstPastDays(at, PUSH_BACKFILL_DAYS).at(-1)!;
  const pushFirst = await ops
    .prepare(
      "SELECT min(day) day FROM kpi_daily WHERE source = 'd1' AND metric = 'push_recipients'",
    )
    .first<{ day: string | null }>();
  // 알림이 하나도 없던 날은 행이 없어 '가장 오래된 날'이 그대로다. 이어 가는 걸음은 앞 걸음이 채운 날에서 잇는다.
  const pushFrom =
    [pushFirst?.day, prior?.push?.at(-1)].filter((d): d is string => !!d).sort()[0] ??
    targets.at(-1) ??
    pushOldest;
  const pushOlder = kstPastDays(Date.parse(`${pushFrom}T00:00:00Z`), PUSH_BACKFILL_STEP).filter(
    (d) => d >= pushOldest,
  );
  const pushDays = [...targets, ...pushOlder.filter((d) => !targets.includes(d))];
  if (pushDays.length) {
    const pushRows = await collectPushDays(d1, pushDays);
    await ops.batch(
      pushDays.flatMap((day, i) =>
        kpiDayStatements(ops, day, 'd1', pushRows[i]!, now, PUSH_METRICS),
      ),
    );
  }
  if (chat)
    for (const day of targets) {
      const { start, end } = kstDayRange(day);
      // 채팅방이 답하지 못해도 다른 지표는 이미 썼다. 그날 채팅 지표만 비워 두고 다음 날 다시 쓴다.
      const rooms = await chat(Date.parse(start), Date.parse(end)).catch(() => null);
      if (!rooms) break;
      await writeKpiDay(
        ops,
        day,
        'd1',
        rooms.flatMap((r) => [
          { metric: 'chat', dim: dimOf(r.room, 'etc'), value: r.messages },
          { metric: 'chat_writers', dim: dimOf(r.room, 'etc'), value: r.writers },
        ]),
        now,
        CHAT_METRICS,
      );
    }
  const pushDone = pushOlder.length < PUSH_BACKFILL_STEP || pushOlder.at(-1) === pushOldest;
  return {
    done: (older.length < KPI_BACKFILL_STEP || older.at(-1) === oldest) && pushDone,
    written: days,
    push: pushDays,
  };
}
