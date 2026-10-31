import type { FieldServerEvent } from '@offside/contracts/lounge-field';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeRoom, type FakeSocket } from '../test/chatRoom.js';
import type { ChatWriter } from './room.js';

const ALICE: ChatWriter = { profileId: 'prf_a', author: 'aaaa', nickname: '앨리스', admin: false };
const BOB: ChatWriter = { profileId: 'prf_b', author: 'bbbb', nickname: '밥', admin: false };
type Room = ReturnType<typeof fakeRoom>['room'];
const emit = (room: Room, ws: FakeSocket, e: object) =>
  room.webSocketMessage(ws as unknown as WebSocket, JSON.stringify(e));
const fieldEvents = (ws: FakeSocket) =>
  (ws.sent as { t: string }[]).filter((e) =>
    ['field', 'pos', 'act', 'ball', 'goal', 'leave'].includes(e.t),
  ) as FieldServerEvent[];

describe('T-11-600 라운지 필드 동기화', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('필드를 연 소켓끼리만 위치를 주고받고, 새로 연 사람은 지금 위치를 받는다', async () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 9, 31, 3) });
    const { room, join } = fakeRoom();
    const alice = await join(room.issueTicket(ALICE));
    const bob = await join(room.issueTicket(BOB));
    const chatOnly = await join();
    emit(room, alice, { t: 'field', on: true });
    expect(fieldEvents(alice)).toEqual([{ t: 'field', peers: [], score: [], day: '2026-10-31' }]);
    emit(room, alice, { t: 'pos', x: 10, y: 5, fx: 1, fy: 0 });
    // 필드를 열지 않은 소켓은 받지 않는다.
    expect(fieldEvents(bob)).toEqual([]);
    expect(fieldEvents(chatOnly)).toEqual([]);
    emit(room, bob, { t: 'field', on: true });
    expect(fieldEvents(bob).at(-1)).toEqual({
      t: 'field',
      peers: [{ a: 'aaaa', n: '앨리스', x: 10, y: 5, fx: 1, fy: 0 }],
      score: [],
      day: '2026-10-31',
    });
    vi.advanceTimersByTime(100);
    emit(room, alice, { t: 'pos', x: 11, y: 5, fx: 1, fy: 0 });
    expect(fieldEvents(bob).at(-1)).toEqual({
      t: 'pos',
      a: 'aaaa',
      n: '앨리스',
      x: 11,
      y: 5,
      fx: 1,
      fy: 0,
    });
    // 너무 잦은 위치는 버리고, 범위를 넘는 값은 잘라 낸다.
    emit(room, alice, { t: 'pos', x: 12, y: 5, fx: 1, fy: 0 });
    expect(fieldEvents(bob).at(-1)).toMatchObject({ x: 11 });
    vi.advanceTimersByTime(100);
    emit(room, alice, { t: 'pos', x: 999, y: 5, fx: 1, fy: 0 });
    expect(fieldEvents(bob).at(-1)).toMatchObject({ x: 42 });
    // 내가 보낸 건 나에게 돌아오지 않는다.
    expect(fieldEvents(alice).filter((e) => e.t === 'pos')).toEqual([]);
    // 닫으면 남은 사람에게 알린다.
    emit(room, alice, { t: 'field', on: false });
    expect(fieldEvents(bob).at(-1)).toEqual({ t: 'leave', a: 'aaaa' });
  });

  it('읽기 전용 소켓은 필드를 볼 수만 있고 이벤트를 보내지 못한다', async () => {
    const { room, join } = fakeRoom();
    const alice = await join(room.issueTicket(ALICE));
    const reader = await join();
    emit(room, alice, { t: 'field', on: true });
    emit(room, reader, { t: 'field', on: true });
    emit(room, reader, { t: 'pos', x: 1, y: 1, fx: 1, fy: 0 });
    emit(room, reader, { t: 'act', k: 'tackle' });
    expect(fieldEvents(alice).filter((e) => e.t !== 'field')).toEqual([]);
    emit(room, alice, { t: 'act', k: 'emote', e: 'heart' });
    expect(fieldEvents(reader).at(-1)).toEqual({ t: 'act', a: 'aaaa', k: 'emote', e: 'heart' });
    // 모르는 동작 · 이모트는 버린다.
    emit(room, alice, { t: 'act', k: 'teleport' });
    emit(room, alice, { t: 'act', k: 'emote', e: 'nope' });
    expect(fieldEvents(reader).at(-1)).toEqual({ t: 'act', a: 'aaaa', k: 'emote', e: 'heart' });
  });

  it('골은 최근에 공을 건드린 사람만 넣고, 하루 득점을 방이 세서 모두에게 알린다', async () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 9, 31, 14, 59) }); // 23:59 KST
    const { room, join } = fakeRoom();
    const alice = await join(room.issueTicket(ALICE));
    const bob = await join(room.issueTicket(BOB));
    emit(room, alice, { t: 'field', on: true });
    emit(room, bob, { t: 'field', on: true });
    // 공을 건드리지 않았으면 골이 아니다.
    emit(room, bob, { t: 'goal', side: 0 });
    expect(fieldEvents(alice).some((e) => e.t === 'goal')).toBe(false);
    emit(room, alice, { t: 'act', k: 'kick' });
    emit(room, alice, { t: 'goal', side: 1 });
    const goal = fieldEvents(bob).at(-1);
    expect(goal).toEqual({
      t: 'goal',
      a: 'aaaa',
      n: '앨리스',
      side: 1,
      score: [{ a: 'aaaa', n: '앨리스', goals: 1 }],
      day: '2026-10-31',
    });
    expect(fieldEvents(alice).at(-1)).toEqual(goal);
    // 축하가 끝나기 전 골은 세지 않는다.
    emit(room, alice, { t: 'goal', side: 1 });
    expect(fieldEvents(bob).filter((e) => e.t === 'goal')).toHaveLength(1);
    // 밥이 공을 몰고(ball) 골, 같은 골 수면 먼저 넣은 앨리스가 위.
    vi.advanceTimersByTime(3_000);
    emit(room, bob, { t: 'ball', x: 1, y: 12, z: 0, vx: -9, vy: 0, vz: 0 });
    emit(room, bob, { t: 'goal', side: 0 });
    expect(fieldEvents(alice).at(-1)).toMatchObject({
      score: [
        { a: 'aaaa', goals: 1 },
        { a: 'bbbb', goals: 1 },
      ],
    });
    // 공을 건드린 지 오래면 골이 아니다.
    vi.advanceTimersByTime(7_000);
    emit(room, bob, { t: 'goal', side: 0 });
    expect(fieldEvents(alice).filter((e) => e.t === 'goal')).toHaveLength(2);
    // KST 자정이 지나면 새 날짜로 센다.
    vi.advanceTimersByTime(60_000);
    emit(room, bob, { t: 'ball', x: 1, y: 12, z: 0, vx: -9, vy: 0, vz: 0 });
    emit(room, bob, { t: 'goal', side: 0 });
    expect(fieldEvents(alice).at(-1)).toMatchObject({
      day: '2026-11-01',
      score: [{ a: 'bbbb', goals: 1 }],
    });
    // 새로 연 사람도 오늘 득점을 받는다.
    const carol = await join();
    emit(room, carol, { t: 'field', on: true });
    expect(fieldEvents(carol).at(-1)).toMatchObject({ score: [{ a: 'bbbb', goals: 1 }] });
  });

  it('필드를 연 채로 나가면 남은 사람에게 알린다', async () => {
    const { room, join } = fakeRoom();
    const alice = await join(room.issueTicket(ALICE));
    const bob = await join(room.issueTicket(BOB));
    emit(room, alice, { t: 'field', on: true });
    emit(room, bob, { t: 'field', on: true });
    room.webSocketClose(alice as unknown as WebSocket, 1000);
    expect(fieldEvents(bob).at(-1)).toEqual({ t: 'leave', a: 'aaaa' });
  });

  it('새로 필드를 연 사람은 마지막 공 상태를 받고, 골이 나면 공은 가운데에서 다시 시작한다', async () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 9, 31, 3) });
    const { room, join } = fakeRoom();
    const alice = await join(room.issueTicket(ALICE));
    const bob = await join(room.issueTicket(BOB));
    emit(room, alice, { t: 'field', on: true });
    emit(room, alice, { t: 'ball', x: 30, y: 12, z: 0, vx: 4, vy: 0, vz: 0 });
    emit(room, bob, { t: 'field', on: true });
    expect(fieldEvents(bob).at(-1)).toMatchObject({
      t: 'field',
      ball: { a: 'aaaa', x: 30, y: 12, z: 0, vx: 4, vy: 0, vz: 0 },
    });
    emit(room, alice, { t: 'goal', side: 1 });
    emit(room, bob, { t: 'field', on: false });
    emit(room, bob, { t: 'field', on: true });
    expect(fieldEvents(bob).at(-1)).not.toHaveProperty('ball');
  });
});
