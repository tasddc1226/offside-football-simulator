import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setStorage } from '@offside/game/storage';
import { configureLive, liveSocketUrl, onLive } from './liveSocket.js';
import { LIVE_PING, LIVE_PONG } from '@offside/contracts/polling';

describe('활성 웹·앱 공용 라이브 연결', () => {
  let sockets: FakeWS[];
  let visible: boolean;
  let changed: () => void;
  let stops: (() => void)[];
  class FakeWS {
    onopen: (() => void) | null = null;
    onmessage: ((m: { data: unknown }) => void) | null = null;
    onclose: (() => void) | null = null;
    sent: string[] = [];
    closed = false;
    constructor(readonly url: string) {
      sockets.push(this);
    }
    send(message: string) {
      this.sent.push(message);
    }
    close() {
      this.closed = true;
      this.onclose?.();
    }
  }
  beforeEach(() => {
    vi.useFakeTimers();
    sockets = [];
    visible = true;
    stops = [];
    const values = new Map<string, string>();
    setStorage({
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => {
        values.set(k, v);
      },
    });
    vi.stubGlobal('WebSocket', FakeWS);
    configureLive({
      visible: () => visible,
      watch: (fn) => {
        changed = fn;
        return () => {};
      },
    });
  });
  afterEach(() => {
    stops.forEach((stop) => stop());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const listen = (fn = vi.fn()) => {
    stops.push(onLive(fn));
    return fn;
  };

  it('세션 없이 식별자를 기억하고 여러 구독은 연결 하나를 공유한다', () => {
    const url = liveSocketUrl('https://api.test');
    expect(url).toMatch(/^wss:\/\/api.test\/v1\/live\/ws\?client=[a-f0-9-]{36}$/);
    expect(liveSocketUrl('https://api.test')).toBe(url);
    listen();
    listen();
    expect(sockets).toHaveLength(1);
    stops.pop()!();
    expect(sockets[0]!.closed).toBe(false);
    stops.pop()!();
    expect(sockets[0]!.closed).toBe(true);
  });

  it('백그라운드에서 끊고 복귀하면 같은 기기로 다시 연결한다', () => {
    listen();
    visible = false;
    changed();
    expect(sockets[0]!.closed).toBe(true);
    vi.advanceTimersByTime(300_000);
    expect(sockets).toHaveLength(1);
    visible = true;
    changed();
    expect(sockets).toHaveLength(2);
    expect(sockets[1]!.url).toBe(sockets[0]!.url);
  });

  it('핑 자동 응답을 확인하고 응답 없는 연결은 닫은 뒤 재접속한다', () => {
    const received = listen();
    const ws = sockets[0]!;
    ws.onopen?.();
    vi.advanceTimersByTime(45_000);
    expect(ws.sent).toEqual([LIVE_PING]);
    ws.onmessage?.({ data: LIVE_PONG });
    vi.advanceTimersByTime(45_000);
    expect(ws.closed).toBe(false);
    vi.advanceTimersByTime(45_000);
    expect(ws.closed).toBe(true);
    vi.advanceTimersByTime(5_000);
    expect(sockets).toHaveLength(2);
    expect(received).not.toHaveBeenCalled();
  });

  it('접속 수·시즌·영구결번 메시지를 각 구독에 전달한다', () => {
    const received = listen();
    const p = { type: 'presence', online: 2, at: new Date().toISOString() };
    sockets[0]!.onmessage?.({ data: JSON.stringify(p) });
    expect(received).toHaveBeenCalledWith(p);
  });
});
