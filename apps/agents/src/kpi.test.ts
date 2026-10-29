import { describe, expect, it, vi } from 'vitest';
import type { Env } from './env.ts';
import { dimName, kstDayAgo, runKpiIngest } from './kpi.ts';

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
      ['2026-10-27', 'error'],
    ]);
    expect(posts).toHaveLength(1);
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
