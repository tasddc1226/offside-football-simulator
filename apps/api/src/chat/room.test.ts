import {
  CHAT_HISTORY,
  CHAT_KEEP_MS,
  CHAT_TICKET_MS,
  type ChatServerEvent,
} from '@offside/contracts/chat';
import { LIVE_PING, LIVE_PONG } from '@offside/contracts/polling';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeRoom, type FakeSocket } from '../test/chatRoom.js';
import type { ChatWriter } from './room.js';

const ALICE: ChatWriter = { profileId: 'prf_a', author: 'aaaa', nickname: '앨리스', admin: false };
const BOB: ChatWriter = { profileId: 'prf_b', author: 'bbbb', nickname: '밥', admin: false };
const say = (ws: FakeSocket, room: ReturnType<typeof fakeRoom>['room'], body: string) =>
  room.webSocketMessage(ws as unknown as WebSocket, JSON.stringify({ t: 'send', body }));
const last = (ws: FakeSocket) => ws.sent.at(-1) as ChatServerEvent;

describe('T-11-015 ChatRoom', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('핑에는 깨지 않고 pong을 돌려주게 한다', () => {
    const { room } = fakeRoom();
    expect(room).toBeDefined();
    const ctx = (room as unknown as { ctx: { setWebSocketAutoResponse: ReturnType<typeof vi.fn> } })
      .ctx;
    expect(ctx.setWebSocketAutoResponse).toHaveBeenCalledWith({
      request: LIVE_PING,
      response: LIVE_PONG,
    });
  });

  it('입장권이 있으면 쓰고, 없으면 읽기만 한다. 한 줄은 모두에게 간다(프로필 id 없이)', async () => {
    const { room, join } = fakeRoom();
    const reader = await join();
    expect(last(reader)).toEqual({ t: 'hello', messages: [], online: 1, write: false });
    const alice = await join(room.issueTicket(ALICE));
    expect(last(alice)).toMatchObject({ t: 'hello', online: 2, write: true });

    say(alice, room, '안녕하세요');
    const m = last(reader);
    expect(m).toMatchObject({
      t: 'msg',
      m: { author: 'aaaa', nickname: '앨리스', body: '안녕하세요', admin: false },
    });
    expect(JSON.stringify(m)).not.toContain('prf_a');
    expect(last(alice)).toEqual(m);

    say(reader, room, '나도');
    expect(last(reader)).toEqual({ t: 'err', code: 'readonly' });
  });

  it('입장권은 한 번만, 수명 안에서만 쓴다', async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const { room, join } = fakeRoom();
    const ticket = room.issueTicket(ALICE);
    expect(last(await join(ticket))).toMatchObject({ write: true });
    expect(last(await join(ticket))).toMatchObject({ write: false });
    const stale = room.issueTicket(ALICE);
    vi.advanceTimersByTime(CHAT_TICKET_MS + 1);
    expect(last(await join(stale))).toMatchObject({ write: false });
  });

  it('도배는 보낸 사람에게만 거절을 알린다', async () => {
    const { room, join } = fakeRoom();
    const reader = await join();
    const alice = await join(room.issueTicket(ALICE));
    say(alice, room, '하나');
    say(alice, room, '둘');
    expect(last(alice)).toEqual({ t: 'err', code: 'rate' });
    expect(reader.sent.filter((e) => (e as ChatServerEvent).t === 'msg')).toHaveLength(1);
  });

  it('들어오면 가려지지 않은 최근 메시지를 오래된 순으로 받고, 기간이 지난 메시지는 지운다', async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const { room, join } = fakeRoom();
    const admin = await join(room.issueTicket({ ...ALICE, admin: true }));
    for (let i = 0; i < CHAT_HISTORY + 2; i++) say(admin, room, `m${i}`);
    const hidden = (admin.sent.at(-1) as { m: { id: string } }).m.id;
    expect(room.hide(hidden)).toBe(true);
    expect(last(admin)).toEqual({ t: 'hide', id: hidden });
    expect(room.hide(hidden)).toBe(false);

    const hello = last(await join()) as Extract<ChatServerEvent, { t: 'hello' }>;
    expect(hello.messages).toHaveLength(CHAT_HISTORY);
    expect(hello.messages.at(-1)!.body).toBe(`m${CHAT_HISTORY}`);

    vi.advanceTimersByTime(CHAT_KEEP_MS + 1);
    say(admin, room, '새 줄');
    const after = last(await join()) as Extract<ChatServerEvent, { t: 'hello' }>;
    expect(after.messages.map((m) => m.body)).toEqual(['새 줄']);
  });

  it('신고·차단 대상은 작성자 프로필과 함께 읽는다(가린 메시지는 없다)', async () => {
    const { room, join } = fakeRoom();
    const bob = await join(room.issueTicket(BOB));
    say(bob, room, '저예요');
    const { id } = (last(bob) as { m: { id: string } }).m;
    expect(room.message(id)).toMatchObject({
      id,
      profileId: 'prf_b',
      nickname: '밥',
      body: '저예요',
    });
    room.hide(id);
    expect(room.message(id)).toBeNull();
  });

  it('정지하면 그 사람의 열린 소켓만 읽기 전용이 된다', async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const { room, join } = fakeRoom();
    const bob = await join(room.issueTicket(BOB));
    const alice = await join(room.issueTicket(ALICE));
    expect(room.revoke('prf_b')).toBe(1);
    expect(last(bob)).toEqual({ t: 'err', code: 'muted' });
    say(bob, room, '안 돼요?');
    expect(last(bob)).toEqual({ t: 'err', code: 'readonly' });
    say(alice, room, '돼요');
    expect(last(alice)).toMatchObject({ t: 'msg' });
  });
});
