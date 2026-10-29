// T-11-576 채팅 클라이언트. 에이전트 코드는 슬랙 Web API 모양(chat.postMessage 등)으로 부르고 디스코드 브리지(bridge.ts)가 옮겨 보낸다.
import { bridgeOf } from './bridge.ts';
import type { Env, Role } from './env.ts';
import type { SlackCall } from './reply.ts';

/** 역할 이름으로 글을 쓰는 클라이언트. */
export const chatClient =
  (env: Env, role: Role): SlackCall =>
  async (method, body) => {
    const r = await bridgeOf(env).call(role, method, body);
    return { ok: r.ok, ...(r.error ? { error: r.error } : {}), ...(r.ts ? { ts: r.ts } : {}) };
  };

/** 스레드(원글) 링크. 원글 링크를 열면 그 스레드가 함께 보인다. */
export const threadLink = (env: Pick<Env, 'DISCORD_GUILD_ID'>, channel: string, ts: string) =>
  `https://discord.com/channels/${env.DISCORD_GUILD_ID}/${channel}/${ts}`;
