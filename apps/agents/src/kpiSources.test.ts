import { describe, expect, it, vi } from 'vitest';
import type { Env } from './env.ts';
import {
  admobRows,
  dailyInstalls,
  dayBefore,
  decodeCsv,
  firstDownloads,
  ga4RetentionBatches,
  reviewRows,
} from './kpiSources.ts';
import type { StoreApi, StoreReview } from './reviews.ts';

vi.mock('./google.ts', () => ({ serviceAccountToken: async () => 't' }));

describe('운영 지표 추가 수집 (T-11-577)', () => {
  it('재방문은 코호트 날짜(가입한 날)에 비율 · 분자 · 분모로 넣는다', async () => {
    let body: { cohortSpec: { cohorts: { dateRange: { startDate: string } }[] } } | undefined;
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      const row = (c: string, n: number, v: number) => ({
        dimensionValues: [{ value: c }, { value: String(n).padStart(4, '0') }],
        metricValues: [{ value: String(v) }],
      });
      return Response.json({
        rows: [row('d1', 0, 200), row('d1', 1, 50), row('d7', 0, 100), row('d7', 7, 9)],
      });
    });
    const out = await ga4RetentionBatches(
      { GA4_PROPERTY_ID: '1' } as unknown as Env,
      '2026-10-28',
      fetcher as unknown as typeof fetch,
    );
    expect(body!.cohortSpec.cohorts.map((c) => c.dateRange.startDate)).toEqual([
      '2026-10-27',
      '2026-10-21',
    ]);
    expect(out).toEqual([
      {
        day: '2026-10-27',
        rows: [
          { metric: 'retention_cohort', dim: 'all', value: 200 },
          { metric: 'd1_retained', dim: 'all', value: 50 },
          { metric: 'd1_retention', dim: 'all', value: 0.25 },
        ],
      },
      {
        day: '2026-10-21',
        rows: [
          { metric: 'd7_retained', dim: 'all', value: 9 },
          { metric: 'd7_retention', dim: 'all', value: 0.09 },
        ],
      },
    ]);
    expect(dayBefore('2026-11-01', 1)).toBe('2026-10-31');
  });

  it('새 리뷰는 그날(KST) 것만 세고 평균 별점을 낸다', async () => {
    const r = (store: 'ios' | 'android', rating: number, iso: string) =>
      ({ store, rating, at: Date.parse(iso) }) as StoreReview;
    const api = {
      list: async (store: string) =>
        store === 'ios'
          ? [
              r('ios', 5, '2026-10-27T15:30:00Z'),
              r('ios', 2, '2026-10-28T10:00:00Z'),
              r('ios', 4, '2026-10-27T14:00:00Z'),
            ]
          : [],
    } as unknown as StoreApi;
    const env = {
      ASC_KEY_ID: 'k',
      ASC_ISSUER_ID: 'i',
      ASC_PRIVATE_KEY: 'p',
      ASC_APP_ID: '1',
      PLAY_PACKAGE: 'com.x',
      GA4_SA_EMAIL: 'e',
      GA4_SA_KEY: 'k',
    } as unknown as Env;
    expect(await reviewRows(env, '2026-10-28', api)).toEqual([
      { metric: 'store_reviews_new', dim: 'ios', value: 2 },
      { metric: 'store_review_stars', dim: 'ios', value: 3.5 },
      { metric: 'store_reviews_new', dim: 'android', value: 0 },
    ]);
  });

  it('App Store 판매 보고서는 첫 다운로드만, Play 보고서는 그날 줄만 센다', () => {
    const tsv = [
      'Provider\tProduct Type Identifier\tUnits',
      'APPLE\t1F\t12',
      'APPLE\t7F\t40',
      'APPLE\t3F\t2',
      'APPLE\t1\t3',
    ].join('\n');
    expect(firstDownloads(tsv)).toBe(15);
    const csv = 'Date,Package Name,Daily User Installs\n2026-10-27,com.x,30\n2026-10-28,com.x,41\n';
    const utf16 = new Uint8Array([
      0xff,
      0xfe,
      ...new Uint8Array(new Uint16Array([...csv].map((c) => c.charCodeAt(0))).buffer),
    ]);
    expect(dailyInstalls(decodeCsv(utf16.buffer), '2026-10-28')).toBe(41);
    expect(dailyInstalls(csv, '2026-10-29')).toBeNull();
  });

  it('AdMob 보고서를 플랫폼별 원화 수익으로 바꾼다', async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.includes('oauth2')
        ? Response.json({ access_token: 'a' })
        : Response.json([
            { header: {} },
            {
              row: {
                dimensionValues: { PLATFORM: { value: 'ANDROID' } },
                metricValues: {
                  ESTIMATED_EARNINGS: { microsValue: '12345000000' },
                  IMPRESSIONS: { integerValue: '900' },
                  AD_REQUESTS: { integerValue: '1000' },
                  MATCHED_REQUESTS: { integerValue: '950' },
                },
              },
            },
            { footer: {} },
          ]),
    );
    const env = {
      ADMOB_CLIENT_ID: 'c',
      ADMOB_CLIENT_SECRET: 's',
      ADMOB_REFRESH_TOKEN: 'r',
      ADMOB_PUBLISHER_ID: 'pub-1',
    } as unknown as Env;
    expect(await admobRows(env, '2026-10-28', fetcher as unknown as typeof fetch)).toEqual([
      { metric: 'ad_revenue_krw', dim: 'android', value: 12345 },
      { metric: 'ad_impressions', dim: 'android', value: 900 },
      { metric: 'ad_requests', dim: 'android', value: 1000 },
      { metric: 'ad_matched', dim: 'android', value: 950 },
    ]);
    expect(fetcher.mock.calls[1]![0]).toBe(
      'https://admob.googleapis.com/v1/accounts/pub-1/mediationReport:generate',
    );
  });
});
