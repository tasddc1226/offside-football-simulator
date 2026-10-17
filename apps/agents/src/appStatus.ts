// T-11-332 앱 출시 상태 한 번에: App Store 버전 · 심사 상태(ASC API, 리뷰 키로 읽힘), Google Play 안정성(Play Developer
// Reporting API: 비정상 종료율 · ANR율 · 많이 난 오류), EAS 빌드 · OTA(Expo GraphQL). 읽기만 한다. 되돌리기 · 다시 내보내기는
// 운영자가 GitHub 워크플로로 한다(도구에 없다).
import type { Tool } from './claude.ts';
import type { Env } from './env.ts';
import { serviceAccountToken } from './google.ts';
import { ascReady, ascToken, playAccount } from './reviews.ts';

const ASC = 'https://api.appstoreconnect.apple.com/v1';
const REPORTING = 'https://playdeveloperreporting.googleapis.com/v1beta1/apps';
const REPORTING_SCOPE = 'https://www.googleapis.com/auth/playdeveloperreporting';
const EXPO_GRAPHQL = 'https://api.expo.dev/graphql';
/** apps/mobile/app.json extra.eas.projectId */
export const EXPO_PROJECT_ID = 'bacad4c8-df2f-4fc5-8938-b02d060fbc45';

type GDate = { year: number; month: number; day: number; timeZone?: { id: string } };
type Metric = { metric: string; decimalValue?: { value: string } };

const pct = (v?: string) => (v == null ? '?' : `${(Number(v) * 100).toFixed(2)}%`);
const ymd = (d: GDate) =>
  `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
const kst = (iso?: string) =>
  iso ? new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(5, 16).replace('T', ' ') : '?';

/** GDate에서 n일 전(시간대는 그대로). */
export function daysBefore(d: GDate, n: number): GDate {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day - n));
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth() + 1,
    day: t.getUTCDate(),
    ...(d.timeZone ? { timeZone: d.timeZone } : {}),
  };
}

async function json<T>(r: Response, label: string): Promise<T> {
  const data = (await r.json().catch(() => ({}))) as T & {
    error?: { message?: string };
    errors?: { title?: string; detail?: string; message?: string }[];
  };
  if (!r.ok || data.errors?.length) {
    const why = data.error?.message ?? data.errors?.[0]?.detail ?? data.errors?.[0]?.message ?? '';
    throw new Error(`${label} ${r.status} ${why}`.trim().slice(0, 200));
  }
  return data;
}

export async function iosStatus(env: Env, fetcher: typeof fetch = fetch): Promise<string[]> {
  const r = await fetcher(
    `${ASC}/apps/${env.ASC_APP_ID}/appStoreVersions?limit=4&fields[appStoreVersions]=versionString,appStoreState,platform,createdDate`,
    { headers: { Authorization: `Bearer ${await ascToken(env)}` } },
  );
  const d = await json<{
    data: { attributes: { versionString: string; appStoreState: string; createdDate: string } }[];
  }>(r, 'App Store Connect');
  return d.data.map(
    ({ attributes: a }) =>
      `- ${a.versionString}: ${a.appStoreState} (만듦 ${kst(a.createdDate)} KST)`,
  );
}

export async function androidVitals(env: Env, fetcher: typeof fetch = fetch): Promise<string[]> {
  const token = await serviceAccountToken(
    playAccount(env)!,
    REPORTING_SCOPE,
    fetcher,
    'Google Play 안정성',
  );
  const base = `${REPORTING}/${env.PLAY_PACKAGE}`;
  const auth = { Authorization: `Bearer ${token}` };
  const out: string[] = [];
  for (const [set, rate, label] of [
    ['crashRateMetricSet', 'crashRate', '비정상 종료율'],
    ['anrRateMetricSet', 'anrRate', 'ANR율'],
  ] as const) {
    const meta = await json<{
      freshnessInfo?: { freshnesses?: { aggregationPeriod: string; latestEndTime: GDate }[] };
    }>(await fetcher(`${base}/${set}`, { headers: auth }), `Play ${label}`);
    const end = meta.freshnessInfo?.freshnesses?.find(
      (f) => f.aggregationPeriod === 'DAILY',
    )?.latestEndTime;
    if (!end) {
      out.push(`- ${label}: 집계 없음`);
      continue;
    }
    const q = await json<{ rows?: { startTime: GDate; metrics: Metric[] }[] }>(
      await fetcher(`${base}/${set}:query`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timelineSpec: { aggregationPeriod: 'DAILY', startTime: daysBefore(end, 7), endTime: end },
          metrics: [rate, 'distinctUsers'],
        }),
      }),
      `Play ${label}`,
    );
    const rows = q.rows ?? [];
    const val = (m: Metric[], k: string) => m.find((x) => x.metric === k)?.decimalValue?.value;
    out.push(
      rows.length
        ? `- ${label}(일별, 사용자 수): ${rows.map((r) => `${ymd(r.startTime).slice(5)} ${pct(val(r.metrics, rate))} (${val(r.metrics, 'distinctUsers') ?? '?'}명)`).join(' · ')}`
        : `- ${label}: ${ymd(end)}까지 기록 없음`,
    );
  }
  const issues = await json<{
    errorIssues?: {
      type: string;
      cause?: string;
      location?: string;
      errorReportCount?: string;
      distinctUsers?: string;
      lastAppVersion?: { versionCode?: string };
    }[];
  }>(await fetcher(`${base}/errorIssues:search?pageSize=5`, { headers: auth }), 'Play 오류 묶음');
  for (const i of issues.errorIssues ?? [])
    out.push(
      `- ${i.type} ${i.cause ?? ''} @ ${i.location ?? '?'}: ${i.errorReportCount ?? '?'}건 · ${i.distinctUsers ?? '?'}명 · 마지막 버전 코드 ${i.lastAppVersion?.versionCode ?? '?'}`.slice(
        0,
        300,
      ),
    );
  if (!issues.errorIssues?.length) out.push('- 많이 난 오류: 없음');
  return out;
}

export async function easStatus(env: Env, fetcher: typeof fetch = fetch): Promise<string[]> {
  const query = `query($id:String!){ app { byId(appId:$id){
    builds(offset:0, limit:6){ platform status appVersion appBuildVersion buildProfile createdAt error { message } }
    updateBranches(offset:0, limit:5){ name updates(offset:0, limit:2){ message runtimeVersion platform createdAt } } } } }`;
  const d = await json<{
    data: {
      app: {
        byId: {
          builds: {
            platform: string;
            status: string;
            appVersion?: string;
            appBuildVersion?: string;
            buildProfile?: string;
            createdAt: string;
            error?: { message?: string } | null;
          }[];
          updateBranches: {
            name: string;
            updates: {
              message?: string;
              runtimeVersion: string;
              platform: string;
              createdAt: string;
            }[];
          }[];
        };
      };
    };
  }>(
    await fetcher(EXPO_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.EXPO_TOKEN}` },
      body: JSON.stringify({ query, variables: { id: EXPO_PROJECT_ID } }),
    }),
    'EAS',
  );
  const app = d.data.app.byId;
  return [
    ...app.builds.map(
      (b) =>
        `- 빌드 ${b.platform} ${b.appVersion ?? '?'} (${b.appBuildVersion ?? '?'}) ${b.buildProfile ?? ''}: ${b.status} · ${kst(b.createdAt)} KST${b.error?.message ? ` · ${b.error.message.slice(0, 120)}` : ''}`,
    ),
    ...app.updateBranches
      .filter((br) => br.name === 'production')
      .flatMap((br) =>
        br.updates.map(
          (u) =>
            `- OTA production ${u.platform}: ${(u.message ?? '').slice(0, 80)} · ${kst(u.createdAt)} KST · 런타임 ${u.runtimeVersion.slice(0, 8)}`,
        ),
      ),
  ];
}

