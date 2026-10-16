// T-11-299 @mkt GA4 읽기: 서비스 계정(offside-mkt-ga4, GA4 속성 뷰어)으로 Analytics Data API 보고서만 읽는다.
// 비공개 키는 Worker 비밀값 GA4_SA_KEY(PKCS#8 PEM). 키 쌍은 로컬에서 만들고 공개 인증서만 Google에 올렸다.
import type { Tool } from './claude.ts';
import type { Env } from './env.ts';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const DATE = /^(\d{4}-\d{2}-\d{2}|today|yesterday|\d{1,3}daysAgo)$/;
const NAME = /^[A-Za-z][A-Za-z0-9_:]{0,60}$/;

export const ga4Ready = (env: Env) =>
  !!(env.GA4_SA_KEY && env.GA4_SA_EMAIL && env.GA4_KEY_ID && env.GA4_PROPERTY_ID);

const b64u = (b: ArrayBuffer | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b);
  let s = '';
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

let cached: { token: string; until: number } | undefined;

/** 서비스 계정 JWT로 접근 토큰을 받는다(한 시간짜리, 격리 안에서 다시 쓴다). */
async function accessToken(env: Env, fetcher: typeof fetch): Promise<string> {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const der = Uint8Array.from(atob(env.GA4_SA_KEY!.replace(/-----[^-]+-----|\s/g, '')), (c) =>
    c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: env.GA4_KEY_ID }));
  const body = b64u(
    JSON.stringify({
      iss: env.GA4_SA_EMAIL,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const sig = b64u(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`)),
  );
  const r = (await (
    await fetcher(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${head}.${body}.${sig}`,
      }),
    })
  ).json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!r.access_token) throw new Error(`GA4 토큰을 받지 못했어요(${r.error ?? 'unknown'})`);
  cached = { token: r.access_token, until: Date.now() + (r.expires_in ?? 3600) * 1000 };
  return r.access_token;
}

const names = (v: unknown, max: number) =>
  (Array.isArray(v) ? v : [])
    .map(String)
    .filter((n) => NAME.test(n))
    .slice(0, max);

/** 모델 입력을 Data API 요청으로 좁힌다(기간 · 이름 형식 · 개수 상한). 틀리면 이유를 던진다. */
export function reportBody(input: Record<string, unknown>) {
  const start = String(input.start_date ?? '7daysAgo');
  const end = String(input.end_date ?? 'yesterday');
  if (!DATE.test(start) || !DATE.test(end))
    throw new Error('날짜는 YYYY-MM-DD · today · yesterday · NdaysAgo');
  const metrics = names(input.metrics, 6);
  if (!metrics.length) throw new Error('metrics를 하나 이상 주세요');
  const dimensions = names(input.dimensions, 4);
  const f = input.filter as { dimension?: string; value?: string; match?: string } | undefined;
  const filter =
    f?.dimension && NAME.test(f.dimension) && f.value
      ? {
          dimensionFilter: {
            filter: {
              fieldName: f.dimension,
              stringFilter: {
                value: String(f.value).slice(0, 100),
                matchType: f.match === 'contains' ? 'CONTAINS' : 'EXACT',
              },
            },
          },
        }
      : {};
  const order = NAME.test(String(input.order_by ?? '')) ? String(input.order_by) : metrics[0]!;
  return {
    dateRanges: [{ startDate: start, endDate: end }],
    metrics: metrics.map((name) => ({ name })),
    dimensions: dimensions.map((name) => ({ name })),
    ...filter,
    orderBys: [
      metrics.includes(order)
        ? { metric: { metricName: order }, desc: true }
        : { dimension: { dimensionName: order } },
    ],
    limit: Math.min(Math.max(Number(input.limit) || 20, 1), 50),
  };
}

type Report = {
  dimensionHeaders?: { name: string }[];
  metricHeaders?: { name: string }[];
  rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[];
  rowCount?: number;
  error?: { message?: string };
};

/** @mkt GA4 도구. 운영자 지시 · 그 스레드 답글 · 넘겨받은 일에서만 연다. */
export function ga4Tools(env: Env, kind: string, fetcher: typeof fetch = fetch): Tool[] {
  if (!ga4Ready(env) || !['mention', 'reply', 'handoff'].includes(kind)) return [];
  return [
    {
      name: 'ga4_report',
      description:
        'GA4(웹 · 앱 OFFSIDE - Production 속성) 보고서를 읽는다. 표준 이름 예: 측정항목 activeUsers · newUsers · sessions · engagedSessions · eventCount · keyEvents · screenPageViews, 측정기준 date · sessionSourceMedium · sessionCampaignName · firstUserSourceMedium · eventName · country · deviceCategory · platform. 맞춤 측정기준은 customEvent:<이름>. 표로 돌려준다.',
      input_schema: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'YYYY-MM-DD · today · yesterday · NdaysAgo' },
          end_date: { type: 'string' },
          metrics: { type: 'array', items: { type: 'string' }, description: '1~6개' },
          dimensions: { type: 'array', items: { type: 'string' }, description: '0~4개' },
          filter: {
            type: 'object',
            properties: {
              dimension: { type: 'string' },
              value: { type: 'string' },
              match: { type: 'string', enum: ['exact', 'contains'] },
            },
          },
          order_by: { type: 'string', description: '정렬할 측정항목(내림차순) 또는 측정기준' },
          limit: { type: 'number', description: '최대 50' },
        },
        required: ['metrics'],
      },
      run: async (input) => {
        const r = (await (
          await fetcher(
            `https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}:runReport`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${await accessToken(env, fetcher)}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(reportBody(input)),
            },
          )
        ).json()) as Report;
        if (r.error) throw new Error(`GA4: ${(r.error.message ?? '').slice(0, 300)}`);
        const head = [
          ...(r.dimensionHeaders ?? []).map((h) => h.name),
          ...(r.metricHeaders ?? []).map((h) => h.name),
        ];
        const rows = (r.rows ?? []).map((x) => [
          ...x.dimensionValues.map((v) => v.value),
          ...x.metricValues.map((v) => v.value),
        ]);
        return JSON.stringify({ head, rows, rowCount: r.rowCount ?? 0 }).slice(0, 6000);
      },
    },
    {
      name: 'ga4_fields',
      description:
        'GA4 속성의 맞춤 측정기준 · 측정항목 이름 목록(customEvent:… 등). 이름이 맞는지 모를 때만 부른다.',
      input_schema: { type: 'object', properties: {} },
      run: async () => {
        const m = (await (
          await fetcher(
            `https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}/metadata`,
            { headers: { Authorization: `Bearer ${await accessToken(env, fetcher)}` } },
          )
        ).json()) as {
          dimensions?: { apiName: string; customDefinition?: boolean }[];
          metrics?: { apiName: string; customDefinition?: boolean }[];
        };
        return JSON.stringify({
          dimensions: (m.dimensions ?? []).filter((d) => d.customDefinition).map((d) => d.apiName),
          metrics: (m.metrics ?? []).filter((d) => d.customDefinition).map((d) => d.apiName),
        }).slice(0, 4000);
      },
    },
  ];
}
