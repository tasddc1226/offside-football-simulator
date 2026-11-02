import { describe, it, expect, vi } from 'vitest';
import {
  accountDayStartUtc,
  accountLastWeek,
  accountYesterday,
  metaClient,
  metaAds,
} from './slack-meta-ads.mjs';
const env = {
  META_AD_ACCOUNT_ID: '123',
  META_GRAPH_VERSION: 'v25.0',
  META_ADS_ACCESS_TOKEN: 'private-token',
  SLACK_DAILY_WEBHOOK: 'https://discord.com/api/webhooks/1/daily',
  SLACK_ALERTS_WEBHOOK: 'https://discord.com/api/webhooks/1/alerts',
};
const now = Date.parse('2026-10-12T00:05:00Z');
function fixture() {
  const state = new Map();
  const sent = [];
  let ads = [];
  let fail = false;
  const fetcher = vi.fn(async (url, opts) => {
    if (url.includes('discord.com/api/webhooks')) {
      if (fail) return new Response('failed', { status: 500 });
      sent.push(JSON.parse(opts.body));
      return new Response('ok');
    }
    const u = new URL(url);
    expect(u.searchParams.has('access_token')).toBe(false);
    expect(opts.headers.Authorization).toBe('Bearer private-token');
    if (u.pathname.endsWith('/ads')) return Response.json({ data: ads });
    if (u.pathname.endsWith('/insights') && u.searchParams.get('level') === 'ad') {
      const { since, until } = JSON.parse(u.searchParams.get('time_range'));
      const cur = since === '2026-10-26';
      return Response.json({
        data: [
          {
            ad_id: '7',
            ad_name: 'JP-Reels v2',
            adset_name: 'JP 18-44',
            spend: cur ? '60000' : '90000',
            actions: [{ action_type: 'landing_page_view', value: cur ? '300' : '150' }],
            date_start: since,
            date_stop: until,
          },
        ],
      });
    }
    if (u.pathname.endsWith('/insights'))
      return Response.json({
        data: [
          {
            campaign_id: '45',
            campaign_name: 'traffic <!channel>',
            spend: '1500',
            impressions: '1000',
            clicks: '25',
            actions: [{ action_type: 'landing_page_view', value: '10' }],
            date_start: '2026-10-11',
            date_stop: '2026-10-11',
          },
        ],
      });
    return Response.json({
      id: 'act_123',
      name: 'OFFSIDE',
      currency: 'KRW',
      timezone_name: 'Asia/Seoul',
      account_status: 1,
    });
  });
  const queries = [];
  const query = async (sql, params) => {
    queries.push(params);
    return params[0] === '2026-10-25T15:00:00.000Z'
      ? [
          {
            campaign: '?utm_source=meta&utm_medium=paid&utm_content=jp_reels',
            n: 400,
            started: 200,
            store: 20,
          },
          { campaign: '?utm_source=amachuggu&utm_content=bs_a', n: 9, started: 9, store: 9 },
        ]
      : [{ campaign: '?utm_source=facebook&utm_content=jp_b', n: 100, started: 50, store: 5 }];
  };
  return {
    queries,
    db: { get: async (k) => state.get(k), set: async (k, v) => state.set(k, v), query },
    state,
    sent,
    fetcher,
    setAds: (v) => (ads = v),
    setFail: (v) => (fail = v),
  };
}
describe('Meta read-only reporting', () => {
  it('uses previous complete account day across timezone/year boundaries', () => {
    expect(accountYesterday('Asia/Seoul', now)).toBe('2026-10-11');
    expect(accountYesterday('America/Los_Angeles', now)).toBe('2026-10-10');
    expect(accountYesterday('UTC', Date.parse('2027-01-01T00:00:00Z'))).toBe('2026-12-31');
  });
  it('picks the last complete Monday-Sunday week in the account timezone', () => {
    // 월요일 09:15 KST → 지난주 10-26(월)~11-01(일)
    expect(accountLastWeek('Asia/Seoul', Date.parse('2026-11-02T00:15:00Z'))).toEqual({
      since: '2026-10-26',
      until: '2026-11-01',
      prevSince: '2026-10-19',
      prevUntil: '2026-10-25',
    });
    // 주 중간에 손으로 돌려도 지난 완결 주
    expect(accountLastWeek('Asia/Seoul', Date.parse('2026-11-05T03:00:00Z')).since).toBe(
      '2026-10-26',
    );
    expect(accountDayStartUtc('Asia/Seoul', '2026-10-26')).toBe('2026-10-25T15:00:00.000Z');
    expect(accountDayStartUtc('UTC', '2026-10-26')).toBe('2026-10-26T00:00:00.000Z');
  });
  it('weekly compares Meta spend with server visits and sends once per week', async () => {
    const x = fixture();
    const monday = Date.parse('2026-11-02T00:15:00Z');
    await metaAds(x.db, env, 'weekly', monday, x.fetcher);
    const text = x.sent[0].content;
    expect(text).toContain('2026-10-26~2026-11-01');
    expect(text).toContain('지출 60,000 KRW (-33%)');
    expect(text).toContain('조회당 200 KRW (전주 600 KRW)');
    // 메타 유입만 센다(아마축구 제외).
    expect(text).toContain(
      '서버 기준 방문 400 · 커리어 시작 200 · 스토어 클릭 20 (전주 100 · 50 · 5)',
    );
    expect(text).toContain('스토어 클릭당 3,000 KRW');
    expect(text).toContain('jp_reels: 방문 400');
    expect(x.queries[0]).toEqual(['2026-10-25T15:00:00.000Z', '2026-11-01T15:00:00.000Z']);
    await metaAds(x.db, env, 'weekly', monday + 3600_000, x.fetcher);
    expect(x.sent).toHaveLength(1);
  });
  it('requires explicit credentials and version', () => {
    expect(() => metaClient({ ...env, META_ADS_ACCESS_TOKEN: '' })).toThrow();
    expect(() => metaClient({ ...env, META_GRAPH_VERSION: 'bad' })).toThrow();
  });
  it('summarizes LPV without calling it purchase and skips repeat queries', async () => {
    const x = fixture();
    await metaAds(x.db, env, 'daily', now, x.fetcher);
    expect(x.sent[0].content).toContain('조회당 비용 150 KRW');
    expect(x.sent[0].content).toContain('가입·앱 설치·구매가 아닙니다');
    // 광고 이름에 든 멘션 문구는 글자로만 남고 알림은 가지 않는다(allowed_mentions).
    expect(x.sent[0].allowed_mentions).toEqual({ parse: [] });
    await metaAds(x.db, env, 'daily', now, x.fetcher);
    expect(x.sent).toHaveLength(1);
    expect(x.fetcher.mock.calls.filter(([u]) => u.includes('/insights'))).toHaveLength(1);
    expect(x.fetcher.mock.calls.every(([, o]) => !o.method || o.method === 'POST')).toBe(true);
  });
  it('baselines healthy ads, alerts rejection and recovery once', async () => {
    const x = fixture();
    x.setAds([{ id: '1', name: 'ad', effective_status: 'ACTIVE' }]);
    await metaAds(x.db, env, 'monitor', now, x.fetcher);
    expect(x.sent).toHaveLength(0);
    x.setAds([{ id: '1', name: 'ad', effective_status: 'DISAPPROVED' }]);
    await metaAds(x.db, env, 'monitor', now, x.fetcher);
    await metaAds(x.db, env, 'monitor', now, x.fetcher);
    expect(x.sent).toHaveLength(1);
    expect(x.sent[0].content).toContain('심사 거절');
    x.setAds([{ id: '1', name: 'ad', effective_status: 'ACTIVE' }]);
    await metaAds(x.db, env, 'monitor', now, x.fetcher);
    expect(x.sent).toHaveLength(2);
  });
  it('does not commit a failed alert and retries it', async () => {
    const x = fixture();
    x.setAds([{ id: '1', name: 'ad', effective_status: 'DISAPPROVED' }]);
    x.setFail(true);
    await expect(metaAds(x.db, env, 'monitor', now, x.fetcher)).rejects.toThrow();
    expect(x.state.size).toBe(0);
    x.setFail(false);
    await metaAds(x.db, env, 'monitor', now, x.fetcher);
    expect(x.sent).toHaveLength(1);
  });
  it('never follows server-supplied next URL or treats incomplete pages as complete', async () => {
    const f = vi.fn(async () =>
      Response.json({
        data: [],
        paging: { next: 'https://evil.test/?access_token=secret', cursors: { after: 'next' } },
      }),
    );
    await expect(metaClient(env, f).list('/ads', {})).rejects.toThrow();
    expect(
      f.mock.calls.every(([u]) => u.startsWith('https://graph.facebook.com/v25.0/act_123/ads')),
    ).toBe(true);
  });
  it('fails on API errors without reporting zero spend', async () => {
    const x = fixture();
    await expect(
      metaAds(x.db, env, 'daily', now, async () =>
        Response.json({ error: { message: 'private token details' } }),
      ),
    ).rejects.toThrow('Meta read response failed');
    expect(x.sent).toHaveLength(0);
  });
});
