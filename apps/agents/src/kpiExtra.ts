// T-11-693 운영 지표 대시보드에 더한 원천: 알림 권유 퍼널(GA4) · SNS 팔로워 · 검색 성과 · 유저 반응 표 · 고객 문의 메일 · OTA 게시.
// 에이전트가 이미 쓰는 자격 증명만 쓴다. 비밀값이 없는 원천은 kpi.ts runKpiIngest가 건너뛴다.
import { EXPO_PROJECT_ID } from './appStatus.ts';
import type { Env } from './env.ts';
import { serviceAccountToken } from './google.ts';
import type { Batch, Row } from './kpiSources.ts';
import { GSC_SITE } from './marketing.ts';
import { getJson, IG_GRAPH, IG_LOGIN_GRAPH, liveToken, THREADS_GRAPH } from './social.ts';
import { appGmail, gmailReady } from './support.ts';
import { parseRows, sheets, voiceEnabled } from './voice.ts';

type Fetch = typeof fetch;
const KST_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;
const kstDayOf = (ms: number) => new Date(ms + KST_MS).toISOString().slice(0, 10);
/** KST 날짜의 시작 시각(ms). */
const kstStart = (day: string) => Date.parse(`${day}T00:00:00Z`) - KST_MS;
const googleAccount = (env: Env) => ({
  email: env.GA4_SA_EMAIL!,
  key: env.GA4_SA_KEY!,
  keyId: env.GA4_KEY_ID,
});

const OPTIN = 'push_optin_';
const PLATFORMS = new Set(['web', 'ios', 'android']);
const OPTIN_STEPS = new Set(['view', 'accept', 'pick', 'later', 'result']);
const OPTIN_RESULTS = new Set(['granted', 'denied', 'blocked', 'failed']);

/**
 * 알림 권유 퍼널: 그날 단계별 사용자 수. dim은 `플랫폼:단계`, OS 응답은 `플랫폼:result:granted`처럼 결과까지 붙인다.
 * 단계마다 사람을 따로 세므로 같은 사람이 여러 단계에 들어간다(나눔을 더해 전체를 만들지 않는다).
 */
export async function ga4OptinRows(env: Env, day: string, fetcher: Fetch = fetch): Promise<Row[]> {
  const token = await serviceAccountToken(
    googleAccount(env),
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
        dimensions: [{ name: 'platform' }, { name: 'eventName' }, { name: 'customEvent:result' }],
        metrics: [{ name: 'totalUsers' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            stringFilter: { matchType: 'BEGINS_WITH', value: OPTIN },
          },
        },
        limit: 200,
      }),
    },
  );
  const data = (await r.json().catch(() => ({}))) as {
    rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[];
    error?: { message?: string };
  };
  if (!r.ok || data.error) throw new Error(`GA4 ${r.status} ${data.error?.message ?? ''}`.trim());
  const sum = new Map<string, number>();
  for (const x of data.rows ?? []) {
    const [platform = '', event = '', result = ''] = x.dimensionValues.map((v) =>
      v.value.toLowerCase(),
    );
    const step = event.slice(OPTIN.length);
    if (!PLATFORMS.has(platform) || !OPTIN_STEPS.has(step)) continue;
    if (step === 'result' && !OPTIN_RESULTS.has(result)) continue;
    const dim = step === 'result' ? `${platform}:result:${result}` : `${platform}:${step}`;
    sum.set(dim, (sum.get(dim) ?? 0) + (Number(x.metricValues[0]?.value) || 0));
  }
  return [...sum].map(([dim, value]) => ({ metric: 'push_optin_users', dim, value }));
}

const igReady = (env: Env) =>
  !!(
    env.INSTAGRAM_ACCESS_TOKEN ||
    ((env.META_GRAPH_TOKEN ?? env.META_ADS_ACCESS_TOKEN) && env.META_IG_USER_ID)
  );
export const socialReady = (env: Env) => igReady(env) || !!env.THREADS_ACCESS_TOKEN;

/** 인스타그램 · Threads 팔로워 수. 지금 값이라 수집한 날(어제)에만 넣는다. 한쪽이 실패하면 다른 쪽만 넣고 오류를 남긴다. */
export async function socialBatch(env: Env, day: string, fetcher: Fetch = fetch): Promise<Batch[]> {
  const jobs: Promise<Row>[] = [];
  if (igReady(env))
    jobs.push(
      (async () => {
        const login = env.INSTAGRAM_ACCESS_TOKEN;
        const token = login
          ? await liveToken(env, 'instagram')
          : (env.META_GRAPH_TOKEN ?? env.META_ADS_ACCESS_TOKEN)!;
        const u = new URL(
          `${login ? IG_LOGIN_GRAPH : IG_GRAPH}/${login ? 'me' : env.META_IG_USER_ID}`,
        );
        u.searchParams.set('fields', 'followers_count');
        const d = (await getJson(fetcher, u, token)) as { followers_count?: number };
        if (typeof d.followers_count !== 'number') throw new Error('Instagram 팔로워 값 없음');
        return { metric: 'followers', dim: 'instagram', value: d.followers_count };
      })(),
    );
  if (env.THREADS_ACCESS_TOKEN)
    jobs.push(
      (async () => {
        const u = new URL(`${THREADS_GRAPH}/me/threads_insights`);
        u.searchParams.set('metric', 'followers_count');
        const d = (await getJson(fetcher, u, await liveToken(env, 'threads'))) as {
          data?: { name?: string; total_value?: { value?: number } }[];
        };
        const v = d.data?.find((m) => m.name === 'followers_count')?.total_value?.value;
        if (typeof v !== 'number') throw new Error('Threads 팔로워 값 없음');
        return { metric: 'followers', dim: 'threads', value: v };
      })(),
    );
  const got = await Promise.allSettled(jobs);
  const rows = got.flatMap((x) => (x.status === 'fulfilled' ? [x.value] : []));
  const error = got.flatMap((x) => (x.status === 'rejected' ? [String(x.reason)] : [])).join(' · ');
  if (!rows.length && error) throw new Error(error);
  return rows.length ? [{ day, rows, ...(error ? { error } : {}) }] : [];
}

