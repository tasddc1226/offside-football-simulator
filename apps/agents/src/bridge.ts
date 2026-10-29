// T-11-576 디스코드 브리지. 객체 하나가 (1) 게이트웨이 웹소켓으로 글을 받아 역할 일로 넘기고, (2) 슬랙 Web API 모양 호출
// (chat.postMessage 등)을 디스코드 REST · 웹훅으로 옮겨 보낸다. 봇은 하나이고, 역할 이름은 채널 웹훅의 username으로 나눈다.
import { DurableObject } from 'cloudflare:workers';
import { ROLE_NAMES, type Env, type Role } from './env.ts';
import {
  DiscordError,
  discordApi,
  INTENTS,
  SUPPRESS_EMBEDS,
  THREAD_TYPES,
  type DiscordApi,
} from './discord.ts';
import {
  buttonRows,
  EMOJI,
  slackToDiscord,
  splitContent,
  threadName,
  toSlackEvent,
  type DiscordMessage,
} from './discordFormat.ts';
import { discordTasks, dispatchTask } from './events.ts';

export const bridgeOf = (env: Env) => env.DISCORD.get(env.DISCORD.idFromName('discord'));

type Hook = { id: string; token: string };
/** 메시지가 실제로 있는 채널(스레드면 스레드 ID)과 상위 채널. wh: 우리 웹훅이 쓴 글(고칠 수 있다). */
type Where = { ch: string; parent: string; thread?: string; wh?: true; at: number };
type Session = { id: string; url: string; seq: number | null };
type Reply = { ok: boolean; error?: string; ts?: string | undefined };

/** 역할 글을 쓰는 채널 웹훅 이름. 알림용 웹훅(offside-notify)과 나눠 경보로 잘못 읽지 않게 한다. */
const PERSONA_HOOK = 'offside-agents';
/** 저장해 둔 메시지 위치 · 버튼 값 보관 기간. */
const KEEP_MS = 60 * 86_400_000;
const ALARM_MS = 60_000;
/** 토큰 · 인텐트 · 샤드 설정이 틀린 끊김. 다시 이어도 같아서 1분 알람에만 맡긴다. */
const FATAL_CLOSE = [4004, 4010, 4011, 4012, 4013, 4014];

export class DiscordBridge extends DurableObject<Env> {
  private ws: WebSocket | undefined;
  private beat: ReturnType<typeof setInterval> | undefined;
  private acked = true;
  private seq: number | null = null;

  private get api(): DiscordApi {
    if (!this.env.DISCORD_BOT_TOKEN) throw new Error('DISCORD_BOT_TOKEN missing');
    return discordApi(this.env.DISCORD_BOT_TOKEN);
  }

  /** 슬랙 Web API 메서드를 디스코드로 옮겨 부른다. 실패는 던지지 않고 슬랙처럼 ok: false로 돌려준다. */
  async call(role: Role, method: string, body: Record<string, unknown>): Promise<Reply> {
    try {
      if (method === 'chat.postMessage') return await this.post(role, body);
      if (method === 'chat.update') return await this.update(role, body);
      if (method === 'chat.postEphemeral')
        // 디스코드에는 버튼 응답 밖의 '나만 보기' 글이 없다. 그 사람을 멘션한 글로 대신한다.
        return await this.post(role, {
          channel: body.channel,
          text: `<@${String(body.user)}> ${String(body.text ?? '')}`,
        });
      if (method === 'reactions.add' || method === 'reactions.remove')
        return await this.react(method === 'reactions.add', body);
      return { ok: false, error: `unsupported ${method}` };
    } catch (e) {
      // 10015: 웹훅이 지워졌다. 기억한 웹훅을 비워 다음 글에서 새로 만든다.
      if (e instanceof DiscordError && e.code === 10015) {
        const hooks = await this.ctx.storage.list({ prefix: 'hook:' });
        await this.ctx.storage.delete([...hooks.keys()]);
      }
      console.error('discord call failed', method, String(e).slice(0, 300));
      return { ok: false, error: String(e).slice(0, 200) };
    }
  }

