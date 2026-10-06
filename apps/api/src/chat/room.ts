import { DurableObject } from 'cloudflare:workers';
import type { OwnerTier } from '@offside/contracts/owner-tier';
import {
  CHAT_HISTORY,
  CHAT_KEEP_MS,
  CHAT_TICKET_MS,
  type ChatClientEvent,
  type ChatMessage,
  type ChatRejectCode,
  type ChatServerEvent,
} from '@offside/contracts/chat';
import { LIVE_PING, LIVE_PONG } from '@offside/contracts/polling';
import type { Bindings } from '../env.js';
import { MAX_SOCKETS } from '../live/hub.js';
import { checkSend } from './rules.js';

// T-11-015 채팅방. 방 하나(이름 CHAT_ROOM)가 소켓을 모두 붙들고, 받은 줄을 SQLite에 적은 뒤 모두에게 보낸다.
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
};
type Attachment = { w: ChatWriter | null; sent: number[] };
/** 신고·차단할 때 API가 읽는 메시지 한 줄(작성자 프로필 포함). */
type StoredMessage = ChatMessage & { profileId: string };

type Row = Record<string, string | number | null>;
const toMessage = (r: Row): StoredMessage => ({
  id: String(r.id),
  at: Number(r.at),
  author: String(r.author),
  nickname: String(r.nickname),
  body: String(r.body),
  admin: r.admin === 1,
  tier: (r.tier as OwnerTier | null) ?? null,
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
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, expires INTEGER NOT NULL, writer TEXT NOT NULL)`,
    );
  }

  /** 입장권을 만든다. 한 번 쓰면 사라지고, CHAT_TICKET_MS 안에 써야 한다. */
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
      messages: this.recent(),
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
    try {
      const event = JSON.parse(data) as Partial<Record<keyof ChatClientEvent, unknown>>;
      if (event.t !== 'send') return;
      body = event.body;
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
    const { profileId, author, nickname, admin, tier = null } = att.w;
    const m: ChatMessage = {
      id: crypto.randomUUID(),
      at: now,
      author,
      nickname,
      body: check.body,
      admin,
      tier,
    };
    this.sql.exec(
      'INSERT INTO messages (id, at, profile_id, author, nickname, body, admin, tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      m.id,
      m.at,
      profileId,
      author,
      nickname,
      m.body,
      admin ? 1 : 0,
      tier,
    );
    this.sql.exec('DELETE FROM messages WHERE at < ?', now - CHAT_KEEP_MS);
    this.broadcast({ t: 'msg', m });
  }

  override webSocketClose(ws: WebSocket, code: number): void {
    // 1005(코드 없음)·1006(비정상)은 되돌려 보낼 수 없는 예약 코드다.
    ws.close(code === 1005 || code === 1006 ? 1000 : code);
    const rest = this.ctx.getWebSockets().filter((s) => s !== ws);
    sendAll(rest, { t: 'online', n: rest.length });
  }

  /** 가려지지 않은 메시지 한 줄(신고·차단 대상 확인). */
  message(id: string): StoredMessage | null {
    const [row] = this.sql
      .exec<Row>('SELECT * FROM messages WHERE id = ? AND hidden = 0', id)
      .toArray();
    return row ? toMessage(row) : null;
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

  private recent(): ChatMessage[] {
    return this.sql
      .exec<Row>('SELECT * FROM messages WHERE hidden = 0 ORDER BY at DESC LIMIT ?', CHAT_HISTORY)
      .toArray()
      .reverse()
      .map((r) => publicOf(toMessage(r)));
  }

  private reject(ws: WebSocket, code: ChatRejectCode) {
    send(ws, JSON.stringify({ t: 'err', code } satisfies ChatServerEvent));
  }

  private broadcast(event: ChatServerEvent) {
    sendAll(this.ctx.getWebSockets(), event);
  }
}
