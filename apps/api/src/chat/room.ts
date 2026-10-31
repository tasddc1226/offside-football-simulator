import { DurableObject } from 'cloudflare:workers';
import type { OwnerTier } from '@offside/contracts/owner-tier';
import {
  CHAT_HISTORY,
  CHAT_KEEP_MS,
  CHAT_REPLY_SNIPPET,
  CHAT_TICKET_MS,
  type ChatMessage,
  type ChatRejectCode,
  type ChatReply,
  type ChatServerEvent,
} from '@offside/contracts/chat';
import { LIVE_PING, LIVE_PONG } from '@offside/contracts/polling';
import {
  FIELD_GOAL_GAP_MS,
  FIELD_GOAL_TOUCH_MS,
  FIELD_SCORE_KEEP_DAYS,
  FIELD_SCORE_ROWS,
  FIELD_SERVER_MIN_MS,
  fieldDay,
  parseFieldEvent,
  type FieldBall,
  type FieldGoalRow,
  type FieldPeer,
  type FieldServerEvent,
} from '@offside/contracts/lounge-field';
import type { Bindings } from '../env.js';
import { MAX_SOCKETS } from '../live/hub.js';
import { checkSend } from './rules.js';
import {
  communityOwnerEmail,
  communityRecipients,
  communityStatements,
  type CommunityEvent,
} from '../push/community.js';
import { publishCommunityPush } from '../push/communityQueue.js';

// T-11-015 채팅방. 언어마다 방 하나(이름 chatRoomName, T-11-583)가 소켓을 모두 붙들고, 받은 줄을 SQLite에 적은 뒤 모두에게 보낸다.
// LiveHub처럼 Hibernation API로 받는다 — 조용하면 잠들어 비용이 없고, 핑에는 깨지 않고 런타임이 pong을 돌려준다.
// 누구나 읽고, 쓰려면 API가 발급한 입장권(issueTicket)을 소켓 주소에 붙여 온다. 소켓마다 누가 쓰는지와 최근
// 전송 시각(도배 방지)을 attachment에 둔다 — 잠들었다 깨도 남는다.

/** 쓸 수 있는 사람. */
export type ChatWriter = {
  profileId: string;
  author: string;
  nickname: string;
  admin: boolean;
  /** T-11-128 입장권을 받을 때의 지난 시즌 티어. */
  tier?: OwnerTier | null;
  /** T-11-150 입장권을 받을 때의 대표 칭호. */
  title?: string | null;
  avatarId?: string | null;
};
/**
 * f: 필드 보기를 열었다(T-11-600). p: 필드에서 마지막으로 받은 내 위치. b: 마지막으로 공을 건드린 시각.
 * 잠들었다 깨도 남도록 attachment에 둔다.
 */
type Attachment = {
  w: ChatWriter | null;
  sent: number[];
  f?: boolean;
  p?: Omit<FieldPeer, 'a' | 'n'>;
  b?: number;
};
/** 신고·차단할 때 API가 읽는 메시지 한 줄(작성자 프로필 포함). */
type StoredMessage = ChatMessage & { profileId: string };

type Row = Record<string, string | number | null>;
/** T-11-573 원문과 붙여 읽는 칸 — r_로 시작하는 칸이 원문(가려졌거나 지워졌으면 null)이다. */
const WITH_REPLY = `SELECT m.*, r.author AS r_author, r.nickname AS r_nickname, r.admin AS r_admin,
  r.body AS r_body FROM messages m LEFT JOIN messages r ON r.id = m.reply_to AND r.hidden = 0`;
const replyOf = (id: string, author: string, nickname: string, admin: boolean, body: string) =>
  ({ id, author, nickname, admin, body: body.slice(0, CHAT_REPLY_SNIPPET) }) satisfies ChatReply;