  private async post(role: Role, body: Record<string, unknown>): Promise<Reply> {
    const parent = String(body.channel);
    const thread = body.thread_ts ? await this.ensureThread(parent, String(body.thread_ts)) : '';
    const hook = await this.hook(parent);
    const { content, buttons } = slackToDiscord(body);
    const chunks = splitContent(content);
    let first: string | undefined;
    for (const [i, chunk] of chunks.entries()) {
      const last = i === chunks.length - 1;
      const components = last && buttons.length ? await this.rows(buttons) : undefined;
      const q = new URLSearchParams({ wait: 'true' });
      if (thread) q.set('thread_id', thread);
      if (components) q.set('with_components', 'true');
      const m = await this.api<{ id: string }>('POST', `/webhooks/${hook.id}/${hook.token}?${q}`, {
        content: chunk,
        username: ROLE_NAMES[role],
        allowed_mentions: { parse: ['users'] },
        flags: SUPPRESS_EMBEDS,
        ...(components ? { components } : {}),
      });
      first ??= m.id;
      await this.ctx.storage.put<Where>(`msg:${m.id}`, {
        ch: thread || parent,
        parent,
        ...(thread ? { thread } : {}),
        wh: true,
        at: Date.now(),
      });
      // 버튼을 누르면 슬랙처럼 원래 블록을 handler에 넘긴다(앞 블록을 남기고 버튼을 결과 줄로 바꾼다).
      if (components) await this.ctx.storage.put(`blocks:${m.id}`, body.blocks);
    }
    return { ok: true, ts: first };
  }

  private async update(_role: Role, body: Record<string, unknown>): Promise<Reply> {
    const ts = String(body.ts);
    const where = await this.ctx.storage.get<Where>(`msg:${ts}`);
    if (!where?.wh) return { ok: false, error: 'message_not_found' };
    const hook = await this.hook(where.parent);
    const { content, buttons } = slackToDiscord(body);
    const q = new URLSearchParams();
    if (where.thread) q.set('thread_id', where.thread);
    if (buttons.length) q.set('with_components', 'true');
    await this.api('PATCH', `/webhooks/${hook.id}/${hook.token}/messages/${ts}?${q}`, {
      content: splitContent(content)[0],
      components: buttons.length ? await this.rows(buttons) : [],
    });
    if (buttons.length) await this.ctx.storage.put(`blocks:${ts}`, body.blocks);
    else await this.ctx.storage.delete(`blocks:${ts}`);
    return { ok: true, ts };
  }

  private async react(add: boolean, body: Record<string, unknown>): Promise<Reply> {
    const emoji = EMOJI[String(body.name)];
    if (!emoji) return { ok: false, error: 'invalid_name' };
    const ts = String(body.timestamp);
    const ch = (await this.ctx.storage.get<Where>(`msg:${ts}`))?.ch ?? String(body.channel);
    await this.api(
      add ? 'PUT' : 'DELETE',
      `/channels/${ch}/messages/${ts}/reactions/${encodeURIComponent(emoji)}/@me`,
    );
    return { ok: true };
  }

  /** 버튼 값은 custom_id(100자)에 다 들어가지 않아 여기 두고 열쇠만 보낸다. */
  private async rows(buttons: Parameters<typeof buttonRows>[0]) {
    const keys = buttons.map(() => crypto.randomUUID().replace(/-/g, '').slice(0, 16));
    for (const [i, b] of buttons.entries())
      await this.ctx.storage.put(`btn:${keys[i]}`, { v: b.value, at: Date.now() });
    return buttonRows(buttons, keys);
  }

  /** 버튼 누름 → 슬랙 block_actions 모양 재료(값 · 원래 블록 · 상위 채널). */
  async pressed(
    key: string,
    messageId: string,
    channelId: string,
  ): Promise<{ value: string | null; blocks: string; channel: string }> {
    const btn = await this.ctx.storage.get<{ v: string }>(`btn:${key}`);
    const where = await this.ctx.storage.get<Where>(`msg:${messageId}`);
    return {
      value: btn?.v ?? null,
      // RPC 반환은 직렬화되는 타입이어야 해서 블록은 JSON 글자로 넘긴다.
      blocks: JSON.stringify((await this.ctx.storage.get(`blocks:${messageId}`)) ?? []),
      channel: where?.parent ?? channelId,
    };
  }

  /** 슬랙 thread_ts 자리의 ID로 스레드를 찾거나 그 글에서 연다. 원글에서 연 스레드는 ID가 원글과 같다. */
  private async ensureThread(parent: string, ts: string): Promise<string> {
    const known = await this.ctx.storage.get<string>(`thr:${ts}`);
    if (known) return known;
    const ch = await this.api<{ type: number }>('GET', `/channels/${ts}`).catch(() => undefined);
    if (!ch || !THREAD_TYPES.includes(ch.type)) {
      const root = await this.api<{ content?: string }>(
        'GET',
        `/channels/${parent}/messages/${ts}`,
      ).catch(() => undefined);
      try {
        await this.api('POST', `/channels/${parent}/messages/${ts}/threads`, {
          name: threadName(root?.content),
          auto_archive_duration: 10_080,
        });
      } catch (e) {
        // 160004: 이미 스레드가 있는 글.
        if (!(e instanceof DiscordError && e.code === 160004)) throw e;
      }
    }
    await this.ctx.storage.put(`thr:${ts}`, ts);
    return ts;
  }

