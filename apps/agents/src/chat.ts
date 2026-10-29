// T-11-576 채팅 플랫폼 고르기. 에이전트 코드는 슬랙 Web API 모양(chat.postMessage 등)으로 부르고,
// CHAT_PLATFORM=discord면 디스코드 브리지(bridge.ts)가 옮겨 보낸다.
import { bridgeOf } from './bridge.ts';
import { botToken, ROLE_NAMES, type Env, type Role } from './env.ts';
import { slackClient, slackThreadLink, type SlackCall } from './slack.ts';

export const onDiscord = (env: Pick<Env, 'CHAT_PLATFORM'>) => env.CHAT_PLATFORM === 'discord';

/** 역할 이름으로 글을 쓰는 클라이언트. */
export const chatClient = (env: Env, role: Role): SlackCall =>
  onDiscord(env)
    ? async (method, body) => {
        const r = await bridgeOf(env).call(role, method, body);
        return { ok: r.ok, ...(r.error ? { error: r.error } : {}), ...(r.ts ? { ts: r.ts } : {}) };
      }
    : slackClient(botToken(env, role), fetch, ROLE_NAMES[role]);

/** 스레드(원글) 링크. 디스코드는 원글 링크를 열면 그 스레드가 함께 보인다. */
export const threadLink = (
  env: Pick<Env, 'CHAT_PLATFORM' | 'DISCORD_GUILD_ID'>,
  channel: string,
  ts: string,
) =>
  onDiscord(env)
    ? `https://discord.com/channels/${env.DISCORD_GUILD_ID}/${channel}/${ts}`
    : slackThreadLink(channel, ts);
