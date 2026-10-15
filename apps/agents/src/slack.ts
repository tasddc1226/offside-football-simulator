// 슬랙 요청 서명 확인과 봇 메시지 보내기. https://api.slack.com/authentication/verifying-requests-from-slack
const enc = new TextEncoder();
const FIVE_MIN = 5 * 60;

export async function verifySlack(
  secret: string,
  timestamp: string | null,
  signature: string | null,
  body: string,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!secret || !timestamp || !signature?.startsWith('v0=')) return false;
  const ts = Number(timestamp);
  // 오래된 요청을 다시 보내는 공격을 막는다.
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > FIVE_MIN) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, enc.encode(`v0:${timestamp}:${body}`)),
  );
  const expected = `v0=${[...mac].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++)
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

export type SlackCall = (
  method: string,
  body: Record<string, unknown>,
) => Promise<{ ok: boolean; error?: string; ts?: string }>;

export const slackClient =
  (token: string, fetcher: typeof fetch = fetch): SlackCall =>
  async (method, body) => {
    const r = await fetcher(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(body),
    });
    return (await r.json()) as { ok: boolean; error?: string; ts?: string };
  };

/** markdown 블록은 12,000자까지 받는다. */
const MD_LIMIT = 11_500;

/** 에이전트 답을 스레드에 단다(threadTs가 없으면 새 글). 본문은 markdown 블록, 아래에 비용 줄. */
export function threadReply(
  channel: string,
  threadTs: string | undefined,
  text: string,
  footer?: string,
) {
  const body = text.length > MD_LIMIT ? `${text.slice(0, MD_LIMIT)}\n\n…(길어서 잘랐어요)` : text;
  return {
    channel,
    thread_ts: threadTs,
    text: body.slice(0, 3000),
    unfurl_links: false,
    unfurl_media: false,
    blocks: [
      { type: 'markdown', text: body },
      ...(footer ? [{ type: 'context', elements: [{ type: 'mrkdwn', text: footer }] }] : []),
    ],
  };
}