  /** 채널마다 역할 글을 쓰는 웹훅 하나(봇이 만든 웹훅이라 버튼을 달 수 있다). */
  private async hook(channel: string): Promise<Hook> {
    const cached = await this.ctx.storage.get<Hook>(`hook:${channel}`);
    if (cached) return cached;
    const list = await this.api<
      { id: string; token?: string; name?: string; application_id?: string }[]
    >('GET', `/channels/${channel}/webhooks`);
    const found = list.find(
      (w) => w.name === PERSONA_HOOK && w.token && w.application_id === this.env.DISCORD_APP_ID,
    );
    const made =
      found ??
      (await this.api<{ id: string; token: string }>('POST', `/channels/${channel}/webhooks`, {
        name: PERSONA_HOOK,
      }));
    const hook = { id: made.id, token: made.token! };
    await this.ctx.storage.put(`hook:${channel}`, hook);
    await this.ctx.storage.put(`ours:${hook.id}`, true);
    return hook;
  }

  /** 채널이 스레드면 상위 채널 ID, 아니면 ''. */
  private async parentOf(channel: string): Promise<string> {
    const known = await this.ctx.storage.get<string>(`par:${channel}`);
    if (known !== undefined) return known;
    const ch = await this.api<{ type: number; parent_id?: string }>('GET', `/channels/${channel}`);
    const parent = THREAD_TYPES.includes(ch.type) ? (ch.parent_id ?? '') : '';
    await this.ctx.storage.put(`par:${channel}`, parent);
    return parent;
  }

  // ── 게이트웨이 ─────────────────────────────────────────────

  /** 끊겨 있으면 잇고 1분 알람을 건다. 디스코드를 쓰지 않으면 아무것도 하지 않는다. */
  async ensure(): Promise<'off' | 'connected' | 'connecting'> {
    if (this.env.CHAT_PLATFORM !== 'discord' || !this.env.DISCORD_BOT_TOKEN) return 'off';
    if ((await this.ctx.storage.getAlarm()) == null)
      await this.ctx.storage.setAlarm(Date.now() + ALARM_MS);
    if (this.ws) return 'connected';
    await this.openGateway();
    return 'connecting';
  }

  async status() {
    const state = await this.ensure().catch((e: unknown) => `error: ${String(e).slice(0, 200)}`);
    const s = await this.ctx.storage.get<Session>('gw');
    return {
      platform: this.env.CHAT_PLATFORM ?? 'slack',
      state,
      socket: !!this.ws,
      session: !!s?.id,
      seq: this.seq ?? s?.seq ?? null,
      lastEventAt: (await this.ctx.storage.get<number>('lastEventAt')) ?? null,
    };
  }

  override async alarm() {
    await this.ensure().catch((e: unknown) => console.error('gateway ensure failed', String(e)));
    const day = new Date().toISOString().slice(0, 10);
    if ((await this.ctx.storage.get<string>('prunedOn')) !== day) {
      await this.prune();
      await this.ctx.storage.put('prunedOn', day);
    }
    if (this.env.CHAT_PLATFORM === 'discord')
      await this.ctx.storage.setAlarm(Date.now() + ALARM_MS);
  }

  /** 오래된 메시지 위치 · 버튼 값을 지운다(하루 한 번). */
  private async prune() {
    const cutoff = Date.now() - KEEP_MS;
    for (const prefix of ['msg:', 'btn:']) {
      const rows = await this.ctx.storage.list<{ at?: number }>({ prefix, limit: 2000 });
      const old = [...rows].filter(([, v]) => (v.at ?? 0) < cutoff).map(([k]) => k);
      for (let i = 0; i < old.length; i += 128) {
        const keys = old.slice(i, i + 128);
        await this.ctx.storage.delete(keys);
        if (prefix === 'msg:')
          await this.ctx.storage.delete(keys.map((k) => `blocks:${k.slice(4)}`));
      }
    }
  }

