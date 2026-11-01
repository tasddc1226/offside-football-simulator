import { describe, it, expect, vi } from 'vitest';
import { accountYesterday, metaClient, metaAds } from './slack-meta-ads.mjs';
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
  return {
    db: { get: async (k) => state.get(k), set: async (k, v) => state.set(k, v) },
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
