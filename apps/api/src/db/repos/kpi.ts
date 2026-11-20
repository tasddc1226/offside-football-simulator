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
import { termPlatform } from '@offside/contracts/acquisition';

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
  'items_held',
  'items_holders',
  'items_used_total',
  'funds_total',
  'funds_holders',
  'market_open',
  'push_topic_base',
  'push_topic_on',
  'push_topic_custom',
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
  'items_used',
  'items_bought',
  'bal_retired_age',
  'bal_retired_peak',
  'bal_retired_legend',
  'bal_retired_ballon',
  'bal_retired_peak_band',
  'bal_elite_seasons',
  'bal_elite_moved',
  'retired_item_top',
  'retired_legacy',
  'seasons_played',
  'acq_visits',
  'acq_started',
  'acq_store_clicks',
  'acq_retired',
  'acq_linked',
  'acq_visits_place',
  'acq_started_place',
  'webpay_orders',
  'webpay_paid',
  'webpay_canceled',
  'fund_in',
  'fund_out',
  'attendance_checkins',
  'attendance_ad_bonus',
  'market_sold',
  'market_volume',
  'market_fee',
  'market_buyers',
  'market_sellers',
  'market_listed',
  'market_cancelled',
] as const;
/**
 * T-11-739 보상형 광고 자리별 시청(시즌 측정 기록의 광고 요약 합). 측정 기록은 이틀 남짓 뒤 R2로 옮겨져 다시 쓰는 사흘 가운데
 * 앞날은 일부만 남는다. 그래서 다 남아 있는 어제 하루만 센다.
 */
