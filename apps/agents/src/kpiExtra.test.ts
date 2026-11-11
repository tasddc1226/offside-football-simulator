import { describe, expect, it, vi } from 'vitest';
import type { Env } from './env.ts';
import { INSTALL_DAYS, kstDayAgo, runKpiIngest } from './kpi.ts';
import {
  easBatches,
  ga4OptinRows,
  searchBatches,
  socialBatch,
  supportRows,
  voiceBatch,
} from './kpiExtra.ts';
import { VOICE_HEADER } from './voice.ts';

vi.mock('./google.ts', () => ({ serviceAccountToken: async () => 't' }));
const env = (x: Record<string, unknown>) => x as unknown as Env;

describe('운영 지표 새 원천 (T-11-693)', () => {
  it('알림 권유 퍼널은 플랫폼 · 단계별 사용자 수로, OS 응답은 결과까지 나눈다', async () => {
    const row = (p: string, e: string, r: string, n: number) => ({
      dimensionValues: [{ value: p }, { value: e }, { value: r }],
      metricValues: [{ value: String(n) }],
    });
    const fetcher = vi.fn(async () =>
      Response.json({
        rows: [
          row('iOS', 'push_optin_view', '(not set)', 286),
          row('iOS', 'push_optin_pick', '', 2),
          row('iOS', 'push_optin_result', 'granted', 42),
          row('iOS', 'push_optin_result', '(not set)', 3),
          row('Android', 'push_optin_later', '(not set)', 20),
          row('web', 'push_optin_unknown', '', 9),
        ],
      }),
    );
    const out = await ga4OptinRows(env({ GA4_PROPERTY_ID: '1' }), '2026-11-10', fetcher as never);
    expect(Object.fromEntries(out.map((r) => [r.dim, r.value]))).toEqual({
      'ios:view': 286,
      'ios:pick': 2,
      'ios:result:granted': 42,
      'android:later': 20,
    });
    expect(out.every((r) => r.metric === 'push_optin_users')).toBe(true);
  });

  it('검색 성과는 받은 날짜마다 한 묶음으로, 최근 며칠을 한 번에 묻는다', async () => {
    let body: { startDate: string; endDate: string } | undefined;
    const fetcher = vi.fn(async (_u: string, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return Response.json({
        rows: [
          { keys: ['2026-11-07'], clicks: 12, impressions: 300 },
          { keys: ['2026-11-08'], clicks: 9, impressions: 250 },
        ],
      });
    });
    const out = await searchBatches(env({}), '2026-11-10', fetcher as never);
    expect(body).toMatchObject({ startDate: '2026-11-04', endDate: '2026-11-10' });
    expect(out.map((b) => b.day)).toEqual(['2026-11-07', '2026-11-08']);
    expect(out[0]!.rows).toEqual([
      { metric: 'search_clicks', dim: 'all', value: 12 },
      { metric: 'search_impressions', dim: 'all', value: 300 },
    ]);
  });

  it('SNS 팔로워는 한쪽이 실패해도 다른 쪽을 넣고 오류를 남긴다', async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.includes('graph.instagram.com')
        ? Response.json({ followers_count: 321 })
        : Response.json({ error: { message: 'expired' } }, { status: 400 }),
    );
    const LEDGER = { idFromName: () => 'id', get: () => ({ socialToken: async () => undefined }) };
    const out = await socialBatch(
      env({
        INSTAGRAM_ACCESS_TOKEN: 'ig-token-1234',
        THREADS_ACCESS_TOKEN: 'th-token-1234',
        LEDGER,
      }),
      '2026-11-10',
      fetcher as never,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.rows).toEqual([{ metric: 'followers', dim: 'instagram', value: 321 }]);
    expect(out[0]!.error).toContain('expired');
  });

  it('유저 반응 표는 닫지 않은 주제를 종류별로, 그날 처음 나온 주제를 따로 센다', async () => {
    const line = (key: string, kind: string, status: string, first: string) => [
      key,
      '주제',
      kind,
      status,
      '1',
      '1',
      '0',
      '0',
      first,
      first,
    ];
    const fetcher = vi.fn(async () =>
      Response.json({
        values: [
          [...VOICE_HEADER],
          line('a', '버그 의심', '새로', '2026-11-10'),
          line('b', '버그 의심', '반영', '2026-11-01'),
          line('c', '개선 제안', '재언급', '2026-10-20'),
          line('d', '요구사항', '안 함', '2026-11-10'),
        ],
      }),
    );
    const out = await voiceBatch(
      env({ VOICE_SHEET_ID: 's', GA4_SA_EMAIL: 'x', GA4_SA_KEY: 'k', GA4_KEY_ID: 'i' }),
      '2026-11-10',
      fetcher as never,
    );
    expect(out[0]!.rows).toEqual([
      { metric: 'voice_open', dim: 'bug', value: 1 },
      { metric: 'voice_open', dim: 'idea', value: 1 },
      { metric: 'voice_new', dim: 'all', value: 2 },
    ]);
  });

  it('문의 메일은 KST 하루 범위로 목록만 세고, OTA는 운영 채널의 그날 게시만 센다', async () => {
    let q = '';
    const gmail = vi.fn(async (url: string) => {
      if (url.includes('oauth2')) return Response.json({ access_token: 'g', expires_in: 3600 });
      q = decodeURIComponent(new URL(url).searchParams.get('q') ?? '');
      return Response.json({ messages: [{ id: '1' }, { id: '2' }] });
    });
    const mails = await supportRows(
      env({ SUPPORT_QUERY: 'to:help@example.com' }),
      '2026-11-10',
      gmail as never,
    );
    expect(mails).toEqual([{ metric: 'support_mails', dim: 'all', value: 2 }]);
    const start = Date.parse('2026-11-09T15:00:00Z') / 1000;
    expect(q).toContain(`after:${start} before:${start + 86_400}`);

    const eas = vi.fn(async () =>
      Response.json({
        data: {
          app: {
            byId: {
              updateBranches: [
                {
                  name: 'production',
                  updates: [
                    { platform: 'ios', createdAt: '2026-11-10T08:20:00Z' },
                    { platform: 'android', createdAt: '2026-11-10T08:21:00Z' },
                    { platform: 'ios', createdAt: '2026-11-09T14:59:00Z' },
                  ],
                },
                {
                  name: 'preview',
                  updates: [{ platform: 'ios', createdAt: '2026-11-10T01:00:00Z' }],
                },
              ],
            },
          },
        },
      }),
    );
    const out = await easBatches(env({ EXPO_TOKEN: 'e' }), ['2026-11-10'], eas as never);
    expect(out[0]!.rows).toEqual([
      { metric: 'ota_published', dim: 'ios', value: 1 },
      { metric: 'ota_published', dim: 'android', value: 1 },
    ]);
  });

  it('스토어 설치는 어제 차례에 최근 며칠을 거슬러 받고, 늦게 채워진 Play 값도 그날에 넣는다', async () => {
    const at = Date.parse('2026-11-10T23:50:00Z'); // 11-11 08:50 KST
    const late = kstDayAgo(at, 4);
    const csv = ['Date,Package Name,Daily User Installs', `${late},app,37`].join('\n');
    const posts: { day: string; source: string; rows: { metric: string; dim: string }[] }[] = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith('https://storage.googleapis.com')) return new Response(csv);
      if (url.startsWith('https://api.test')) posts.push(JSON.parse(String(init?.body)));
      return Response.json({ ok: true });
    });
    const out = await runKpiIngest(
      env({
        API_BASE: 'https://api.test',
        KPI_INGEST_TOKEN: 'k',
        PLAY_REPORTS_BUCKET: 'b',
        PLAY_PACKAGE: 'app',
        GA4_SA_EMAIL: 'x',
        GA4_SA_KEY: 'k',
      }),
      at,
      fetcher as never,
    );
    const installs = posts.filter((p) => p.rows.some((r) => r.metric === 'store_installs'));
    expect(installs).toEqual([
      {
        day: late,
        source: 'store',
        rows: [{ metric: 'store_installs', dim: 'android', value: 37 }],
      },
    ]);
    // 월별 보고서를 날마다 한 번씩만 묻는다(그제 차례에는 다시 묻지 않는다).
    expect(
      fetcher.mock.calls.filter(([u]) => String(u).startsWith('https://storage.googleapis.com')),
    ).toHaveLength(INSTALL_DAYS);
    expect(out.filter((x) => x.source === 'store' && x.error)).toEqual([]);
  });
});