const toMessage = (r: Row): StoredMessage => ({
  id: String(r.id),
  at: Number(r.at),
  author: String(r.author),
  nickname: String(r.nickname),
  body: String(r.body),
  admin: r.admin === 1,
  tier: (r.tier as OwnerTier | null) ?? null,
  title: (r.title as string | null) ?? null,
  avatarId: (r.avatar_id as string | null) ?? null,
  // 답장이 아닌 줄엔 두 칸을 싣지 않는다.
  ...(r.reply_to != null && {
    replyTo: String(r.reply_to),
    reply:
      r.r_author != null
        ? replyOf(
            String(r.reply_to),
            String(r.r_author),
            String(r.r_nickname),
            r.r_admin === 1,
            String(r.r_body),
          )
        : null,
  }),
  profileId: String(r.profile_id),
});
const publicOf = ({ profileId: _, ...m }: StoredMessage): ChatMessage => m;
const send = (ws: WebSocket, message: string) => {
  try {
    ws.send(message);
  } catch {
    // 이미 닫히는 중 — webSocketClose가 정리한다.
  }
};

const sendAll = (sockets: WebSocket[], event: ChatServerEvent) => {
  const message = JSON.stringify(event);
  for (const ws of sockets) send(ws, message);
};

/** T-11-583 운영자 채팅 알림에 붙이는 방 표시. 한국어 방(예전 이름)은 붙이지 않는다. */
export const roomTag = (name: string | undefined): string => {
  const lang = name?.split(':')[1];
  return lang ? `[${lang.toUpperCase()}] ` : '';
};