export const AD_USAGE_METRICS = [
  'ads_rewarded',
  'ads_free_rewards',
  'ads_interstitial',
  'ads_uploads',
  'ads_uploads_ad_free',
] as const;
/** 광고 요약의 자리 키(contracts AdUsage): 후보 잠재력 · 엿보기 · 강화 · 시즌 결산 · 출석 · 전성기 연장 · 명품 경매. */
const AD_PLACEMENTS = ['c', 'p', 'b', 's', 'a', 'e', 'u'] as const;
/** 최상위 시즌(이적 정체 감시): 시즌 OVR 이 값 이상 · 나이 이 값 이하. */
export const ELITE_OVR = 95;
export const ELITE_MAX_AGE = 31;
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
    itemUses,
    itemBought,
    retiredStats,
    retiredLegacy,
    elite,
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
    // T-11-739 그날 쓴 아이템 장수(아이템을 쓰는 batch가 센다, 하루 네 줄).
    d1.prepare('SELECT item, uses n FROM item_use_daily WHERE day = ?1').bind(day),
    // 그날 산 아이템 팩의 장수(환불 · 테스트 제외). 들어온 양 가운데 산 것과 받은 것을 나눈다.
    d1
      .prepare(
        `SELECT item, coalesce(sum(qty), 0) n FROM iap_purchases
           WHERE test = 0 AND refunded_at IS NULL AND created_at >= ?1 AND created_at < ?2 GROUP BY 1`,
      )
      .bind(start, end),
    // T-11-739 밸런스 이상 감시 · 새 기능 쓰는 비율: 그날 은퇴한 커리어(하루 수백 줄).
    d1
      .prepare(
        `SELECT count(*) n, avg(retire_age) age, avg(peak) peak, avg(legend_score) legend,
           coalesce(sum(ballon > 0), 0) ballon,
           coalesce(sum(peak < 80), 0) lt80, coalesce(sum(peak >= 80 AND peak < 90), 0) p80,
           coalesce(sum(peak >= 90 AND peak < 95), 0) p90, coalesce(sum(peak >= 95), 0) p95
           FROM careers WHERE status = 'retired' AND retired_at >= ?1 AND retired_at < ?2`,
      )
      .bind(start, end),
    d1
      .prepare(
        `SELECT coalesce(item_top, 0) item, coalesce(legacy_tier, 0) legacy, count(*) n
           FROM careers WHERE status = 'retired' AND retired_at >= ?1 AND retired_at < ?2 GROUP BY 1, 2`,
      )
      .bind(start, end),
    // 그날 올라온 최상위 시즌과 그중 전 시즌과 구단이 다른(이적한) 시즌. 2026-11 자유계약 제의 0건처럼 최상위 선수가
    // 한 구단에 묶이는 문제를 대시보드에서 먼저 보려고 센다. 시각 인덱스로 하루만 읽고 전 시즌은 기본 키로 붙인다.
    d1
      .prepare(
        `SELECT count(*) n, coalesce(sum(p.club IS NOT NULL AND p.club <> s.club), 0) moved
           FROM career_seasons s LEFT JOIN career_seasons p ON p.career_id = s.career_id AND p.year = s.year - 1
           WHERE s.created_at >= ?1 AND s.created_at < ?2 AND s.ovr >= ?3 AND s.age <= ?4`,
      )
      .bind(start, end, ELITE_OVR, ELITE_MAX_AGE),
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
  for (const r of itemUses!.results) add('items_used', dimOf(r.item, 'etc'), r.n);
  for (const r of itemBought!.results) add('items_bought', dimOf(r.item, 'etc'), r.n);
  const rs = retiredStats!.results[0];
  if (num(rs?.n) > 0) {
    add('bal_retired_age', 'all', Math.round(num(rs?.age) * 10) / 10);
    add('bal_retired_peak', 'all', Math.round(num(rs?.peak) * 10) / 10);
    add('bal_retired_legend', 'all', Math.round(num(rs?.legend)));
    add('bal_retired_ballon', 'all', rs?.ballon);
    add('bal_retired_peak_band', 'lt80', rs?.lt80);
    add('bal_retired_peak_band', '80_89', rs?.p80);
    add('bal_retired_peak_band', '90_94', rs?.p90);
    add('bal_retired_peak_band', '95p', rs?.p95);
  }
  const itemTop = new Map<string, number>();
  const legacy = new Map<string, number>();
  for (const r of retiredLegacy!.results) {
    const n = num(r.n);
    itemTop.set(String(num(r.item)), (itemTop.get(String(num(r.item))) ?? 0) + n);
    legacy.set(String(num(r.legacy)), (legacy.get(String(num(r.legacy))) ?? 0) + n);
  }
  for (const [dim, n] of itemTop) add('retired_item_top', dim, n);
  for (const [dim, n] of legacy) add('retired_legacy', dim, n);
  const el = elite!.results[0];
  add('bal_elite_seasons', 'all', el?.n);
  add('bal_elite_moved', 'all', el?.moved);
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
    rows.push(...(await collectItemSnapshot(d1)), ...(await collectEngageSnapshot(d1)));
  }
  rows.push(...(await collectFlowDay(d1, day)), ...(await collectEngageDay(d1, day)));
  return rows;
}

/**
 * T-11-739 아이템 지금 상태(어제 수집 때만). 남은 장수 · 가진 사람(1장 이상) · 누적 사용(스카우트권 천장 · 리롤권 마일리지 ·
 * 구단명 변경 기록, 강화권은 누적 기록이 없어 item_use_daily부터 센다). 표가 수천~수만 줄이라 한 번의 왕복으로 훑는다.
 */
