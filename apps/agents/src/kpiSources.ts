// T-11-577 운영 지표 추가 수집: GA4 재방문(코호트) · Meta 국가별 · 스토어(리뷰 · 평점 · 설치) · AdMob 수익.
// 원천마다 필요한 비밀값이 없으면 건너뛴다(kpi.ts runKpiIngest가 고른다). 결과는 (KST 날짜, 행)의 묶음이고,
// 서버는 그 날 · 원천의 보낸 지표만 바꾼다(같은 날 다른 지표는 그대로).
import type { Env } from './env.ts';
import { serviceAccountToken } from './google.ts';
import { ascReady, ascToken, playAccount, playReady, storeApi, type StoreApi } from './reviews.ts';

export type Row = { metric: string; dim: string; value: number };
export type Batch = { day: string; rows: Row[] };
type Fetch = typeof fetch;

const DAY_MS = 86_400_000;
const KST_MS = 9 * 3_600_000;
const META_GRAPH = 'https://graph.facebook.com/v21.0';

/** 'YYYY-MM-DD'에서 n일 전. */
export const dayBefore = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) - n * DAY_MS).toISOString().slice(0, 10);
/** 시각(ms)의 KST 날짜. */
const kstDay = (ms: number) => new Date(ms + KST_MS).toISOString().slice(0, 10);

async function ga4Token(env: Env, fetcher: Fetch) {
  return serviceAccountToken(
    { email: env.GA4_SA_EMAIL!, key: env.GA4_SA_KEY!, keyId: env.GA4_KEY_ID },
    'https://www.googleapis.com/auth/analytics.readonly',
    fetcher,
    'GA4',
  );
}

/**
 * 재방문: day에 끝난 정보로 셀 수 있는 두 코호트. D1 = 전날(day-1) 첫 방문자 중 day에 다시 온 비율, D7 = day-7 첫 방문자 중
 * day에 다시 온 비율. 값은 코호트 날짜(가입한 날)에 넣는다. GA4 코호트는 firstSessionDate 기준이라 운영 DB 가입과 조금 다르다.
 */