export function appStatusTools(env: Env, fetcher: typeof fetch = fetch): Tool[] {
  return [
    {
      name: 'app_status',
      description:
        '앱 출시 상태 한 번에(읽기만). App Store 버전별 심사 · 출시 상태, Google Play 지난 7일 비정상 종료율 · ANR율과 많이 난 오류 묶음(Play 집계는 1~2일 늦다), EAS 최근 빌드 · production OTA. part: ios · android · eas · all(기본). 앱 · 웹 화면 오류 묶음은 d1_query로 client_errors 표를 본다.',
      input_schema: {
        type: 'object',
        properties: { part: { type: 'string', enum: ['ios', 'android', 'eas', 'all'] } },
      },
      run: async (input) => {
        const part = typeof input.part === 'string' ? input.part : 'all';
        const sections: [string, string, boolean, () => Promise<string[]>][] = [
          ['ios', '**App Store**', ascReady(env), () => iosStatus(env, fetcher)],
          [
            'android',
            '**Google Play 안정성**',
            Boolean(env.PLAY_PACKAGE && playAccount(env)),
            () => androidVitals(env, fetcher),
          ],
          ['eas', '**EAS 빌드 · OTA**', Boolean(env.EXPO_TOKEN), () => easStatus(env, fetcher)],
        ];
        const out: string[] = [];
        for (const [key, title, ready, load] of sections) {
          if (part !== 'all' && part !== key) continue;
          if (!ready) {
            out.push(`${title}\n- 연결 안 됨(비밀값 없음)`);
            continue;
          }
          try {
            out.push(`${title}\n${(await load()).join('\n')}`);
          } catch (e) {
            out.push(`${title}\n- 읽지 못함: ${String((e as Error).message ?? e).slice(0, 200)}`);
          }
        }
        return out.join('\n\n').slice(0, 8000);
      },
    },
  ];
}