export async function collectItemSnapshot(d1: D1Database): Promise<KpiRow[]> {
  const [held, used, funds] = await d1.batch<Record<string, unknown>>([
    d1.prepare(
      'SELECT item, coalesce(sum(qty), 0) qty, coalesce(sum(qty > 0), 0) holders FROM owner_items GROUP BY item',
    ),
    d1.prepare(
      `SELECT 'scout' item, coalesce(sum(used), 0) n FROM scout_pity
       UNION ALL SELECT 'reroll', coalesce(sum(used), 0) FROM reroll_mileage
       UNION ALL SELECT 'rename', count(*) FROM career_renames`,
    ),
    // T-11-742 구단 자금 총량(인플레이션 감시). 구단주 수만큼이라 가볍다.
    d1.prepare(
      'SELECT coalesce(sum(balance), 0) total, coalesce(sum(balance > 0), 0) holders FROM owner_funds',
    ),
  ]);
  const f = funds!.results[0];
  return [
    ...held!.results.flatMap((r) => {
      const dim = dimOf(r.item, 'etc');
      return [
        { metric: 'items_held', dim, value: num(r.qty) },
        { metric: 'items_holders', dim, value: num(r.holders) },
      ];
    }),
    ...used!.results.map((r) => ({
      metric: 'items_used_total',
      dim: dimOf(r.item, 'etc'),
      value: num(r.n),
    })),
    { metric: 'funds_total', dim: 'all', value: num(f?.total) },
    { metric: 'funds_holders', dim: 'all', value: num(f?.holders) },
  ];
}

/**
 * created_at이 at 이상인 첫 행의 id(이분 탐색). 시즌 측정 기록 · 구단 자금 원장은 시각 인덱스가 없고 id가 쓴 순서라,
 * 기본 키로 몇십 번만 짚어 하루의 id 범위를 찾는다. param = 찾는 시각 자리.
 */
const ID_BOUND = (table: string, name: string, param: string) => {
  // 재귀 표는 재귀 쪽 FROM에 한 번만, 하위 질의 밖에 둬야 해서 가운데 행 시각을 두 번 짚는다(기본 키라 가볍다).
  const mid = `coalesce((SELECT created_at FROM ${table} WHERE id >= (a + b) / 2 ORDER BY id LIMIT 1), ${param})`;
  return `${name}(a, b) AS (
    SELECT (SELECT min(id) FROM ${table}), (SELECT max(id) FROM ${table}) + 1
    UNION ALL
    SELECT CASE WHEN ${mid} < ${param} THEN (a + b) / 2 + 1 ELSE a END,
           CASE WHEN ${mid} < ${param} THEN b ELSE (a + b) / 2 END
    FROM ${name} WHERE a < b)`;
};
const sumJson = (path: string) => `coalesce(sum(json_extract(ads_json, '${path}')), 0)`;
const TELEMETRY_BOUND = (name: string, param: string) => ID_BOUND('season_telemetry', name, param);
const AD_USAGE_SQL = `WITH RECURSIVE ${TELEMETRY_BOUND('lo', '?1')}, ${TELEMETRY_BOUND('hi', '?2')}
  SELECT count(*) uploads, coalesce(sum(json_extract(ads_json, '$.af')), 0) af, ${sumJson('$.it')} it,
    ${AD_PLACEMENTS.map((k) => `${sumJson(`$.rw.${k}`)} rw_${k}, ${sumJson(`$.fr.${k}`)} fr_${k}`).join(', ')}
  FROM season_telemetry
  WHERE id >= (SELECT a FROM lo WHERE a >= b) AND id < (SELECT a FROM hi WHERE a >= b) AND ads_json IS NOT NULL`;

const FUND_DAY_SQL = `WITH RECURSIVE ${ID_BOUND('owner_fund_ledger', 'lo', '?1')}, ${ID_BOUND('owner_fund_ledger', 'hi', '?2')}
  SELECT kind, coalesce(sum(max(delta, 0)), 0) gain, coalesce(-sum(min(delta, 0)), 0) spend
  FROM owner_fund_ledger
  WHERE id >= (SELECT a FROM lo WHERE a >= b) AND id < (SELECT a FROM hi WHERE a >= b) GROUP BY kind`;

/** T-11-769 utm_term(메타 동적 값 site_source_name-placement)이 붙은 방문의 'meta:ig' 꼴 나눔. 없으면 null. */
export function placeDim(raw: unknown) {
  const q = new URLSearchParams(String(raw ?? '').replace(/^\?/, ''));
  const platform = termPlatform(q.get('utm_term'));
  const source = q.get('utm_source');
  return platform && source ? dimOf(`${source}:${platform}`, 'etc') : null;
}

