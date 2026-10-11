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

  it('avatar changes refresh stored messages and connected writers without exposing profile IDs', async () => {
    const { room, join } = fakeRoom();
    const alice = await join(room.issueTicket(ALICE));
    const reader = await join();
    say(alice, room, 'first');
    const avatarId = '11111111-1111-4111-8111-111111111111';
    await room.updateAvatar(ALICE.profileId, avatarId);
    expect(last(reader)).toEqual({ t: 'avatar', author: ALICE.author, avatarId });
    const fresh = await join();
    expect(fresh.sent[0]).toMatchObject({ t: 'hello', messages: [{ avatarId }] });
    await room.updateAvatar(ALICE.profileId, null);
    expect(last(reader)).toEqual({ t: 'avatar', author: ALICE.author, avatarId: null });
    expect(JSON.stringify(last(reader))).not.toContain(ALICE.profileId);
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
    expect(reader.sent[0]).toEqual({
      t: 'hello',
      messages: [],
      online: 1,
      write: false,
      more: false,
    });
    const alice = await join(room.issueTicket(ALICE));
    expect(alice.sent[0]).toMatchObject({ t: 'hello', online: 2, write: true });

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

  it('누가 들어오거나 나가면 접속자 수를 모두에게 알린다', async () => {
    const { room, join, sockets } = fakeRoom();
    const a = await join();
    const b = await join();
    expect(last(a)).toEqual({ t: 'online', n: 2 });
    room.webSocketClose(b as unknown as WebSocket, 1000);
    sockets.splice(sockets.indexOf(b), 1);
    expect(last(a)).toEqual({ t: 'online', n: 1 });
  });

  it('입장권은 한 번만, 수명 안에서만 쓴다', async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const { room, join } = fakeRoom();
    const ticket = room.issueTicket(ALICE);
    expect((await join(ticket)).sent[0]).toMatchObject({ write: true });
    expect((await join(ticket)).sent[0]).toMatchObject({ write: false });
    const stale = room.issueTicket(ALICE);
    vi.advanceTimersByTime(CHAT_TICKET_MS + 1);
    expect((await join(stale)).sent[0]).toMatchObject({ write: false });
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

    const hello = (await join()).sent[0] as Extract<ChatServerEvent, { t: 'hello' }>;
    expect(hello.messages).toHaveLength(CHAT_HISTORY);
    expect(hello.messages.at(-1)!.body).toBe(`m${CHAT_HISTORY}`);

    vi.advanceTimersByTime(CHAT_KEEP_MS + 1);
    say(admin, room, '새 줄');
    const after = (await join()).sent[0] as Extract<ChatServerEvent, { t: 'hello' }>;
    expect(after.messages.map((m) => m.body)).toEqual(['새 줄']);
  });

  it('T-11-180 위로 올리면 그 소켓에만 이전 줄을 CHAT_HISTORY개씩 준다(가린 줄 없이)', async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const { room, join } = fakeRoom();
    const admin = await join(room.issueTicket({ ...ALICE, admin: true }));
    for (let i = 0; i < CHAT_HISTORY * 2 + 5; i++) say(admin, room, `m${i}`);
    const hidden = (admin.sent.at(-(CHAT_HISTORY + 3)) as { m: { id: string } }).m.id;
    room.hide(hidden);
    const reader = await join();
    const older = (before: string) => {
      room.webSocketMessage(reader as unknown as WebSocket, JSON.stringify({ t: 'older', before }));
      return last(reader) as Extract<ChatServerEvent, { t: 'older' }>;
    };
    const hello = reader.sent[0] as Extract<ChatServerEvent, { t: 'hello' }>;
    expect(hello.more).toBe(true);
    const page1 = older(hello.messages[0]!.id);
    expect(page1.more).toBe(true);
    expect(page1.messages).toHaveLength(CHAT_HISTORY);
    expect(page1.messages.at(-1)!.body).toBe(`m${CHAT_HISTORY + 4}`);
    expect(page1.messages.some((m) => m.id === hidden)).toBe(false);
    const page2 = older(page1.messages[0]!.id);
    expect(page2.more).toBe(false);
    expect(page2.messages.map((m) => m.body)).toEqual(['m0', 'm1', 'm2', 'm3']);
    expect(older('없는 줄')).toEqual({ t: 'older', messages: [], more: false });
    expect(admin.sent.some((e) => (e as ChatServerEvent).t === 'older')).toBe(false);
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