  private async openGateway() {
    const s = await this.ctx.storage.get<Session>('gw');
    this.seq = s?.seq ?? null;
    const base = (s?.url ?? 'wss://gateway.discord.gg').replace(/^wss:/, 'https:');
    const res = await fetch(`${base}/?v=10&encoding=json`, { headers: { Upgrade: 'websocket' } });
    const ws = res.webSocket;
    if (!ws) throw new Error(`gateway upgrade failed ${res.status}`);
    ws.accept();
    this.ws = ws;
    this.acked = true;
    ws.addEventListener('message', (e) => {
      this.frame(ws, JSON.parse(String(e.data)) as Frame).catch((err: unknown) =>
        console.error('gateway frame failed', String(err).slice(0, 300)),
      );
    });
    ws.addEventListener('close', (e) => {
      if (this.ws !== ws) return;
      this.ws = undefined;
      if (this.beat) clearInterval(this.beat);
      // 4004 토큰 틀림 · 4013/4014 인텐트 문제는 다시 이어도 같다(로그로 남기고 알람이 1분마다 다시 해 본다).
      console.error('gateway closed', e.code, e.reason);
      // 세션이 끝났거나 순번이 틀렸으면 새로 접속한다(IDENTIFY).
      if ([4007, 4009].includes(e.code)) void this.ctx.storage.delete('gw');
      // 다시 이어도 되는 끊김이면 1분 알람을 기다리지 않고 2초 뒤에 잇는다.
      if (!FATAL_CLOSE.includes(e.code)) void this.ctx.storage.setAlarm(Date.now() + 2_000);
    });
  }

  private sendOp(ws: WebSocket, op: number, d: unknown) {
    ws.send(JSON.stringify({ op, d }));
  }

  private async frame(ws: WebSocket, f: Frame) {
    if (f.s != null) this.seq = f.s;
    if (f.op === 10) {
      if (this.beat) clearInterval(this.beat);
      const every = (f.d as { heartbeat_interval: number }).heartbeat_interval;
      this.beat = setInterval(() => {
        // 응답(ACK) 없이 다음 박자가 오면 죽은 연결로 보고 끊는다. 알람이 RESUME으로 다시 잇는다.
        if (!this.acked) return ws.close(4000, 'zombie');
        this.acked = false;
        this.sendOp(ws, 1, this.seq);
      }, every);
      const s = await this.ctx.storage.get<Session>('gw');
      if (s?.id)
        this.sendOp(ws, 6, { token: this.env.DISCORD_BOT_TOKEN, session_id: s.id, seq: this.seq });
      else
        this.sendOp(ws, 2, {
          token: this.env.DISCORD_BOT_TOKEN,
          intents: INTENTS,
          properties: { os: 'cloudflare', browser: 'offside-agents', device: 'offside-agents' },
        });
      return;
    }
    if (f.op === 11) this.acked = true;
    else if (f.op === 1) this.sendOp(ws, 1, this.seq);
    else if (f.op === 7) ws.close(4000, 'reconnect');
    else if (f.op === 9) {
      if (!f.d) await this.ctx.storage.delete('gw');
      ws.close(4000, 'invalid session');
    } else if (f.op === 0) await this.dispatch(f.t!, f.d);
  }

  private async dispatch(t: string, d: unknown) {
    if (t === 'READY') {
      const r = d as { session_id: string; resume_gateway_url: string; user: { id: string } };
      await this.ctx.storage.put<Session>('gw', {
        id: r.session_id,
        url: r.resume_gateway_url,
        seq: this.seq,
      });
      await this.ctx.storage.put('botUser', r.user.id);
      return;
    }
    if (t === 'THREAD_CREATE') {
      const th = d as { id: string; parent_id?: string };
      await this.ctx.storage.put(`par:${th.id}`, th.parent_id ?? '');
      return;
    }
    if (t !== 'MESSAGE_CREATE') return;
    const m = d as DiscordMessage;
    const s = await this.ctx.storage.get<Session>('gw');
    if (s) await this.ctx.storage.put<Session>('gw', { ...s, seq: this.seq });
    await this.ctx.storage.put('lastEventAt', Date.now());
    if (m.guild_id !== this.env.DISCORD_GUILD_ID) return;
    const botUser = await this.ctx.storage.get<string>('botUser');
    if (m.author?.id === botUser) return;
    // 역할 글(우리 웹훅)에는 반응하지 않는다. 알림 웹훅 글은 경보로 읽는다.
    if (m.webhook_id && (await this.ctx.storage.get(`ours:${m.webhook_id}`))) return;
    const parent = await this.parentOf(m.channel_id);
    await this.ctx.storage.put<Where>(`msg:${m.id}`, {
      ch: m.channel_id,
      parent: parent || m.channel_id,
      ...(parent ? { thread: m.channel_id } : {}),
      at: Date.now(),
    });
    const { ev, mentioned } = toSlackEvent(m, parent, botUser);
    for (const task of discordTasks(this.env, `discord:${m.id}`, ev, mentioned))
      await dispatchTask(this.env, task).catch((e: unknown) =>
        console.error('enqueue failed', String(e)),
      );
  }
}

type Frame = { op: number; d: unknown; s?: number | null; t?: string | null };
