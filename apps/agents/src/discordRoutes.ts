// T-11-576 디스코드 HTTP 입구: 버튼(Interactions Endpoint). 서버 채널 준비는 scripts/discord-setup.mjs.
import { bridgeOf } from './bridge.ts';
import { START_ACTIONS, startInteraction } from './captain.ts';
import { DEPLOY_ACTIONS } from './deploy.ts';
import { devInteraction } from './dev.ts';
import { verifyDiscord } from './discord.ts';
import type { Env } from './env.ts';
import { ledger } from './ledger.ts';
import { REVIEW_ACTIONS, reviewInteraction } from './reviews.ts';
import { supportInteraction } from './support.ts';

type Handler = (env: Env, p: never) => Promise<unknown>;

/** 버튼 action_id → 처리 함수. 슬랙은 앱(역할)마다 주소가 나뉘었지만 디스코드는 봇 하나라 action_id로 고른다. */
export function handlerFor(action: string): Handler | null {
  if (START_ACTIONS.includes(action)) return startInteraction as Handler;
  if (REVIEW_ACTIONS.includes(action)) return reviewInteraction as Handler;
  if (['mail_send', 'mail_discard'].includes(action)) return supportInteraction as Handler;
  if (['dev_merge', 'dev_reject', ...DEPLOY_ACTIONS].includes(action))
    return devInteraction as Handler;
  return null;
}

type Interaction = {
  type: number;
  data?: { custom_id?: string };
  member?: { user?: { id: string } };
  user?: { id: string };
  channel_id?: string;
  message?: { id: string };
};

/**
 * 버튼 누름. 서명을 확인하고 3초 안에 '받았다'(type 6, 글은 그대로)를 돌려준 뒤 일은 뒤에서 한다. 처리 함수는 슬랙
 * block_actions 모양을 받으므로 브리지에 둔 버튼 값 · 원래 블록으로 그 모양을 만들어 넘긴다.
 */
export async function discordInteraction(
  req: Request,
  env: Env,
  ctx: ExecutionContext,
  keepPending: ReadonlySet<string>,
): Promise<Response> {
  const body = await req.text();
  const ok = await verifyDiscord(
    env.DISCORD_PUBLIC_KEY,
    req.headers.get('x-signature-ed25519'),
    req.headers.get('x-signature-timestamp'),
    body,
  );
  if (!ok) return new Response('bad signature', { status: 401 });
  const i = JSON.parse(body) as Interaction;
  if (i.type === 1) return Response.json({ type: 1 });
  if (i.type !== 3 || !i.message || !i.data?.custom_id) return Response.json({ type: 6 });
  const [action = '', key = ''] = i.data.custom_id.split('|');
  const user = i.member?.user?.id ?? i.user?.id ?? '';
  // 승인 버튼은 운영자만 누를 수 있다(ADR-015 결정 5). 다른 사람에게는 그 사람만 보는 답을 준다.
  if (user !== env.OPERATOR_USER_ID)
    return Response.json({ type: 4, data: { content: '운영자만 누를 수 있어요.', flags: 64 } });
  const handle = handlerFor(action);
  if (!handle) return Response.json({ type: 6 });
  const messageId = i.message.id;
  ctx.waitUntil(
    (async () => {
      const b = await bridgeOf(env).pressed(key, messageId, i.channel_id ?? '');
      if (b.value === null) {
        console.error('discord button value missing', action);
        return;
      }
      const r = await handle(env, {
        type: 'block_actions',
        user: { id: user },
        channel: { id: b.channel },
        message: { ts: messageId, blocks: JSON.parse(b.blocks) as unknown[] },
        actions: [{ action_id: action, value: b.value }],
      } as never);
      console.log('discord interaction', action, r);
      if (!keepPending.has(String(r))) await ledger(env).pendingDone(messageId);
    })().catch((e: unknown) => console.error('discord interaction failed', String(e))),
  );
  return Response.json({ type: 6 });
}