export class ChatRoom extends DurableObject<Bindings> {
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(LIVE_PING, LIVE_PONG));
    this.sql = ctx.storage.sql;
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, at INTEGER NOT NULL, profile_id TEXT NOT NULL,
        author TEXT NOT NULL, nickname TEXT NOT NULL, body TEXT NOT NULL, admin INTEGER NOT NULL,
        hidden INTEGER NOT NULL DEFAULT 0)`,
    );
    this.sql.exec('CREATE INDEX IF NOT EXISTS messages_at ON messages (at)');
    // T-11-128 티어 칸. 이미 있는 방에는 한 번 더한다.
    const cols = this.sql.exec<Row>('PRAGMA table_info(messages)').toArray();
    if (!cols.some((c) => c.name === 'tier'))
      this.sql.exec('ALTER TABLE messages ADD COLUMN tier TEXT');
    // T-11-150 대표 칭호 칸.
    if (!cols.some((c) => c.name === 'title'))
      this.sql.exec('ALTER TABLE messages ADD COLUMN title TEXT');
    if (!cols.some((c) => c.name === 'avatar_id'))
      this.sql.exec('ALTER TABLE messages ADD COLUMN avatar_id TEXT');
    // T-11-573 답장한 원문 id.
    if (!cols.some((c) => c.name === 'reply_to'))
      this.sql.exec('ALTER TABLE messages ADD COLUMN reply_to TEXT');
    this.sql.exec('CREATE INDEX IF NOT EXISTS messages_profile ON messages (profile_id)');
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS community_push_outbox (id TEXT PRIMARY KEY REFERENCES messages(id), at INTEGER NOT NULL)`,
    );
    this.sql.exec(
      'CREATE INDEX IF NOT EXISTS community_push_outbox_at ON community_push_outbox(at)',
    );
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, expires INTEGER NOT NULL, writer TEXT NOT NULL)`,
    );
    // T-11-600 라운지 필드 오늘의 득점(KST 날짜 · 작성자마다 한 줄). first_at은 같은 골 수일 때 먼저 넣은 사람이 위.
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS field_goals (day TEXT NOT NULL, author TEXT NOT NULL, nickname TEXT NOT NULL,
        goals INTEGER NOT NULL, first_at INTEGER NOT NULL, PRIMARY KEY (day, author))`,
    );
  }

  /** 소켓마다 마지막으로 받은 위치 · 공 시각(잠들면 비지만 그때는 이미 조용하다). */
  private readonly fieldSeen = new WeakMap<WebSocket, number>();
  /** 마지막으로 골을 인정한 시각. */
  private lastGoalAt = 0;
  /** T-11-600 마지막으로 받은 공 상태(새로 필드를 연 사람에게 준다). 방이 잠들면 잊고 가운데에서 다시 시작한다. */
  private fieldBall: ({ a: string } & FieldBall) | null = null;

  /** 입장권을 만든다. 한 번 쓰면 사라지고, CHAT_TICKET_MS 안에 써야 한다. */
  async updateAvatar(profileId: string, avatarId: string | null): Promise<void> {
    const rows = this.sql
      .exec<Row>('SELECT author FROM messages WHERE profile_id = ? LIMIT 1', profileId)
      .toArray();
    this.sql.exec('UPDATE messages SET avatar_id = ? WHERE profile_id = ?', avatarId, profileId);
    let author = rows[0]?.author as string | undefined;
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment;
      if (att.w?.profileId === profileId) {
        author = att.w.author;
        ws.serializeAttachment({ ...att, w: { ...att.w, avatarId } });
      }
    }
    for (const row of this.sql.exec<Row>('SELECT id, writer FROM tickets').toArray()) {
      const writer = JSON.parse(String(row.writer)) as ChatWriter;
      if (writer.profileId === profileId)
        this.sql.exec(
          'UPDATE tickets SET writer = ? WHERE id = ?',
          JSON.stringify({ ...writer, avatarId }),
          String(row.id),
        );
    }
    if (author) this.broadcast({ t: 'avatar', author, avatarId });
  }

  issueTicket(writer: ChatWriter): string {
    const now = Date.now();
    const id = crypto.randomUUID();
    this.sql.exec('DELETE FROM tickets WHERE expires < ?', now);
    this.sql.exec(
      'INSERT INTO tickets (id, expires, writer) VALUES (?, ?, ?)',
      id,
      now + CHAT_TICKET_MS,
      JSON.stringify(writer),
    );
    return id;
  }

  override async fetch(req: Request): Promise<Response> {
    const others = this.ctx.getWebSockets();
    const online = others.length;
    if (online >= MAX_SOCKETS) return new Response(null, { status: 503 });
    const ticket = new URL(req.url).searchParams.get('t');
    const w = ticket ? this.useTicket(ticket) : null;
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ w, sent: [] } satisfies Attachment);
    const hello: ChatServerEvent = {
      t: 'hello',
      ...this.page(),
      online: online + 1,
      write: !!w,
    };
    send(server, JSON.stringify(hello));
    // 새 소켓은 hello로 이미 받았다.
    sendAll(others, { t: 'online', n: online + 1 });
    return new Response(null, { status: 101, webSocket: client });
  }

  override webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): void {
    if (typeof data !== 'string') return;
    let body: unknown;
    let replyTo: unknown;
    try {
      const event = JSON.parse(data) as Record<string, unknown>;
      if (event.t === 'older') {
        if (typeof event.before === 'string')
          send(
            ws,
            JSON.stringify({ t: 'older', ...this.page(event.before) } satisfies ChatServerEvent),
          );
        return;
      }
      if (event.t !== 'send') return this.fieldMessage(ws, event);
      body = event.body;
      replyTo = event.replyTo;
    } catch {
      return;
    }
    const att = ws.deserializeAttachment() as Attachment;
    if (!att.w) return this.reject(ws, 'readonly');
    const now = Date.now();
    const check = checkSend(body, att.sent, now, att.w.admin);
    if (!check) return;
    if (!check.ok) return this.reject(ws, check.code);
    ws.serializeAttachment({ ...att, sent: check.sent } satisfies Attachment);
    const {
      profileId,
      author,
      nickname,
      admin,
      tier = null,
      title = null,
      avatarId = null,
    } = att.w;
    // T-11-573 답장은 가려지지 않은 원문에만 단다. 원문이 없으면 보통 메시지로 올린다.
    const [parent] =
      typeof replyTo === 'string' && replyTo
        ? this.sql
            .exec<Row>(
              'SELECT id, author, nickname, admin, body FROM messages WHERE id = ? AND hidden = 0',
              replyTo,
            )
            .toArray()
        : [];
    const reply = parent
      ? replyOf(
          String(parent.id),
          String(parent.author),
          String(parent.nickname),
          parent.admin === 1,
          String(parent.body),
        )
      : null;
    const m: ChatMessage = {
      id: crypto.randomUUID(),
      at: now,
      author,
      nickname,
      body: check.body,
      admin,
      tier,
      title,
      avatarId,
      ...(reply ? { replyTo: reply.id, reply } : {}),
    };
    const notify = !admin && !!communityOwnerEmail(this.env);
    this.ctx.storage.transactionSync(() => {
      this.sql.exec(
        'INSERT INTO messages (id, at, profile_id, author, nickname, body, admin, tier, title, avatar_id, reply_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        m.id,
        m.at,
        profileId,
        author,
        nickname,
        m.body,
        admin ? 1 : 0,
        tier,
        title,
        avatarId,
        reply?.id ?? null,
      );
      if (notify)
        this.sql.exec('INSERT INTO community_push_outbox (id, at) VALUES (?, ?)', m.id, now);
      this.sql.exec('DELETE FROM community_push_outbox WHERE at < ?', now - 86400_000);
      this.sql.exec('DELETE FROM messages WHERE at < ?', now - CHAT_KEEP_MS);
    });
    // No await between SQL and setAlarm: storage write coalescing persists both atomically.
    if (notify) this.ctx.waitUntil(this.ctx.storage.setAlarm(now));
    this.broadcast({ t: 'msg', m });
  }

  private async ensureCommunityAlarm() {
    const alarm = await this.ctx.storage.getAlarm();
    if (alarm === null) await this.ctx.storage.setAlarm(Date.now() + 1000);
  }

  /** DO and D1 cannot share a transaction. Persist locally first, retry idempotently by message ID. */
  override async alarm() {
    // Reserve the next attempt before crossing the D1 boundary, including abrupt failures.
    await this.ctx.storage.setAlarm(Date.now() + 60_000);
    this.sql.exec('DELETE FROM community_push_outbox WHERE at < ?', Date.now() - 86400_000);
    const rows = this.sql
      .exec<Row>(
        `SELECT m.* FROM community_push_outbox q
      JOIN messages m ON m.id = q.id ORDER BY q.at LIMIT 50`,
      )
      .toArray();
    if (rows.length) {
      const recipients = await communityRecipients(this.env);
      const stmts = rows
        .filter((r) => r.hidden === 0)
        .flatMap((r) => {
          const m = toMessage(r);
          const event: CommunityEvent = {
            ...m,
            body: roomTag(this.ctx.id?.name) + m.body,
            type: 'chat',
            now: new Date(m.at).toISOString(),
          };
          return communityStatements(this.env, recipients, event);
        });
      if (stmts.length) {
        await this.env.DB.batch(stmts);
        await publishCommunityPush(
          this.env,
          rows.filter((r) => r.hidden === 0).map((r) => `admin-community-chat:${String(r.id)}`),
        );
      }
      this.ctx.storage.transactionSync(() => {
        for (const r of rows)
          this.sql.exec('DELETE FROM community_push_outbox WHERE id = ?', String(r.id));
      });
    }
    const [pending] = this.sql.exec<Row>('SELECT id FROM community_push_outbox LIMIT 1').toArray();
    if (!pending) {
      await this.ctx.storage.deleteAlarm();
      // A websocket write may have interleaved while deleting the old alarm.
      if (this.sql.exec<Row>('SELECT id FROM community_push_outbox LIMIT 1').toArray().length)
        await this.ensureCommunityAlarm();
    }
  }

  override webSocketClose(ws: WebSocket, code: number): void {
    // 1005(코드 없음)·1006(비정상)은 되돌려 보낼 수 없는 예약 코드다.
    ws.close(code === 1005 || code === 1006 ? 1000 : code);
    const rest = this.ctx.getWebSockets().filter((s) => s !== ws);
    sendAll(rest, { t: 'online', n: rest.length });
    const att = ws.deserializeAttachment() as Attachment | null;
    if (att?.f && att.w) this.fieldSend({ t: 'leave', a: att.w.author }, ws);
  }

  /**
   * T-11-600 라운지 필드 이벤트. 위치 · 동작 · 공은 저장하지 않고 필드를 연 다른 소켓에 넘긴다. 쓰려면 입장권이
   * 있어야 하고(읽기 전용은 보기만), 위치 · 공은 소켓마다 FIELD_SERVER_MIN_MS보다 잦으면 버린다.
   */
  private fieldMessage(ws: WebSocket, raw: Record<string, unknown>) {
    const e = parseFieldEvent(raw);
    if (!e) return;
    const att = ws.deserializeAttachment() as Attachment;
    const now = Date.now();
    if (e.t === 'field') {
      if (!!att.f === e.on) return;
      ws.serializeAttachment({ ...att, f: e.on } satisfies Attachment);
      if (e.on) {
        const day = fieldDay(now);
        send(
          ws,
          JSON.stringify({
            t: 'field',
            peers: this.fieldPeers(ws),
            score: this.fieldScore(day),
            day,
            ...(this.fieldBall ? { ball: this.fieldBall } : {}),
          } satisfies FieldServerEvent),
        );
      } else if (att.w) this.fieldSend({ t: 'leave', a: att.w.author }, ws);
      return;
    }
    const w = att.w;
    if (!w || !att.f) return;
    if (e.t === 'pos' || e.t === 'ball') {
      if (now - (this.fieldSeen.get(ws) ?? 0) < FIELD_SERVER_MIN_MS) return;
      this.fieldSeen.set(ws, now);
    }
    switch (e.t) {
      case 'pos': {
        const p = { x: e.x, y: e.y, fx: e.fx, fy: e.fy };
        ws.serializeAttachment({ ...att, p } satisfies Attachment);
        this.fieldSend({ t: 'pos', a: w.author, n: w.nickname, ...p }, ws);
        return;
      }
      case 'act':
        if (e.k === 'kick' || e.k === 'tackle' || e.k === 'flick')
          ws.serializeAttachment({ ...att, b: now } satisfies Attachment);
        this.fieldSend({ ...e, a: w.author }, ws);
        return;
      case 'ball': {
        ws.serializeAttachment({ ...att, b: now } satisfies Attachment);
        this.fieldBall = { a: w.author, x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz };
        this.fieldSend({ ...e, a: w.author }, ws);
        return;
      }
      case 'goal': {
        // 이 소켓이 최근에 공을 건드렸고, 바로 앞 골의 축하가 끝났을 때만 센다.
        if (!att.b || now - att.b > FIELD_GOAL_TOUCH_MS) return;
        if (now - this.lastGoalAt < FIELD_GOAL_GAP_MS) return;
        this.lastGoalAt = now;
        this.fieldBall = null;
        const day = fieldDay(now);
        this.sql.exec(
          `INSERT INTO field_goals (day, author, nickname, goals, first_at) VALUES (?, ?, ?, 1, ?)
           ON CONFLICT (day, author) DO UPDATE SET goals = goals + 1, nickname = excluded.nickname`,
          day,
          w.author,
          w.nickname,
          now,
        );
        const old = fieldDay(now - FIELD_SCORE_KEEP_DAYS * 86_400_000);
        this.sql.exec('DELETE FROM field_goals WHERE day < ?', old);
        this.fieldSend({
          t: 'goal',
          a: w.author,
          n: w.nickname,
          side: e.side,
          score: this.fieldScore(day),
          day,
        });
        return;
      }
    }
  }

  /** 필드를 연 소켓들(skip 빼고)에 보낸다. */
  private fieldSend(event: FieldServerEvent, skip?: WebSocket) {
    const message = JSON.stringify(event);
    for (const s of this.ctx.getWebSockets()) {
      if (s === skip) continue;
      const att = s.deserializeAttachment() as Attachment | null;
      if (att?.f) send(s, message);
    }
  }

  /** 필드에 있는 다른 사람들(위치를 한 번이라도 보낸 사람, 같은 사람의 여러 소켓은 하나로). */
  private fieldPeers(self: WebSocket): FieldPeer[] {
    const me = (self.deserializeAttachment() as Attachment | null)?.w?.author;
    const peers = new Map<string, FieldPeer>();
    for (const s of this.ctx.getWebSockets()) {
      if (s === self) continue;
      const att = s.deserializeAttachment() as Attachment | null;
      if (!att?.f || !att.w || !att.p || att.w.author === me) continue;
      peers.set(att.w.author, { a: att.w.author, n: att.w.nickname, ...att.p });
    }
    return [...peers.values()];
  }

  /** 그날 득점 상위 줄. */
  private fieldScore(day: string): FieldGoalRow[] {
    return this.sql
      .exec<Row>(
        'SELECT author, nickname, goals FROM field_goals WHERE day = ? ORDER BY goals DESC, first_at LIMIT ?',
        day,
        FIELD_SCORE_ROWS,
      )
      .toArray()
      .map((r) => ({ a: String(r.author), n: String(r.nickname), goals: Number(r.goals) }));
  }

  /** 가려지지 않은 메시지 한 줄(신고·차단 대상 확인). */
  message(id: string): StoredMessage | null {
    const [row] = this.sql
      .exec<Row>('SELECT * FROM messages WHERE id = ? AND hidden = 0', id)
      .toArray();
    return row ? toMessage(row) : null;
  }

  /**
   * T-11-277 슬랙 에이전트(@plan)가 읽는 최근 줄(오래된 순). 가린 줄 · 운영자 줄은 빼고 닉네임 · 표시 이름 없이
   * 작성자 프로필만 넘긴다(라우트가 가명으로 바꾼다).
   */
  recent(
    since: number,
    limit: number,
  ): { id: string; at: number; profileId: string; body: string }[] {
    return this.sql
      .exec<Row>(
        'SELECT id, at, profile_id, body FROM messages WHERE hidden = 0 AND admin = 0 AND at > ? ORDER BY at, rowid LIMIT ?',
        since,
        limit,
      )
      .toArray()
      .map((r) => ({
        id: String(r.id),
        at: Number(r.at),
        profileId: String(r.profile_id),
        body: String(r.body),
      }));
  }

  /** 메시지를 가리고 모두의 화면에서 뺀다. 이미 가렸거나 없으면 false. */
  hide(id: string): boolean {
    const { rowsWritten } = this.sql.exec(
      'UPDATE messages SET hidden = 1 WHERE id = ? AND hidden = 0',
      id,
    );
    if (!rowsWritten) return false;
    this.broadcast({ t: 'hide', id });
    return true;
  }

  /** 채팅 정지 — 그 사람의 열린 소켓을 읽기 전용으로 바꾼다. 바꾼 소켓 수를 돌려준다. */
  revoke(profileId: string): number {
    let n = 0;
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (att?.w?.profileId !== profileId) continue;
      ws.serializeAttachment({ ...att, w: null } satisfies Attachment);
      this.reject(ws, 'muted');
      n++;
    }
    return n;
  }

  private useTicket(id: string): ChatWriter | null {
    const [row] = this.sql
      .exec<{ writer: string; expires: number }>(
        'DELETE FROM tickets WHERE id = ? RETURNING writer, expires',
        id,
      )
      .toArray();
    return row && row.expires >= Date.now() ? (JSON.parse(row.writer) as ChatWriter) : null;
  }

  /**
   * 가려지지 않은 줄 CHAT_HISTORY개(오래된 순)와 그 이전 줄이 더 있는지. before(메시지 id)가 있으면 그 줄보다 이전
   * 줄(T-11-180 위로 올리기, 같은 시각이면 먼저 들어온 줄)이고, before가 지워졌으면 빈 페이지다.
   */
  private page(before?: string): { messages: ChatMessage[]; more: boolean } {
    const rows = this.sql
      .exec<Row>(
        `${WITH_REPLY} WHERE m.hidden = 0${
          before ? ' AND (m.at, m.rowid) < (SELECT at, rowid FROM messages WHERE id = ?)' : ''
        } ORDER BY m.at DESC, m.rowid DESC LIMIT ?`,
        ...(before ? [before] : []),
        CHAT_HISTORY + 1,
      )
      .toArray();
    return {
      messages: rows
        .slice(0, CHAT_HISTORY)
        .reverse()
        .map((r) => publicOf(toMessage(r))),
      more: rows.length > CHAT_HISTORY,
    };
  }

  private reject(ws: WebSocket, code: ChatRejectCode) {
    send(ws, JSON.stringify({ t: 'err', code } satisfies ChatServerEvent));
  }

  private broadcast(event: ChatServerEvent) {
    sendAll(this.ctx.getWebSockets(), event);
  }
}
