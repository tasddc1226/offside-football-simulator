import { createHash } from 'node:crypto';

export const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function slackMessage(title, lines, links = []) {
  const plain = (text) => ({ type: 'plain_text', text, emoji: true });
  return {
    text: [title, ...lines, ...links.map((x) => x.url)]
      .join('\n')
      .replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]),
    blocks: [
      { type: 'header', text: plain(title.slice(0, 150)) },
      { type: 'section', text: plain(lines.join('\n').slice(0, 2900)) },
      ...(links.length
        ? [
            {
              type: 'context',
              elements: links.map(({ label, url }) => ({
                type: 'mrkdwn',
                text: `<${url}|${label}>`,
              })),
            },
          ]
        : []),
    ],
  };
}
const DISCORD_HOOK = /^\/api\/webhooks\/\d+\/[\w-]+$/;
/** T-11-576 슬랙 메시지(slackMessage) → 디스코드 웹훅 본문. 제목 · 본문 줄 · 링크, 2,000자, 멘션 끔. */
export function discordMessage(message) {
  const blocks = message.blocks ?? [];
  const text = (b) => b.text?.text ?? '';
  const lines = blocks.length
    ? blocks.map((b) =>
        b.type === 'context'
          ? b.elements
              .map((e) => e.text.replace(/<(https?:[^|>]+)\|([^>]+)>/g, '[$2](<$1>)'))
              .join(' · ')
          : text(b),
      )
    : [message.text ?? ''];
  return { content: lines.join('\n').slice(0, 2000), allowed_mentions: { parse: [] }, flags: 4 };
}
/** 슬랙 수신 웹훅 또는 디스코드 웹훅(T-11-576)으로 보낸다. 다른 주소는 거절한다. */
export async function sendSlack(url, message, fetcher = fetch) {
  if (!url) throw new Error('Slack destination unavailable');
  const parsed = new URL(url);
  const discord = parsed.origin === 'https://discord.com' && DISCORD_HOOK.test(parsed.pathname);
  if (
    !discord &&
    (parsed.origin !== 'https://hooks.slack.com' || !parsed.pathname.startsWith('/services/'))
  )
    throw new Error('Invalid Slack destination');
  const r = await fetcher(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(discord ? discordMessage(message) : message),
    signal: AbortSignal.timeout(10_000),
  });
  if (discord ? !r.ok : !r.ok || (await r.text()).trim() !== 'ok')
    throw new Error(`Slack delivery failed (HTTP ${r.status})`);
}
export async function productionDb(env = process.env, fetcher = fetch) {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN)
    throw new Error('Cloudflare monitoring credentials unavailable');
  const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/d1/database`;
  const request = async (url, body) => {
    const r = await fetcher(url, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        'content-type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) throw new Error(`Cloudflare query failed (HTTP ${r.status})`);
    const v = await r.json();
    if (!v.success || !v.result) throw new Error('Cloudflare query unsuccessful');
    return v.result;
  };
  const db = (await request(`${base}?per_page=100`)).find((x) => x.name === 'offside-production');
  if (!db?.uuid) throw new Error('Production database unavailable');
  const query = async (sql, params = []) => {
    const rows = await request(`${base}/${encodeURIComponent(db.uuid)}/query`, { sql, params });
    if (rows.length !== 1 || rows[0]?.success !== true)
      throw new Error('Production SQL unsuccessful');
    return rows[0].results;
  };
  return {
    query,
    async get(key) {
      const row = (await query('SELECT value FROM app_meta WHERE key=?', [key]))[0];
      return row ? JSON.parse(row.value) : null;
    },
    async set(key, value) {
      if (!key.startsWith('slack:ops:')) throw new Error('Invalid operations state key');
      await query(
        'INSERT INTO app_meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        [key, JSON.stringify(value)],
      );
    },
  };
}
/** Serialized by workflow concurrency. Mark only after Slack accepts; ambiguous failures may duplicate. */
export async function deliverOnce(db, key, version, webhook, message, fetcher = fetch) {
  const old = await db.get(key);
  if (old?.version === version) return false;
  await sendSlack(webhook, message, fetcher);
  await db.set(key, { version, sentAt: new Date().toISOString() });
  return true;
}