/** 'utm_source=meta&utm_campaign=x&utm_content=jp_a' → 'meta:x:jp_a'(없는 칸은 -). 캠페인 없는 방문은 direct. */
export function campaignDim(raw: unknown) {
  const q = new URLSearchParams(String(raw ?? '').replace(/^\?/, ''));
  const parts = ['utm_source', 'utm_campaign', 'utm_content'].map((k) => q.get(k) ?? '');
  return parts.some(Boolean) ? dimOf(parts.map((x) => x || '-').join(':'), 'direct') : 'direct';
}

/**
 * T-11-742 그날 플레이 깊이 · 유입 단계 · 웹 결제 단계 · 구단 자금 흐름.
 * 시즌은 시각 인덱스, 유입은 받은 시각 인덱스로 하루만 읽는다. 유입 · 웹 결제는 그날 들어온(만든) 것 가운데 이어진 단계를
 * 세서, 다시 쓰는 사흘 동안 늦게 시작 · 결제한 것이 채워진다. 웹 결제는 표가 작다. 자금 원장은 id 이분 탐색으로 하루만 읽는다.
 */
export async function collectFlowDay(d1: D1Database, day: string): Promise<KpiRow[]> {
  const { start, end } = kstDayRange(day);
  const [seasons, acq, pay, fund] = await d1.batch<Record<string, unknown>>([
    d1
      .prepare(
        'SELECT count(*) n, count(DISTINCT career_id) careers FROM career_seasons WHERE created_at >= ?1 AND created_at < ?2',
      )
      .bind(start, end),
    d1
      .prepare(
        // T-11-761 은퇴: 그 방문의 프로필에 은퇴한 커리어가 하나라도 있는가(careers_profile_id_idx). 로그인 연결: 그 프로필이
        // 지금 Google · Apple 계정에 이어져 있는가(방문 뒤 연결도 센다). 다시 쓰는 사흘 동안 늦게 은퇴 · 연결한 것이 채워진다.
        `SELECT s.campaign, count(*) visits, count(s.started_at) started, count(s.store_clicked_at) clicks,
                count(CASE WHEN p.google_sub IS NOT NULL OR p.apple_sub IS NOT NULL THEN 1 END) linked,
                coalesce(sum(EXISTS (SELECT 1 FROM careers c WHERE c.profile_id = s.profile_id AND c.status = 'retired')), 0) retired
           FROM acquisition_sessions s LEFT JOIN profiles p ON p.id = s.profile_id
          WHERE s.received_at >= ?1 AND s.received_at < ?2 GROUP BY s.campaign`,
      )
      .bind(start, end),
    d1
      .prepare(
        `SELECT product_id, count(*) n, coalesce(sum(status = 'PAID'), 0) paid, coalesce(sum(status = 'CANCELED'), 0) canceled
           FROM web_pay_orders WHERE test = 0 AND created_at >= ?1 AND created_at < ?2 GROUP BY product_id`,
      )
      .bind(start, end),
    d1.prepare(FUND_DAY_SQL).bind(start, end),
  ]);
  const rows: KpiRow[] = [];
  const sum = (metric: string, dim: string, value: unknown) => {
    const hit = rows.find((r) => r.metric === metric && r.dim === dim);
    if (hit) hit.value += num(value);
    else rows.push({ metric, dim, value: num(value) });
  };
  const sn = seasons!.results[0];
  if (num(sn?.n)) {
    sum('seasons_played', 'all', sn?.n);
    sum('seasons_played', 'careers', sn?.careers);
  }
  for (const r of acq!.results) {
    const dim = campaignDim(r.campaign);
    sum('acq_visits', dim, r.visits);
    sum('acq_started', dim, r.started);
    sum('acq_store_clicks', dim, r.clicks);
    sum('acq_retired', dim, r.retired);
    sum('acq_linked', dim, r.linked);
    const place = placeDim(r.campaign);
    if (place) {
      sum('acq_visits_place', place, r.visits);
      sum('acq_started_place', place, r.started);
    }
  }
  for (const r of pay!.results) {
    const dim = dimOf(
      String(r.product_id ?? '')
        .split('.')
        .at(-1),
      'etc',
    );
    sum('webpay_orders', dim, r.n);
    sum('webpay_paid', dim, r.paid);
    sum('webpay_canceled', dim, r.canceled);
  }
  for (const r of fund!.results) {
    const dim = dimOf(r.kind, 'etc');
    if (num(r.gain)) sum('fund_in', dim, r.gain);
    if (num(r.spend)) sum('fund_out', dim, r.spend);
  }
  return rows;
}

