import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import {
  billingAlertId,
  billingSlackMessage,
  consumeBillingAlerts,
  recordBillingAlert,
  recoverBillingAlerts,
} from './alerts.js';
import { handleGoogleRtdn } from './rtdn.js';
import { verifyPubsubToken } from './pubsub.js';

describe('verified billing Slack outbox', () => {
  let ctx: TestD1;
  const event = {
    store: 'google' as const,
    transactionId: 'private-purchase-token',
    kind: 'purchase' as const,
    productId: 'com.offsidelab.app.reroll_5',
    test: true,
  };
  beforeEach(async () => {
    ctx = await createTestD1();
    ctx.env.BILLING_ALERTS_ENABLED = '1';
    ctx.env.BILLING_SLACK_WEBHOOK = 'https://discord.com/api/webhooks/1/test';
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await ctx.dispose();
  });
  function batch(id: string) {
    const message = { body: { version: 1, id }, ack: vi.fn(), retry: vi.fn() };
    return { message, value: { messages: [message] } as unknown as MessageBatch<unknown> };
  }
  it('deduplicates transactions, separates Sandbox and sends no raw purchase token', async () => {
    await Promise.all([
      recordBillingAlert(ctx.env, event, '2026-10-12T00:00:00Z'),
      recordBillingAlert(ctx.env, event, '2026-10-12T00:00:00Z'),
    ]);
    expect((await ctx.env.DB.prepare('SELECT * FROM billing_alerts').all()).results).toHaveLength(
      1,
    );
    expect(await billingAlertId(event)).not.toBe(await billingAlertId({ ...event, test: false }));
    const fetcher = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', fetcher);
    const b = batch(await billingAlertId(event));
    await consumeBillingAlerts(b.value, ctx.env);
    await consumeBillingAlerts(b.value, ctx.env);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(b.message.ack).toHaveBeenCalledTimes(2);
    const request = JSON.stringify(fetcher.mock.calls);
    expect(request).toContain('테스트 · Sandbox');
    expect(request).not.toContain(event.transactionId);
  });
  it('recovers failed enqueue from D1, retries Slack failures and does not mark them sent', async () => {
    const send = vi.fn().mockRejectedValue(new Error('down'));
    const sendBatch = vi.fn().mockResolvedValue(undefined);
    ctx.env.BILLING_QUEUE = { send, sendBatch } as unknown as NonNullable<
      typeof ctx.env.BILLING_QUEUE
    >;
    await recordBillingAlert(ctx.env, event, new Date().toISOString());
    await recoverBillingAlerts(ctx.env, Date.now());
    expect(sendBatch).toHaveBeenCalledTimes(1);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('rate_limited', { status: 429 })),
    );
    const b = batch(await billingAlertId(event));
    await consumeBillingAlerts(b.value, ctx.env);
    expect(b.message.retry).toHaveBeenCalled();
    expect(
      await ctx.env.DB.prepare('SELECT sent_at, lease_until FROM billing_alerts').first(),
    ).toEqual({ sent_at: null, lease_until: 0 });
  });
  it('rejects unauthenticated PubSub and accepts only the configured audience/identity', async () => {
    const fetcher = vi.fn();
    expect(await verifyPubsubToken(ctx.env, 'Bearer fake', fetcher)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    ctx.env.GOOGLE_RTDN_AUDIENCE = 'https://api.example.com/notify';
    ctx.env.GOOGLE_RTDN_SERVICE_ACCOUNT = 'push@example.com';
    const pair = (await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    const encode = (v: unknown) =>
      btoa(JSON.stringify(v)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const h = encode({ alg: 'RS256', kid: 'test' });
    const claims = {
      iss: 'https://accounts.google.com',
      aud: ctx.env.GOOGLE_RTDN_AUDIENCE,
      email: ctx.env.GOOGLE_RTDN_SERVICE_ACCOUNT,
      email_verified: true,
      iat: 1000,
      exp: 4600,
    };
    async function token(c: object) {
      const p = encode(c);
      const sig = new Uint8Array(
        await crypto.subtle.sign(
          'RSASSA-PKCS1-v1_5',
          pair.privateKey,
          new TextEncoder().encode(`${h}.${p}`),
        ),
      );
      return `Bearer ${h}.${p}.${btoa(String.fromCharCode(...sig))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')}`;
    }
    fetcher.mockImplementation(async () =>
      Response.json({
        keys: [{ ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'test' }],
      }),
    );
    expect(await verifyPubsubToken(ctx.env, await token(claims), fetcher, 1200)).toBe(true);
    expect(
      await verifyPubsubToken(
        ctx.env,
        await token({ ...claims, email: 'attacker@example.com' }),
        fetcher,
        1200,
      ),
    ).toBe(false);
    expect(await verifyPubsubToken(ctx.env, await token(claims), fetcher, 5000)).toBe(false);
  });
  it('store TEST is explicitly marked and a different package cannot create an alert', async () => {
    const note = (packageName: string) => ({
      message: {
        messageId: 'test-1',
        data: btoa(JSON.stringify({ packageName, testNotification: {} })),
      },
    });
    expect(await handleGoogleRtdn(ctx.env, note('bad.app'), new Date().toISOString())).toBe(400);
    expect(
      await handleGoogleRtdn(ctx.env, note('com.offsidelab.app'), new Date().toISOString()),
    ).toBe(204);
    expect(await ctx.env.DB.prepare('SELECT kind, test FROM billing_alerts').first()).toEqual({
      kind: 'test',
      test: 1,
    });
  });
});

describe('billing Slack presentation', () => {
  it('shows readable products, Korean time and distinct event/environment labels', () => {
    for (const [kind, label] of Object.entries({
      purchase: '새 구매',
      renewal: '구독 갱신',
      refund: '환불',
      test: '연결 테스트',
    })) {
      const msg = billingSlackMessage(
        {
          store: 'apple',
          kind,
          product_id: 'com.offsidelab.app.scout_5',
          test: 0,
          created_at: '2026-10-12T08:06:41.332Z',
        },
        'abcdef1234567890',
      );
      expect(msg.text).toContain(label);
      expect(msg.text).toContain('실결제');
      expect(msg.text).toContain('2026-10-12 17:06:41 (한국 시간)');
      expect(msg.text).not.toContain('실제 매출');
      if (kind !== 'test') expect(msg.text).toContain('프리미엄 스카우트권 5장');
    }
  });
  it('T-11-471 labels web (Xsolla) payments apart from in-app purchases', () => {
    const row = {
      store: 'xsolla',
      kind: 'purchase',
      product_id: 'com.offsidelab.app.reroll_15',
      test: 0,
      created_at: '2026-10-23T14:00:00Z',
    };
    const web = billingSlackMessage(row, 'abcdef1234567890');
    expect(web.text).toContain('OFFSIDE · 🌐 웹 결제 · 실결제');
    expect(web.text).toContain('결제 경로: 웹 결제 (offside-lab.com)');
    expect(web.text).toContain('스토어: Xsolla');
    expect(web.text).toContain('리롤권 15장');
    expect(billingSlackMessage({ ...row, kind: 'refund' }, 'a').text).toContain('↩️ 웹 결제 환불');
    expect(billingSlackMessage({ ...row, store: 'apple' }, 'a').text).toContain(
      '결제 경로: 앱 인앱 결제',
    );
    expect(billingSlackMessage(row, 'a', 'en').text).toContain('🌐 Web purchase');
  });
  it('keeps unknown products literal and makes Sandbox explicit in fallback and blocks', () => {
    const row = {
      store: 'google',
      kind: 'purchase',
      product_id: '<!channel> *unknown*',
      test: 1,
      created_at: '2026-10-12T23:59:00Z',
    };
    const msg = billingSlackMessage(row, '1234567890abcdef');
    expect(msg.text).toContain('2026-10-13 08:59:00');
    expect(msg.text).toContain('실제 매출에 포함하지 마세요');
    expect(msg.text).toContain(row.product_id);
    expect(JSON.stringify(msg.blocks)).not.toContain('mrkdwn');
    expect(billingSlackMessage(row, '123', 'en').text).toContain('Do not count this as revenue');
  });
});
