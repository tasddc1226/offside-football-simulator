// T-11-332 마케팅 읽기 도구. Search Console 검색 성과(GA4와 같은 서비스 계정, 속성에 "제한됨" 사용자로 초대)와
// Meta 광고 성과(Graph API insights, META_ADS_ACCESS_TOKEN이 있을 때만). 둘 다 읽기만 한다.
import type { Tool } from './claude.ts';
import type { Env } from './env.ts';
import { serviceAccountToken } from './google.ts';

const GSC = 'https://searchconsole.googleapis.com/webmasters/v3/sites';
const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
export const GSC_SITE = 'sc-domain:offside-lab.com';
const META_GRAPH = 'https://graph.facebook.com/v21.0';
const DIMENSIONS = ['query', 'page', 'country', 'device', 'date'] as const;

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const kinds = ['mention', 'reply', 'handoff', 'report'];

export function marketingTools(
  env: Env,
  kind: string,
  fetcher: typeof fetch = fetch,
  now = () => Date.now(),
): Tool[] {
  if (!kinds.includes(kind)) return [];
  const tools: Tool[] = [];
  if (env.GA4_SA_EMAIL && env.GA4_SA_KEY)
    tools.push({
      name: 'search_console',
      description:
        'Google 검색 성과(offside-lab.com). days(기본 28, 최대 90) 동안 dimension(query · page · country · device · date, 기본 query)별 클릭 · 노출 · CTR · 평균 순위 상위 limit(기본 10, 최대 25)개. 최근 2~3일은 아직 집계되지 않는다.',
      input_schema: {
        type: 'object',
        properties: {
          days: { type: 'number' },
          dimension: { type: 'string', enum: [...DIMENSIONS] },
          limit: { type: 'number' },
        },
      },
      run: async (input) => {
        const days = Math.min(90, Math.max(1, Number(input.days) || 28));
        const dimension = DIMENSIONS.includes(input.dimension as never)
          ? String(input.dimension)
          : 'query';
        const limit = Math.min(25, Math.max(1, Number(input.limit) || 10));
        const token = await serviceAccountToken(
          { email: env.GA4_SA_EMAIL!, key: env.GA4_SA_KEY!, keyId: env.GA4_KEY_ID },
          GSC_SCOPE,
          fetcher,
          'Search Console',
        );
        const end = now() - 2 * 86_400_000;
        const r = await fetcher(`${GSC}/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: day(end - (days - 1) * 86_400_000),
            endDate: day(end),
            dimensions: [dimension],
            rowLimit: limit,
          }),
        });
        const data = (await r.json().catch(() => ({}))) as {
          rows?: {
            keys: string[];
            clicks: number;
            impressions: number;
            ctr: number;
            position: number;
          }[];
          error?: { message?: string };
        };
        if (!r.ok)
          return `Search Console 읽기 실패 ${r.status} ${data.error?.message ?? ''}`.slice(0, 300);
        if (!data.rows?.length) return `${days}일 동안 검색 기록 없음`;
        return [
          `${dimension} | 클릭 | 노출 | CTR | 평균 순위 (${day(end - (days - 1) * 86_400_000)}~${day(end)})`,
          ...data.rows.map(
            (x) =>
              `${x.keys[0]} | ${x.clicks} | ${x.impressions} | ${(x.ctr * 100).toFixed(1)}% | ${x.position.toFixed(1)}`,
          ),
        ].join('\n');
      },
    });
  if (env.META_ADS_ACCESS_TOKEN && env.META_AD_ACCOUNT_ID)
    tools.push({
      name: 'meta_ads',
      description:
        'Meta(페이스북 · 인스타그램) 광고 성과. days(7 · 14 · 30 중 가까운 쪽, 기본 7) 동안 캠페인별 지출 · 노출 · 클릭 · 랜딩 페이지 조회. 광고를 바꾸지는 못한다.',
      input_schema: { type: 'object', properties: { days: { type: 'number' } } },
      run: async (input) => {
        const days = Math.min(30, Math.max(1, Number(input.days) || 7));
        const u = new URL(`${META_GRAPH}/act_${env.META_AD_ACCOUNT_ID}/insights`);
        u.searchParams.set('fields', 'campaign_name,spend,impressions,clicks,actions');
        u.searchParams.set('level', 'campaign');
        u.searchParams.set(
          'date_preset',
          days <= 7 ? 'last_7d' : days <= 14 ? 'last_14d' : 'last_30d',
        );
        u.searchParams.set('limit', '50');
        const r = await fetcher(u.toString(), {
          headers: { Authorization: `Bearer ${env.META_ADS_ACCESS_TOKEN}` },
        });
        const data = (await r.json().catch(() => ({}))) as {
          data?: {
            campaign_name: string;
            spend: string;
            impressions: string;
            clicks: string;
            actions?: { action_type: string; value: string }[];
          }[];
          error?: { message?: string };
        };
        if (!r.ok || data.error)
          return `Meta 광고 읽기 실패 ${r.status} ${data.error?.message ?? ''}`.slice(0, 300);
        if (!data.data?.length) return '기간 안 광고 성과 없음';
        return [
          '캠페인 | 지출 | 노출 | 클릭 | 랜딩 페이지 조회',
          ...data.data.map(
            (c) =>
              `${c.campaign_name.slice(0, 80)} | ${c.spend} | ${c.impressions} | ${c.clicks} | ${(c.actions ?? []).filter((a) => a.action_type === 'landing_page_view').reduce((n, a) => n + Number(a.value), 0)}`,
          ),
        ].join('\n');
      },
    });
  return tools;
}