export async function ga4RetentionBatches(
  env: Env,
  day: string,
  fetcher: Fetch = fetch,
): Promise<Batch[]> {
  const c1 = dayBefore(day, 1);
  const c7 = dayBefore(day, 7);
  const token = await ga4Token(env, fetcher);
  const r = await fetcher(
    `https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dimensions: [{ name: 'cohort' }, { name: 'cohortNthDay' }],
        metrics: [{ name: 'cohortActiveUsers' }],
        cohortSpec: {
          cohorts: [
            {
              name: 'd1',
              dimension: 'firstSessionDate',
              dateRange: { startDate: c1, endDate: c1 },
            },
            {
              name: 'd7',
              dimension: 'firstSessionDate',
              dateRange: { startDate: c7, endDate: c7 },
            },
          ],
          cohortsRange: { granularity: 'DAILY', startOffset: 0, endOffset: 7 },
        },
      }),
    },
  );
  const data = (await r.json().catch(() => ({}))) as {
    rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[];
    error?: { message?: string };
  };
  if (!r.ok || data.error)
    throw new Error(`GA4 cohort ${r.status} ${data.error?.message ?? ''}`.trim());
  const users = (cohort: string, nth: number) =>
    Number(
      data.rows?.find(
        (x) =>
          x.dimensionValues[0]?.value === cohort && Number(x.dimensionValues[1]?.value) === nth,
      )?.metricValues[0]?.value ?? 0,
    );
  const out: Batch[] = [];
  const base1 = users('d1', 0);
  if (base1 > 0) {
    const back = users('d1', 1);
    out.push({
      day: c1,
      rows: [
        { metric: 'retention_cohort', dim: 'all', value: base1 },
        { metric: 'd1_retained', dim: 'all', value: back },
        { metric: 'd1_retention', dim: 'all', value: back / base1 },
      ],
    });
  }
  const base7 = users('d7', 0);
  if (base7 > 0) {
    const back = users('d7', 7);
    out.push({
      day: c7,
      rows: [
        { metric: 'd7_retained', dim: 'all', value: back },
        { metric: 'd7_retention', dim: 'all', value: back / base7 },
      ],
    });
  }
  return out;
}

/** Meta 국가별 지출 · 설치 · 클릭(계정 전체를 국가로 나눔). 나눔 = 국가 코드 소문자(kr · jp · tw · hk …). */
export async function metaCountryRows(
  env: Env,
  day: string,
  fetcher: Fetch = fetch,
): Promise<Row[]> {
  const u = new URL(`${META_GRAPH}/act_${env.META_AD_ACCOUNT_ID}/insights`);
  u.searchParams.set('level', 'account');
  u.searchParams.set('breakdowns', 'country');
  u.searchParams.set('fields', 'spend,clicks,actions');
  u.searchParams.set('time_range', JSON.stringify({ since: day, until: day }));
  u.searchParams.set('limit', '200');
  const r = await fetcher(u.toString(), {
    headers: { Authorization: `Bearer ${env.META_ADS_ACCESS_TOKEN}` },
  });
  const data = (await r.json().catch(() => ({}))) as {
    data?: {
      country?: string;
      spend?: string;
      clicks?: string;
      actions?: { action_type: string; value: string }[];
    }[];
    error?: { message?: string };
  };
  if (!r.ok || data.error)
    throw new Error(`Meta country ${r.status} ${data.error?.message ?? ''}`.trim());
  const rows: Row[] = [];
  for (const a of data.data ?? []) {
    const dim = (a.country ?? '').toLowerCase().replace(/[^a-z]/g, '') || 'unknown';
    const installs = (a.actions ?? [])
      .filter((x) => x.action_type === 'mobile_app_install')
      .reduce((n, x) => n + Number(x.value), 0);
    rows.push(
      { metric: 'ad_spend_country_krw', dim, value: Number(a.spend) || 0 },
      { metric: 'ad_clicks_country', dim, value: Number(a.clicks) || 0 },
      { metric: 'ad_installs_country', dim, value: installs },
    );
  }
  return rows;
}

/** 그날(KST) 새 리뷰 수와 평균 별점(스토어별). 최근 100개(Play는 최근 7일)만 보므로 하루 100개를 넘으면 모자란다. */
export async function reviewRows(
  env: Env,
  day: string,
  api: StoreApi = storeApi(env),
): Promise<Row[]> {
  const rows: Row[] = [];
  for (const store of ['ios', 'android'] as const) {
    if (store === 'ios' ? !ascReady(env) : !playReady(env)) continue;
    const list = (await api.list(store, 100)).filter((r) => kstDay(r.at) === day);
    rows.push({ metric: 'store_reviews_new', dim: store, value: list.length });
    if (list.length)
      rows.push({
        metric: 'store_review_stars',
        dim: store,
        value: list.reduce((s, r) => s + r.rating, 0) / list.length,
      });
  }
  return rows;
}

/** App Store 전체 평점(한국 스토어, 공개 조회 API). 지금 값이라 수집한 날(어제)에만 넣는다. */
export async function appStoreRatingRows(env: Env, fetcher: Fetch = fetch): Promise<Row[]> {
  const r = await fetcher(`https://itunes.apple.com/lookup?id=${env.ASC_APP_ID}&country=kr`);
  const data = (await r.json().catch(() => ({}))) as {
    results?: { averageUserRating?: number; userRatingCount?: number }[];
  };
  const x = data.results?.[0];
  if (!r.ok || !x?.averageUserRating) throw new Error(`iTunes lookup ${r.status}`);
  return [{ metric: 'store_rating', dim: 'ios', value: x.averageUserRating }];
}

export const ascSalesReady = (env: Env) =>
  Boolean(
    env.ASC_SALES_KEY_ID && env.ASC_SALES_PRIVATE_KEY && env.ASC_ISSUER_ID && env.ASC_VENDOR_NUMBER,
  );

/** 첫 다운로드로 세는 제품 유형(앱 · 유니버설 · iPad · Mac). 업데이트(7) · 재다운로드(3)는 뺀다. */
const FIRST_DOWNLOAD_TYPES = new Set(['1', '1F', '1T', 'F1']);

/**
 * App Store 판매 보고서(일간 요약, gzip TSV)에서 그날 첫 다운로드 수. 보고서는 다음 날 오후(미국 시간)에 나와 어제치는 없을 수 있다
 * (404면 0이 아니라 건너뛴다). 보고서 날짜는 태평양 시간 기준이다.
 */
export async function ascInstallRows(
  env: Env,
  day: string,
  fetcher: Fetch = fetch,
): Promise<Row[] | null> {
  const q = new URLSearchParams({
    'filter[frequency]': 'DAILY',
    'filter[reportType]': 'SALES',
    'filter[reportSubType]': 'SUMMARY',
    'filter[vendorNumber]': env.ASC_VENDOR_NUMBER!,
    'filter[reportDate]': day,
    'filter[version]': '1_1',
  });
  const token = await ascToken(env, Date.now(), {
    keyId: env.ASC_SALES_KEY_ID!,
    pem: env.ASC_SALES_PRIVATE_KEY!,
  });
  const r = await fetcher(`https://api.appstoreconnect.apple.com/v1/salesReports?${q}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/a-gzip' },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`App Store sales ${r.status}`);
  const text = await new Response(r.body!.pipeThrough(new DecompressionStream('gzip'))).text();
  return [{ metric: 'store_installs', dim: 'ios', value: firstDownloads(text) }];
}

/** 판매 보고서 TSV에서 첫 다운로드 Units 합. */
export function firstDownloads(tsv: string) {
  const [head = '', ...lines] = tsv.trim().split('\n');
  const cols = head.split('\t');
  const type = cols.indexOf('Product Type Identifier');
  const units = cols.indexOf('Units');
  if (type < 0 || units < 0) throw new Error('App Store sales: 열을 찾지 못했어요');
  return lines
    .map((l) => l.split('\t'))
    .filter((c) => FIRST_DOWNLOAD_TYPES.has(c[type] ?? ''))
    .reduce((n, c) => n + (Number(c[units]) || 0), 0);
}

export const playInstallsReady = (env: Env) =>
  Boolean(env.PLAY_REPORTS_BUCKET && env.PLAY_PACKAGE && playAccount(env));

/**
 * Play 통계 보고서(월별 overview CSV, UTF-16)에서 그날 "Daily User Installs". 보고서는 하루 이틀 늦게 채워져 그날 줄이 없으면 건너뛴다.
 */
export async function playInstallRows(
  env: Env,
  day: string,
  fetcher: Fetch = fetch,
): Promise<Row[] | null> {
  const token = await serviceAccountToken(
    playAccount(env)!,
    'https://www.googleapis.com/auth/devstorage.read_only',
    fetcher,
    'Google Play 보고서',
  );
  const object = `stats/installs/installs_${env.PLAY_PACKAGE}_${day.slice(0, 7).replace('-', '')}_overview.csv`;
  const r = await fetcher(
    `https://storage.googleapis.com/storage/v1/b/${env.PLAY_REPORTS_BUCKET}/o/${encodeURIComponent(object)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Google Play 보고서 ${r.status}`);
  const value = dailyInstalls(decodeCsv(await r.arrayBuffer()), day);
  return value === null ? null : [{ metric: 'store_installs', dim: 'android', value }];
}

/** Play 보고서는 UTF-16LE(BOM)로 온다. BOM이 없으면 UTF-8로 읽는다. */
export function decodeCsv(buf: ArrayBuffer) {
  const b = new Uint8Array(buf);
  return b[0] === 0xff && b[1] === 0xfe
    ? new TextDecoder('utf-16le').decode(b.subarray(2))
    : new TextDecoder().decode(b);
}

/** overview CSV에서 그날 Daily User Installs(없으면 null). */
export function dailyInstalls(csv: string, day: string) {
  const [head = '', ...lines] = csv.trim().split(/\r?\n/);
  const cols = head.split(',').map((c) => c.trim());
  const date = cols.indexOf('Date');
  const installs = cols.indexOf('Daily User Installs');
  if (date < 0 || installs < 0) throw new Error('Google Play 보고서: 열을 찾지 못했어요');
  const line = lines.map((l) => l.split(',')).find((c) => c[date]?.trim() === day);
  return line ? Number(line[installs]) || 0 : null;
}

export const admobReady = (env: Env) =>
  Boolean(
    env.ADMOB_CLIENT_ID &&
    env.ADMOB_CLIENT_SECRET &&
    env.ADMOB_REFRESH_TOKEN &&
    env.ADMOB_PUBLISHER_ID,
  );

const ADMOB_PLATFORM: Record<string, string> = { IOS: 'ios', ANDROID: 'android' };

/**
 * AdMob 미디에이션 보고서(모든 광고 소스 합, Meta 입찰 포함)를 플랫폼별로. 수익은 원화(추정 수익, 마이크로 단위).
 * 보고서 날짜는 AdMob 계정 시간대(한국으로 설정) 기준이다.
 */
export async function admobRows(env: Env, day: string, fetcher: Fetch = fetch): Promise<Row[]> {
  const t = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.ADMOB_CLIENT_ID!,
      client_secret: env.ADMOB_CLIENT_SECRET!,
      refresh_token: env.ADMOB_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  });
  const tok = (await t.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!tok.access_token) throw new Error(`AdMob 토큰 ${t.status} ${tok.error ?? ''}`.trim());
  const [y, m, d] = day.split('-').map(Number);
  const date = { year: y, month: m, day: d };
  const r = await fetcher(
    `https://admob.googleapis.com/v1/accounts/${env.ADMOB_PUBLISHER_ID}/mediationReport:generate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportSpec: {
          dateRange: { startDate: date, endDate: date },
          dimensions: ['PLATFORM'],
          metrics: ['ESTIMATED_EARNINGS', 'IMPRESSIONS', 'AD_REQUESTS', 'MATCHED_REQUESTS'],
          localizationSettings: { currencyCode: 'KRW' },
        },
      }),
    },
  );
  const data = (await r.json().catch(() => null)) as
    | {
        row?: {
          dimensionValues?: Record<string, { value?: string }>;
          metricValues?: Record<string, { microsValue?: string; integerValue?: string }>;
        };
        error?: { message?: string };
      }[]
    | { error?: { message?: string } }
    | null;
  if (!r.ok || !Array.isArray(data))
    throw new Error(
      `AdMob ${r.status} ${(data as { error?: { message?: string } } | null)?.error?.message ?? ''}`.trim(),
    );
  const rows: Row[] = [];
  for (const x of data) {
    if (!x.row) continue;
    const dim = ADMOB_PLATFORM[x.row.dimensionValues?.PLATFORM?.value ?? ''];
    if (!dim) continue;
    const mv = x.row.metricValues ?? {};
    const int = (k: string) => Number(mv[k]?.integerValue ?? 0);
    rows.push(
      {
        metric: 'ad_revenue_krw',
        dim,
        value: Number(mv.ESTIMATED_EARNINGS?.microsValue ?? 0) / 1e6,
      },
      { metric: 'ad_impressions', dim, value: int('IMPRESSIONS') },
      { metric: 'ad_requests', dim, value: int('AD_REQUESTS') },
      { metric: 'ad_matched', dim, value: int('MATCHED_REQUESTS') },
    );
  }
  return rows;
}
