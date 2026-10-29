import { DatabaseSync } from 'node:sqlite';
import { vi } from 'vitest';
import { CHAT_ROOM } from '@offside/contracts/chat';
import { ChatRoom } from '../chat/room.js';
import type { Bindings } from '../env.js';

// T-11-015 채팅방 대역: 진짜 ChatRoom을 Node에서 돌린다. Durable Object SQLite는 node:sqlite로, 소켓은 보낸
// 메시지를 모으는 가짜로 흉내 낸다. 웹소켓 쌍(WebSocketPair)·핑 자동 응답·101 응답도 전역에 끼운다.

export type FakeSocket = {
  sent: unknown[];
  send(m: string): void;
  close: ReturnType<typeof vi.fn>;
  serializeAttachment(v: unknown): void;
  deserializeAttachment(): unknown;
};

export function fakeSocket(): FakeSocket {
  let att: unknown = null;
  const sent: unknown[] = [];
  return {
    sent,
    send: (m) => sent.push(JSON.parse(m)),
    close: vi.fn(),
    serializeAttachment: (v) => (att = structuredClone(v)),
    deserializeAttachment: () => att,
  };
}

function fakeSql() {
  const db = new DatabaseSync(':memory:');
  return {
    exec(query: string, ...bindings: (string | number)[]) {
      const stmt = db.prepare(query);
      if (/^\s*(select|pragma)|\breturning\b/i.test(query)) {
        const rows = stmt.all(...bindings);
        return { toArray: () => rows, rowsWritten: 0 };
      }
      const { changes } = stmt.run(...bindings);
      return { toArray: () => [], rowsWritten: Number(changes) };
    },
  };
}

/** 가짜 전역을 끼운 뒤 방을 만든다. 테스트 끝에 vi.unstubAllGlobals(). */
export function fakeRoom(env = {} as Bindings) {
  vi.stubGlobal(
    'WebSocketRequestResponsePair',
    class {
      constructor(
        readonly request: string,
        readonly response: string,
      ) {}
    },
  );
  vi.stubGlobal(
    'WebSocketPair',
    class {
      0 = fakeSocket();
      1 = fakeSocket();
    },
  );
  // Node의 Response는 101을 받지 않는다 — 워커 런타임처럼 받아 준다.
  vi.stubGlobal(
    'Response',
    class extends Response {
      constructor(body?: BodyInit | null, init?: ResponseInit & { webSocket?: unknown }) {
        super(body, init?.status === 101 ? { ...init, status: 200 } : init);
      }
    },
  );
  /** 방 하나의 저장소·소켓·알람(T-11-583 언어 방마다 따로). */
  const makeCtx = (name: string) => {
    const sockets: FakeSocket[] = [];
    let alarm: number | null = null;
    const ctx = {
      id: { name },
      storage: {
        sql: fakeSql(),
        transactionSync: <T>(fn: () => T) => fn(),
        getAlarm: async () => alarm,
        setAlarm: async (at: number) => {
          alarm = at;
        },
        deleteAlarm: async () => {
          alarm = null;
        },
      },
      waitUntil: (p: Promise<unknown>) => {
        pending.push(p);
      },
      getWebSockets: () => sockets,
      acceptWebSocket: (ws: FakeSocket) => sockets.push(ws),
      setWebSocketAutoResponse: vi.fn(),
    };
    return { ctx, sockets };
  };
  const pending: Promise<unknown>[] = [];
  const { ctx, sockets } = makeCtx(CHAT_ROOM);
  const room = new ChatRoom(ctx as unknown as DurableObjectState, env);
  /** 방에 소켓 하나를 붙이고(입장권이 있으면 `?t=`) 서버 쪽 소켓을 돌려준다. */
  const join = async (ticket?: string) => {
    await room.fetch(new Request(`http://api.test/v1/chat/ws${ticket ? `?t=${ticket}` : ''}`));
    return sockets.at(-1)!;
  };
  /** T-11-583 이름마다 방 하나. 한국어 방(CHAT_ROOM)은 위의 room이다. */
  const others = new Map<string, { room: ChatRoom; sockets: FakeSocket[] }>();
  const named = (name: string) => {
    if (name === CHAT_ROOM) return { room, sockets };
    let r = others.get(name);
    if (!r) {
      const made = makeCtx(name);
      r = {
        room: new ChatRoom(made.ctx as unknown as DurableObjectState, env),
        sockets: made.sockets,
      };
      others.set(name, r);
    }
    return r;
  };
  const ns = { idFromName: (n: string) => n, get: (n: string) => named(n).room };
  return {
    room,
    sockets,
    join,
    drain: () => Promise.all(pending),
    restart: () => new ChatRoom(ctx as unknown as DurableObjectState, env),
    named,
    ns: ns as unknown as NonNullable<Bindings['CHAT']>,
  };
}
