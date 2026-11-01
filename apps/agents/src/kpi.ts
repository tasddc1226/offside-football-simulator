// T-11-572 운영 지표 대시보드 2단계: 매일 08:50 KST 보고 cron에서 외부 지표(GA4 · Meta 광고 · 스토어 · AdMob, T-11-577 kpiSources.ts) 하루치를 받아
// 운영 API `/v1/internal/kpi`(비밀값 KPI_INGEST_TOKEN)로 넣는다. 원천 하나가 실패해도 나머지는 넣는다.
// GA4는 하루 넘게 값이 바뀌므로 어제와 그제를 함께 다시 보낸다(서버는 그 날 · 원천 · 지표를 통째로 바꾼다).
import type { Env } from './env.ts';
import { ga4Ready } from './ga4.ts';
import { serviceAccountToken } from './google.ts';
import {
  admobReady,
  admobRows,
  appStoreRatingRows,
  ascInstallRows,
  ascSalesReady,
  ga4RetentionBatches,
  metaCountryRows,
  playInstallRows,
  playInstallsReady,
  reviewRows,
  type Batch,
  type Row,
} from './kpiSources.ts';
import { reviewsReady, storeApi } from './reviews.ts';

type Fetch = typeof fetch;

const KST_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;
const META_GRAPH = 'https://graph.facebook.com/v21.0';

export const kpiReady = (env: Env) => !!(env.API_BASE && env.KPI_INGEST_TOKEN);

/** at 기준 n일 전 KST 날짜. */
export const kstDayAgo = (at: number, n: number) =>
  new Date(Math.floor((at + KST_MS) / DAY_MS) * DAY_MS - n * DAY_MS).toISOString().slice(0, 10);

/** 지표 나눔 이름(서버 규칙 [a-z0-9_:.-]{1,64}). 한글만 있는 이름은 fallback(id)을 쓴다. */
export function dimName(name: string, fallback: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9_:.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return slug || fallback.replace(/[^a-z0-9_:.-]/gi, '').slice(0, 64) || 'unknown';
}

const PLATFORM: Record<string, string> = { web: 'web', ios: 'ios', android: 'android' };