/** T-11-739 그날 시즌 업로드의 광고 요약 합(자리별 보상형 시청 · 광고 제거로 받은 보상 · 은퇴 전면광고). */
export async function collectAdUsageDay(d1: D1Database, day: string): Promise<KpiRow[]> {
  const { start, end } = kstDayRange(day);
  const r = await d1.prepare(AD_USAGE_SQL).bind(start, end).first<Record<string, unknown>>();
  if (!r || !num(r.uploads)) return [];
  return [
    { metric: 'ads_uploads', dim: 'all', value: num(r.uploads) },
    { metric: 'ads_uploads_ad_free', dim: 'all', value: num(r.af) },
    { metric: 'ads_interstitial', dim: 'all', value: num(r.it) },
    ...AD_PLACEMENTS.flatMap((k) => [
      { metric: 'ads_rewarded', dim: k, value: num(r[`rw_${k}`]) },
      { metric: 'ads_free_rewards', dim: k, value: num(r[`fr_${k}`]) },
    ]),
  ];
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
  // T-11-739 광고 요약은 측정 기록이 다 남아 있는 어제만(이어 가는 걸음은 앞 걸음이 이미 썼다).
  if (!prior && yesterday)
    await writeKpiDay(
      ops,
      yesterday,
      'd1',
      await collectAdUsageDay(d1, yesterday),
      now,
      AD_USAGE_METRICS,
    );
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

/**
 * T-11-746 그날 출석(출석 · 광고 보고 한 번 더 받기)과 이적시장(팔린 수 · 거래 대금 · 수수료 · 산 사람 · 판 사람 · 새 등록 · 취소).
 * 출석은 날짜 인덱스, 판매 등록은 (상태, 시각) 인덱스로 하루만 읽는다.
 */
export async function collectEngageDay(d1: D1Database, day: string): Promise<KpiRow[]> {
  const { start, end } = kstDayRange(day);
  const [att, sold, listed, cancelled] = await d1.batch<Record<string, unknown>>([
    d1
      .prepare('SELECT count(*) n, count(ad_claim_id) ad FROM owner_attendance_days WHERE day = ?1')
      .bind(day),
    d1
      .prepare(
        `SELECT count(*) n, coalesce(sum(price), 0) volume, coalesce(sum(fee), 0) fee,
                count(DISTINCT buyer_id) buyers, count(DISTINCT seller_id) sellers
           FROM market_listings WHERE status = 'sold' AND closed_at >= ?1 AND closed_at < ?2`,
      )
      .bind(start, end),
    d1
      .prepare(
        `SELECT count(*) n FROM market_listings
          WHERE status IN ('open', 'sold', 'cancelled') AND created_at >= ?1 AND created_at < ?2`,
      )
      .bind(start, end),
    d1
      .prepare(
        "SELECT count(*) n FROM market_listings WHERE status = 'cancelled' AND closed_at >= ?1 AND closed_at < ?2",
      )
      .bind(start, end),
  ]);
  const a = att!.results[0];
  const s = sold!.results[0];
  const rows: KpiRow[] = [];
  if (num(a?.n)) {
    rows.push({ metric: 'attendance_checkins', dim: 'all', value: num(a?.n) });
    rows.push({ metric: 'attendance_ad_bonus', dim: 'all', value: num(a?.ad) });
  }
  const listedN = num(listed!.results[0]?.n);
  const cancelledN = num(cancelled!.results[0]?.n);
  if (num(s?.n) || listedN || cancelledN)
    rows.push(
      { metric: 'market_sold', dim: 'all', value: num(s?.n) },
      { metric: 'market_volume', dim: 'all', value: num(s?.volume) },
      { metric: 'market_fee', dim: 'all', value: num(s?.fee) },
      { metric: 'market_buyers', dim: 'all', value: num(s?.buyers) },
      { metric: 'market_sellers', dim: 'all', value: num(s?.sellers) },
      { metric: 'market_listed', dim: 'all', value: listedN },
      { metric: 'market_cancelled', dim: 'all', value: cancelledN },
    );
  return rows;
}

/** T-11-746 알림 주제(받고 싶은 알림 고르기 T-11-685). 주제 칸이 비어 있으면 옛 종류 설정을, 설정이 없으면 받기(기본값)를 따른다. */
export const PUSH_TOPICS = {
  match: 'coalesce(p.topic_match, p.team, 1)',
  cup: 'coalesce(p.topic_cup, p.team, 1)',
  league: 'coalesce(p.topic_league, p.team, 1)',
  market: 'coalesce(p.market, 1)',
  friend: 'coalesce(p.topic_friend, p.social, 1)',
  reward: 'coalesce(p.topic_reward, max(coalesce(p.team, 1), coalesce(p.social, 1)))',
  attendance: 'coalesce(p.topic_attendance, p.nudge, 1)',
  comeback: 'coalesce(p.topic_comeback, p.nudge, 1)',
  notice: 'coalesce(p.notice, 1)',
  release: 'coalesce(p.release, 1)',
} as const;
const TOPIC_CHOSEN = ['match', 'cup', 'league', 'friend', 'reward', 'attendance', 'comeback']
  .map((k) => `p.topic_${k} IS NOT NULL`)
  .join(' OR ');

/**
 * T-11-746 지금 상태(어제 수집 때만): 열린 판매 등록 수, 알림을 받을 수 있는 구단주(권한을 준 기기가 있는 프로필, 권한을 보내지
 * 않는 옛 앱 포함) 가운데 주제마다 켜 둔 사람 · 주제를 하나라도 직접 고른 사람. 기기 · 설정 표는 수천 줄이다.
 */
export async function collectEngageSnapshot(d1: D1Database): Promise<KpiRow[]> {
  const [open, topics] = await d1.batch<Record<string, unknown>>([
    d1.prepare("SELECT count(*) n FROM market_listings WHERE status = 'open'"),
    d1.prepare(
      `SELECT count(*) base, coalesce(sum(${TOPIC_CHOSEN}), 0) custom,
              ${Object.entries(PUSH_TOPICS)
                .map(([k, e]) => `coalesce(sum(${e}), 0) t_${k}`)
                .join(', ')}
         FROM (SELECT DISTINCT profile_id FROM push_devices
                WHERE profile_id IS NOT NULL AND (permission IS NULL OR permission IN ('authorized', 'provisional'))) d
         LEFT JOIN push_preferences p ON p.profile_id = d.profile_id`,
    ),
  ]);
  const t = topics!.results[0];
  const rows: KpiRow[] = [{ metric: 'market_open', dim: 'all', value: num(open!.results[0]?.n) }];
  if (num(t?.base)) {
    rows.push(
      { metric: 'push_topic_base', dim: 'all', value: num(t?.base) },
      { metric: 'push_topic_custom', dim: 'all', value: num(t?.custom) },
      ...Object.keys(PUSH_TOPICS).map((k) => ({
        metric: 'push_topic_on',
        dim: k,
        value: num(t?.[`t_${k}`]),
      })),
    );
  }
  return rows;
}
