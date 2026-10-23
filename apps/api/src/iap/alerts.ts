import { IAP_PRODUCTS, type IapProductId } from '@offside/contracts';
import { billing as ko } from '../i18n/ko/billing.js';
import { billing as en } from '../i18n/en/billing.js';
import type { Bindings } from '../env.js';

export type BillingAlert = {
  store: 'apple' | 'google' | 'xsolla';
  transactionId: string;
  kind: 'purchase' | 'renewal' | 'refund' | 'test';
  productId: string;
  test: boolean;
};
const enabled = (env: Bindings) => env.BILLING_ALERTS_ENABLED === '1';

/** Tokens never leave the purchase verifier. Only a one-way transaction fingerprint is stored. */
export async function billingAlertId(e: BillingAlert): Promise<string> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${e.store}:${e.test}:${e.transactionId}:${e.kind}`),
  );
  return [...new Uint8Array(hash)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export async function recordBillingAlert(env: Bindings, event: BillingAlert, now: string) {
  if (!enabled(env)) return;
  const id = await billingAlertId(event);
  await env.DB.prepare(
    `INSERT INTO billing_alerts (id, store, kind, product_id, test, created_at)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
  )
    .bind(id, event.store, event.kind, event.productId.slice(0, 200), event.test ? 1 : 0, now)
    .run();
  // D1 is the durable outbox; the five-minute recovery job handles a failed enqueue.
  if (env.BILLING_QUEUE)
    await env.BILLING_QUEUE.send({ version: 1, id }).catch(() => {
      console.error(JSON.stringify({ job: 'billing-enqueue', id }));
    });
}

/** Claims commit the outbox atomically with the grant; cron requeues pending rows. */
export async function recoverBillingAlerts(env: Bindings, nowMs: number) {
  if (!enabled(env) || !env.BILLING_QUEUE) return;
  const pending = await env.DB.prepare(
    `SELECT id FROM billing_alerts WHERE sent_at IS NULL
    AND lease_until <= ? ORDER BY created_at LIMIT 100`,
  )
    .bind(nowMs)
    .all<{ id: string }>();
  if (pending.results.length)
    await env.BILLING_QUEUE.sendBatch(
      pending.results.map(({ id }) => ({ body: { version: 1 as const, id } })),
    );
}

type AlertRow = {
  store: string;
  kind: string;
  product_id: string;
  test: number;
  created_at: string;
};
export function billingSlackMessage(row: AlertRow, id: string, locale: 'ko' | 'en' = 'ko') {
  const L = locale === 'ko' ? ko : en;
  const web = row.store === 'xsolla';
  const kind =
    (web ? L.webKinds[row.kind as keyof typeof L.webKinds] : undefined) ??
    L.kinds[row.kind as keyof typeof L.kinds] ??
    row.kind;
  const environment = row.test ? L.sandbox : L.live;
  const store =
    row.store === 'apple' ? 'App Store' : row.store === 'xsolla' ? 'Xsolla' : 'Google Play';
  const product = Object.hasOwn(IAP_PRODUCTS, row.product_id)
    ? IAP_PRODUCTS[row.product_id as IapProductId]
    : null;
  const productName =
    row.kind === 'test'
      ? L.testProduct
      : product
        ? L.quantity(L.items[product.item], product.qty)
        : row.product_id === 'com.offsidelab.app.remove_ads'
          ? L.removeAds
          : row.product_id;
  const date = new Date(row.created_at);
  const time = Number.isNaN(date.getTime())
    ? row.created_at
    : new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).format(date);
  const heading = `OFFSIDE · ${kind} · ${environment}`;
  const channel = web ? L.channels.web : L.channels.app;
  const detail = `${L.product}: ${productName}\n${L.channel}: ${channel}\n${L.store}: ${store}\n${L.received}: ${time} (${L.timezone})`;
  const notice = row.test ? L.testNotice : '';
  const reference = `${L.productId}: ${row.product_id} · ${L.reference}: ${id.slice(0, 12)}`;
  const plain = (text: string) => ({ type: 'plain_text', text, emoji: true });
  // Keep dynamic data in plain_text to prevent mentions and injected Slack markup.
  return {
    text: [heading, detail, notice, reference].filter(Boolean).join('\n'),
    blocks: [
      { type: 'header', text: plain(heading) },
      { type: 'section', text: plain(detail) },
      ...(notice ? [{ type: 'context', elements: [plain(notice)] }] : []),
      { type: 'context', elements: [plain(reference)] },
    ],
  };
}

export async function consumeBillingAlerts(batch: MessageBatch<unknown>, env: Bindings) {
  for (const msg of batch.messages) {
    const body = msg.body as { version?: unknown; id?: unknown } | null;
    if (body?.version !== 1 || typeof body.id !== 'string' || !/^[a-f0-9]{64}$/.test(body.id)) {
      msg.ack();
      continue;
    }
    if (!enabled(env) || !env.BILLING_SLACK_WEBHOOK) {
      msg.retry({ delaySeconds: 300 });
      continue;
    }
    const now = Date.now();
    const row = await env.DB.prepare(
      `UPDATE billing_alerts SET lease_until = ?
      WHERE id = ? AND sent_at IS NULL AND lease_until <= ?
      RETURNING store, kind, product_id, test, created_at`,
    )
      .bind(now + 120_000, body.id, now)
      .first<AlertRow>();
    if (!row) {
      msg.ack();
      continue;
    }
    try {
      const url = new URL(env.BILLING_SLACK_WEBHOOK);
      if (url.origin !== 'https://hooks.slack.com' || !url.pathname.startsWith('/services/'))
        throw new Error('invalid webhook');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(billingSlackMessage(row, body.id)),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok || (await response.text()).trim() !== 'ok')
        throw new Error('delivery rejected');
      await env.DB.prepare('UPDATE billing_alerts SET sent_at = ?, lease_until = 0 WHERE id = ?')
        .bind(new Date().toISOString(), body.id)
        .run();
      msg.ack();
    } catch {
      await env.DB.prepare('UPDATE billing_alerts SET lease_until = 0 WHERE id = ?')
        .bind(body.id)
        .run();
      console.error(JSON.stringify({ job: 'billing-slack', id: body.id, result: 'retry' }));
      msg.retry({ delaySeconds: 60 });
    }
  }
}