export async function ga4Rows(env: Env, day: string, fetcher: Fetch = fetch): Promise<Row[]> {
  const token = await serviceAccountToken(
    { email: env.GA4_SA_EMAIL!, key: env.GA4_SA_KEY!, keyId: env.GA4_KEY_ID },
    'https://www.googleapis.com/auth/analytics.readonly',
    fetcher,
    'GA4',
  );
  const r = await fetcher(
    `https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate: day, endDate: day }],
        dimensions: [{ name: 'platform' }],
        metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }, { name: 'sessions' }],
      }),
    },
  );
  const data = (await r.json().catch(() => ({}))) as {
    rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[];
    error?: { message?: string };
  };
  if (!r.ok || data.error) throw new Error(`GA4 ${r.status} ${data.error?.message ?? ''}`.trim());
  const rows: Row[] = [];
  for (const x of data.rows ?? []) {
    const dim = PLATFORM[(x.dimensionValues[0]?.value ?? '').toLowerCase()];
    if (!dim) continue;
    const [dau, fresh, sessions] = x.metricValues.map((v) => Number(v.value) || 0);
    rows.push(
      { metric: 'dau', dim, value: dau ?? 0 },
      { metric: 'new_users', dim, value: fresh ?? 0 },
      { metric: 'sessions', dim, value: sessions ?? 0 },
    );
  }
  return rows;
}

export async function metaRows(env: Env, day: string, fetcher: Fetch = fetch): Promise<Row[]> {
  const u = new URL(`${META_GRAPH}/act_${env.META_AD_ACCOUNT_ID}/insights`);
  u.searchParams.set('level', 'adset');
  u.searchParams.set('fields', 'adset_id,adset_name,spend,impressions,clicks,actions');
  u.searchParams.set('time_range', JSON.stringify({ since: day, until: day }));
  u.searchParams.set('limit', '100');
  const r = await fetcher(u.toString(), {
    headers: { Authorization: `Bearer ${env.META_ADS_ACCESS_TOKEN}` },
  });
  const data = (await r.json().catch(() => ({}))) as {
    data?: {
      adset_id: string;
      adset_name?: string;
      spend?: string;
      impressions?: string;
      clicks?: string;
      actions?: { action_type: string; value: string }[];
    }[];
    error?: { message?: string };
  };
  if (!r.ok || data.error) throw new Error(`Meta ${r.status} ${data.error?.message ?? ''}`.trim());
  const rows: Row[] = [];
  for (const a of data.data ?? []) {
    const dim = dimName(a.adset_name ?? '', a.adset_id);
    const installs = (a.actions ?? [])
      .filter((x) => x.action_type === 'mobile_app_install')
      .reduce((n, x) => n + Number(x.value), 0);
    rows.push(
      { metric: 'ad_spend_krw', dim, value: Number(a.spend) || 0 },
      { metric: 'ad_impressions_paid', dim, value: Number(a.impressions) || 0 },
      { metric: 'ad_clicks', dim, value: Number(a.clicks) || 0 },
      { metric: 'ad_installs', dim, value: installs },
    );
  }
  return rows;
}

async function ingest(env: Env, day: string, source: string, rows: Row[], fetcher: Fetch) {
  const r = await fetcher(`${env.API_BASE}/v1/internal/kpi`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.KPI_INGEST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ day, source, rows }),
  });
  if (!r.ok) throw new Error(`kpi ingest ${source} ${day} ${r.status}`);
}

/**
 * 원천마다 어제 · 그제를 넣는다. 결과는 원천 · 날짜별 성공 행 수 또는 오류.
 * 서버는 보낸 지표를 그 날 통째로 바꾸므로(나눔 포함) 한 지표의 나눔은 한 번에 보낸다(예: 설치 iOS · 안드로이드).
 */
export async function runKpiIngest(env: Env, at: number, fetcher: Fetch = fetch) {
  if (!kpiReady(env)) return [];
  const yesterday = kstDayAgo(at, 1);
  const tasks: [string, (day: string) => Promise<Batch[]>][] = [];
  const one = (f: (day: string) => Promise<Row[]>) => async (day: string) => [
    { day, rows: await f(day) },
  ];
  if (ga4Ready(env)) {
    tasks.push(['ga4', one((d) => ga4Rows(env, d, fetcher))]);
    tasks.push(['ga4', (d) => ga4RetentionBatches(env, d, fetcher)]);
  }
  if (env.META_ADS_ACCESS_TOKEN && env.META_AD_ACCOUNT_ID) {
    tasks.push(['meta', one((d) => metaRows(env, d, fetcher))]);
    tasks.push(['meta', one((d) => metaCountryRows(env, d, fetcher))]);
  }
  if (reviewsReady(env))
    tasks.push(['store', one((d) => reviewRows(env, d, storeApi(env, fetcher)))]);
  if (env.ASC_APP_ID)
    tasks.push([
      'store',
      async (d) =>
        d === yesterday ? [{ day: d, rows: await appStoreRatingRows(env, fetcher) }] : [],
    ]);
  if (ascSalesReady(env) || playInstallsReady(env))
    tasks.push([
      'store',
      // 한 스토어가 실패해도 다른 스토어 설치는 넣고, 실패는 결과에 남긴다.
      async (d) => {
        const got = await Promise.allSettled([
          ascSalesReady(env) ? ascInstallRows(env, d, fetcher) : null,
          playInstallsReady(env) ? playInstallRows(env, d, fetcher) : null,
        ]);
        const rows = got.flatMap((x) => (x.status === 'fulfilled' ? (x.value ?? []) : []));
        const error = got
          .flatMap((x) => (x.status === 'rejected' ? [String(x.reason)] : []))
          .join(' · ');
        if (!rows.length && error) throw new Error(error);
        return rows.length ? [{ day: d, rows, ...(error ? { error } : {}) }] : [];
      },
    ]);
  if (admobReady(env)) tasks.push(['admob', one((d) => admobRows(env, d, fetcher))]);
  const out: { source: string; day: string; rows?: number; error?: string }[] = [];
  for (const day of [yesterday, kstDayAgo(at, 2)])
    for (const [source, collect] of tasks) {
      try {
        for (const b of await collect(day)) {
          await ingest(env, b.day, source, b.rows, fetcher);
          out.push({
            source,
            day: b.day,
            rows: b.rows.length,
            ...(b.error ? { error: b.error.slice(0, 200) } : {}),
          });
        }
      } catch (e) {
        out.push({ source, day, error: String(e).slice(0, 200) });
      }
    }
  return out;
}
