import { describe, expect, it, vi } from 'vitest';
import type { Env } from './env.ts';
import { marketingTools } from './marketing.ts';

vi.mock('./google.ts', () => ({ serviceAccountToken: async () => 'g' }));
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('마케팅 읽기 도구 (T-11-332)', () => {
  it('비밀값이 있는 도구만, 마케팅이 쓰는 일에만 준다', () => {
    expect(marketingTools({} as Env, 'mention')).toEqual([]);
    const env = {
      GA4_SA_EMAIL: 'x',
      GA4_SA_KEY: 'k',
      META_ADS_ACCESS_TOKEN: 't',
      META_AD_ACCOUNT_ID: '1',
    } as unknown as Env;
    expect(marketingTools(env, 'mention').map((t) => t.name)).toEqual([
      'search_console',
      'meta_ads',
    ]);
    expect(marketingTools(env, 'triage')).toEqual([]);
  });

  it('Search Console은 집계가 끝난 날(이틀 전)까지 고른 기준으로 묻고 표로 돌려준다', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain(encodeURIComponent('sc-domain:offside-lab.com'));
      expect(JSON.parse(init!.body as string)).toEqual({
        startDate: '2026-10-09',
        endDate: '2026-10-15',
        dimensions: ['country'],
        rowLimit: 3,
      });
      return ok({
        rows: [{ keys: ['kor'], clicks: 12, impressions: 300, ctr: 0.04, position: 7.25 }],
      });
    });
    const env = { GA4_SA_EMAIL: 'x', GA4_SA_KEY: 'k' } as unknown as Env;
    const tool = marketingTools(env, 'mention', fetcher as unknown as typeof fetch, () =>
      Date.parse('2026-10-17T03:00:00Z'),
    )[0]!;
    expect(await tool.run({ days: 7, dimension: 'country', limit: 3 })).toBe(
      'country | 클릭 | 노출 | CTR | 평균 순위 (2026-10-09~2026-10-15)\nkor | 12 | 300 | 4.0% | 7.3',
    );
  });

  it('Meta 광고는 캠페인별 랜딩 페이지 조회를 더하고, 실패는 실패로 적는다', async () => {
    const env = { META_ADS_ACCESS_TOKEN: 't', META_AD_ACCOUNT_ID: '9' } as unknown as Env;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        ok({
          data: [
            {
              campaign_name: 'JP',
              spend: '3.1',
              impressions: '900',
              clicks: '20',
              actions: [
                { action_type: 'landing_page_view', value: '8' },
                { action_type: 'link_click', value: '20' },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'expired' } }), { status: 400 }),
      );
    const tool = marketingTools(env, 'report', fetcher as unknown as typeof fetch)[0]!;
    expect(await tool.run({})).toBe(
      '캠페인 | 지출 | 노출 | 클릭 | 랜딩 페이지 조회\nJP | 3.1 | 900 | 20 | 8',
    );
    expect(String(fetcher.mock.calls[0]![0])).toContain('act_9/insights');
    expect(await tool.run({ days: 30 })).toBe('Meta 광고 읽기 실패 400 expired');
  });
});
