// T-11-576 디스코드 REST와 상호작용(버튼) 서명 확인. https://discord.com/developers/docs/interactions/overview
const enc = new TextEncoder();
const FIVE_MIN = 5 * 60;

const hex = (s: string) => {
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
};

/** Ed25519 서명(X-Signature-Ed25519 · X-Signature-Timestamp)을 앱 공개 키로 확인한다. */
export async function verifyDiscord(
  publicKey: string | undefined,
  signature: string | null,
  timestamp: string | null,
  body: string,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!publicKey || !signature || !timestamp || !/^[0-9a-f]{128}$/i.test(signature)) return false;
  const ts = Number(timestamp);
  // 오래된 요청을 다시 보내는 공격을 막는다.
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > FIVE_MIN) return false;
  try {
    const key = await crypto.subtle.importKey('raw', hex(publicKey), { name: 'Ed25519' }, false, [
      'verify',
    ]);
    return await crypto.subtle.verify('Ed25519', key, hex(signature), enc.encode(timestamp + body));
  } catch {
    return false;
  }
}

export class DiscordError extends Error {
  constructor(
    readonly status: number,
    readonly code: number | undefined,
    message: string,
  ) {
    super(`discord ${status}${code ? ` (${code})` : ''}: ${message}`);
  }
}

export type DiscordApi = <T = Record<string, unknown>>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
) => Promise<T>;

/** 봇 토큰으로 REST를 부른다. 429면 retry_after만큼(5초까지) 기다려 두 번까지 다시 한다. */
export const discordApi =
  (token: string, fetcher: typeof fetch = fetch): DiscordApi =>
  async (method, path, body) => {
    for (let attempt = 0; ; attempt++) {
      const r = await fetcher(`https://discord.com/api/v10${path}`, {
        method,
        headers: {
          Authorization: `Bot ${token}`,
          'User-Agent': 'DiscordBot (https://offside-lab.com, 1)',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (r.status === 429 && attempt < 2) {
        const wait = ((await r.json().catch(() => ({}))) as { retry_after?: number }).retry_after;
        await new Promise((ok) => setTimeout(ok, Math.min(5_000, (wait ?? 1) * 1000)));
        continue;
      }
      if (r.status === 204) return undefined as never;
      const data = (await r.json().catch(() => ({}))) as { code?: number; message?: string };
      if (!r.ok) throw new DiscordError(r.status, data.code, String(data.message ?? r.statusText));
      return data as never;
    }
  };

/** 게이트웨이 인텐트: GUILDS · GUILD_MESSAGES · MESSAGE_CONTENT(개발자 포털에서 켜야 한다). */
export const INTENTS = (1 << 0) | (1 << 9) | (1 << 15);
/** 스레드 채널 종류(공지 · 공개 · 비공개 스레드). */
export const THREAD_TYPES = [10, 11, 12];
/** 메시지 플래그 SUPPRESS_EMBEDS(링크 미리보기 끔, 슬랙 unfurl_links: false). */
export const SUPPRESS_EMBEDS = 1 << 2;