/** 검색 성과는 이틀쯤 늦게 확정된다. 그래서 어제까지 최근 SEARCH_DAYS일을 날짜별로 받아 매일 다시 쓴다(값이 없는 날은 건너뜀). */
export const SEARCH_DAYS = 7;
export async function searchBatches(
  env: Env,
  yesterday: string,
  fetcher: Fetch = fetch,
): Promise<Batch[]> {
  const token = await serviceAccountToken(
    googleAccount(env),
    'https://www.googleapis.com/auth/webmasters.readonly',
    fetcher,
    'Search Console',
  );
  const end = Date.parse(`${yesterday}T00:00:00Z`);
  const r = await fetcher(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: new Date(end - (SEARCH_DAYS - 1) * DAY_MS).toISOString().slice(0, 10),
        endDate: yesterday,
        dimensions: ['date'],
        rowLimit: SEARCH_DAYS,
      }),
    },
  );
  const data = (await r.json().catch(() => ({}))) as {
    rows?: { keys: string[]; clicks: number; impressions: number }[];
    error?: { message?: string };
  };
  if (!r.ok) throw new Error(`Search Console ${r.status} ${data.error?.message ?? ''}`.trim());
  return (data.rows ?? [])
    .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.keys[0] ?? ''))
    .map((x) => ({
      day: x.keys[0]!,
      rows: [
        { metric: 'search_clicks', dim: 'all', value: Number(x.clicks) || 0 },
        { metric: 'search_impressions', dim: 'all', value: Number(x.impressions) || 0 },
      ],
    }));
}

const VOICE_KIND: Record<string, string> = {
  '버그 의심': 'bug',
  '개선 제안': 'idea',
  요구사항: 'request',
}; // i18n-ignore: 시트 저장값
const VOICE_CLOSED = new Set(['반영', '안 함']); // i18n-ignore: 시트 저장값
export { voiceEnabled as voiceReady };

/** 유저 반응 표: 아직 닫지 않은 주제 수(종류별, 지금 값)와 그날 처음 나온 주제 수. 수집한 날(어제)에만 넣는다. */
export async function voiceBatch(env: Env, day: string, fetcher: Fetch = fetch): Promise<Batch[]> {
  const rows = parseRows(await sheets(env, fetcher).read());
  const open = new Map<string, number>();
  let fresh = 0;
  for (const r of rows) {
    if (r.first === day) fresh += 1;
    if (VOICE_CLOSED.has(r.status)) continue;
    const kind = VOICE_KIND[r.kind] ?? 'etc';
    open.set(kind, (open.get(kind) ?? 0) + 1);
  }
  return [
    {
      day,
      rows: [
        ...[...open].map(([dim, value]) => ({ metric: 'voice_open', dim, value })),
        { metric: 'voice_new', dim: 'all', value: fresh },
      ],
    },
  ];
}

export { gmailReady as supportReady };
/** 그날(KST) 받은 고객 문의 메일 수. 목록만 읽고 본문은 열지 않는다(최대 500통). */
export async function supportRows(env: Env, day: string, fetcher: Fetch = fetch): Promise<Row[]> {
  const g = await appGmail(env, fetcher);
  const start = Math.floor(kstStart(day) / 1000);
  const q = `${env.SUPPORT_QUERY} after:${start} before:${start + 86_400} -from:me -in:spam -in:trash`;
  const list = await g<{ messages?: { id: string }[] }>(
    `/messages?maxResults=500&q=${encodeURIComponent(q)}`,
  );
  return [{ metric: 'support_mails', dim: 'all', value: list.messages?.length ?? 0 }];
}

/** 운영 채널에 게시한 OTA 수(플랫폼별). 최근 게시 50건을 받아 어제 · 그제 것만 센다. */
export async function easBatches(
  env: Env,
  days: readonly string[],
  fetcher: Fetch = fetch,
): Promise<Batch[]> {
  const query = `query($id:String!){ app { byId(appId:$id){
    updateBranches(offset:0, limit:10){ name updates(offset:0, limit:50){ platform createdAt } } } } }`;
  const r = await fetcher('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.EXPO_TOKEN}` },
    body: JSON.stringify({ query, variables: { id: EXPO_PROJECT_ID } }),
  });
  const data = (await r.json().catch(() => ({}))) as {
    data?: {
      app?: {
        byId?: {
          updateBranches?: { name: string; updates: { platform: string; createdAt: string }[] }[];
        };
      };
    };
    errors?: { message?: string }[];
  };
  if (!r.ok || data.errors?.length)
    throw new Error(`EAS ${r.status} ${data.errors?.[0]?.message ?? ''}`.trim());
  const updates =
    data.data?.app?.byId?.updateBranches?.find((b) => b.name === 'production')?.updates ?? [];
  return days.map((day) => {
    const count = new Map<string, number>([
      ['ios', 0],
      ['android', 0],
    ]);
    for (const u of updates) {
      const p = u.platform.toLowerCase();
      if (count.has(p) && kstDayOf(Date.parse(u.createdAt)) === day)
        count.set(p, count.get(p)! + 1);
    }
    return {
      day,
      rows: [...count].map(([dim, value]) => ({ metric: 'ota_published', dim, value })),
    };
  });
}
