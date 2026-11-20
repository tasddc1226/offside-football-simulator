import { describe, expect, it, vi } from 'vitest';
import type { Env } from './env.ts';
import {
  ADMOB_BACKFILL_MAX_DAYS,
  dimName,
  kstDayAgo,
  runAdmobBackfill,
  runKpiIngest,
} from './kpi.ts';

describe('운영 지표 수집 (T-11-572)', () => {
  it('KST 날짜와 나눔 이름', () => {
    // 2026-10-29 08:50 KST
    const at = Date.parse('2026-10-28T23:50:00Z');
    expect(kstDayAgo(at, 1)).toBe('2026-10-28');
    expect(kstDayAgo(at, 2)).toBe('2026-10-27');
    expect(dimName('JP App Android — 릴스', '1')).toBe('jp_app_android');
    expect(dimName('한국 웹', '12345')).toBe('12345');
  });

  it('Meta 세트별 지출 · 설치를 어제 · 그제로 넣고, 한 원천 실패는 다른 날을 막지 않는다', async () => {
    const posts: {
      day: string;
      source: string;
      rows: { metric: string; dim: string; value: number }[];
    }[] = [];
    let call = 0;
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith('https://graph.facebook.com')) {
        if (url.includes('breakdowns=country'))
          return Response.json({
            data: [
              {
                country: 'JP',
                spend: '15000',
                clicks: '30',
                actions: [{ action_type: 'mobile_app_install', value: '12' }],
              },
            ],
          });
        // T-11-769 게재 플랫폼별 지출 · 랜딩 조회.
        if (url.includes('breakdowns=publisher_platform'))
          return Response.json({
            data: [
              {
                publisher_platform: 'instagram',
                spend: '1200',
                actions: [{ action_type: 'landing_page_view', value: '9' }],
              },
              { publisher_platform: 'audience_network', spend: '500' },
            ],
          });
        // T-11-761 유입 퍼널: 광고별 성과 → 광고 링크(utm) 묶음.
        if (url.includes('level=ad&'))
          return Response.json({
            data: [
              {
                ad_id: '11',
                adset_id: '9',
                adset_name: 'JP 18-44',
                spend: '1000',
                impressions: '100',
                clicks: '10',
                actions: [{ action_type: 'landing_page_view', value: '7' }],
              },
              {
                ad_id: '12',
                adset_id: '9',
                adset_name: 'JP 18-44',
                spend: '500',
                impressions: '50',
                clicks: '5',
                actions: [{ action_type: 'landing_page_view', value: '3' }],
              },
              {
                ad_id: '13',
                adset_id: '8',
                adset_name: 'JP App',
                spend: '200',
                impressions: '20',
                clicks: '2',
              },
            ],
          });
        if (url.includes('/ads?'))
          return Response.json({
            data: [
              {
                id: '11',
                creative: {
                  asset_feed_spec: {
                    link_urls: [
                      {
                        website_url:
                          'https://offside-lab.com/?utm_source=meta&utm_medium=paid&utm_campaign=global_test&utm_content=jp_reels',
                      },
                    ],
                  },
                },
              },
              {
                id: '12',
                creative: {
                  object_story_spec: {
                    video_data: { call_to_action: { value: { link: 'https://offside-lab.com/' } } },
                  },
                  url_tags: 'utm_source=meta&utm_campaign=global_test&utm_content=JP_Reels',
                },
              },
              {
                id: '13',
                creative: {
                  object_story_spec: {
                    link_data: { link: 'http://play.google.com/store/apps/details?id=x' },
                  },
                },
              },
            ],
          });
        if (call++ === 1) return Response.json({ error: { message: 'rate' } }, { status: 400 });
        return Response.json({
          data: [
            {
              adset_id: '9',
              adset_name: 'JP App Android',
              spend: '15000',
              impressions: '1000',
              clicks: '30',
              actions: [{ action_type: 'mobile_app_install', value: '12' }],
            },
          ],
        });
      }
      expect(url).toBe('https://api.test/v1/internal/kpi');
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer k');
      posts.push(JSON.parse(String(init?.body)));
      return Response.json({ ok: true });
    });
    const env = {
      API_BASE: 'https://api.test',
      KPI_INGEST_TOKEN: 'k',
      META_ADS_ACCESS_TOKEN: 'm',
      META_AD_ACCOUNT_ID: '1',
    } as unknown as Env;
    const out = await runKpiIngest(
      env,
      Date.parse('2026-10-28T23:50:00Z'),
      fetcher as unknown as typeof fetch,
    );
    expect(out.map((x) => [x.day, x.rows ?? 'error'])).toEqual([
      ['2026-10-28', 4],
      ['2026-10-28', 3],
      ['2026-10-28', 10],
      ['2026-10-27', 'error'],
      ['2026-10-27', 3],
      ['2026-10-27', 10],
    ]);
    expect(posts).toHaveLength(5);
    // 같은 utm(대소문자 · url_tags 포함)은 한 소재로 합치고, utm이 없는 앱 설치 광고는 소재 지표에서 빠진다.
    const funnel = posts[2]!.rows;
    expect(funnel).toContainEqual({
      metric: 'ad_spend_content_krw',
      dim: 'meta:global_test:jp_reels',
      value: 1500,
    });
    expect(funnel).toContainEqual({
      metric: 'ad_lpv_content',
      dim: 'meta:global_test:jp_reels',
      value: 10,
    });
    expect(funnel).toContainEqual({ metric: 'ad_lpv', dim: 'jp_18-44', value: 10 });
    expect(funnel).toContainEqual({ metric: 'ad_lpv', dim: 'jp_app', value: 0 });
    expect(funnel.filter((r) => r.metric === 'ad_spend_content_krw')).toHaveLength(1);
    expect(funnel).toContainEqual({ metric: 'ad_spend_platform_krw', dim: 'meta:ig', value: 1200 });
    expect(funnel).toContainEqual({ metric: 'ad_lpv_platform', dim: 'meta:ig', value: 9 });
    expect(funnel).toContainEqual({ metric: 'ad_spend_platform_krw', dim: 'meta:an', value: 500 });
    expect(funnel).toContainEqual({ metric: 'ad_lpv_platform', dim: 'meta:an', value: 0 });
    expect(posts[1]!.rows).toContainEqual({ metric: 'ad_installs_country', dim: 'jp', value: 12 });
    expect(posts[0]!.source).toBe('meta');
    expect(posts[0]!.rows).toContainEqual({
      metric: 'ad_installs',
      dim: 'jp_app_android',
      value: 12,
    });
  });

  it('토큰이 없으면 아무것도 하지 않는다', async () => {
    const fetcher = vi.fn();
    expect(await runKpiIngest({ API_BASE: 'x' } as unknown as Env, 0, fetcher)).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('runAdmobBackfill', () => {
  const env = {
    API_BASE: 'https://api.test',
    KPI_INGEST_TOKEN: 'k',
    ADMOB_CLIENT_ID: 'c',
    ADMOB_CLIENT_SECRET: 's',
    ADMOB_REFRESH_TOKEN: 'r',
    ADMOB_PUBLISHER_ID: 'pub-1',
  } as unknown as Env;

  it('그끄제부터 거꾸로 날마다 AdMob을 넣고, 실패한 날은 오류로 남긴다', async () => {
    const posts: { day: string; source: string }[] = [];
    let reports = 0;
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('oauth2')) return new Response(JSON.stringify({ access_token: 't' }));
      if (url.includes('mediationReport')) {
        reports += 1;
        if (reports === 2) return new Response('{}', { status: 500 });
        return new Response(
          JSON.stringify([
            {
              row: {
                dimensionValues: {
                  PLATFORM: { value: 'Android' },
                  AD_UNIT: { displayLabel: 'Reward' },
                  FORMAT: { value: 'REWARDED' },
                },
                metricValues: {
                  ESTIMATED_EARNINGS: { microsValue: '1000000' },
                  IMPRESSIONS: { integerValue: '3' },
                },
              },
            },
          ]),
        );
      }
      posts.push(JSON.parse(String(init?.body)));
      return new Response('{}');
    });
    const out = await runAdmobBackfill(
      env,
      Date.parse('2026-11-17T03:00:00Z'),
      3,
      fetcher as unknown as typeof fetch,
    );
    expect(out.map((x) => [x.day, x.rows === undefined ? 'error' : 'ok'])).toEqual([
      ['2026-11-14', 'ok'],
      ['2026-11-13', 'error'],
      ['2026-11-12', 'ok'],
    ]);
    expect(posts.map((p) => [p.source, p.day])).toEqual([
      ['admob', '2026-11-14'],
      ['admob', '2026-11-12'],
    ]);
  });

  it('날 수는 0 ~ 60으로 자르고, 자격 증명이 없으면 아무것도 하지 않는다', async () => {
    const fetcher = vi.fn();
    expect(await runAdmobBackfill(env, 0, 0, fetcher)).toEqual([]);
    expect(await runAdmobBackfill({ API_BASE: 'x' } as unknown as Env, 0, 5, fetcher)).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
    expect(ADMOB_BACKFILL_MAX_DAYS).toBe(60);
  });
});
