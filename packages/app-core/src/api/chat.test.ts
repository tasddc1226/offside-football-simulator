import { CHAT_HISTORY, type ChatMessage } from '@offside/contracts/chat';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyChat, chatSocketUrl, EMPTY_CHAT, openChat, type ChatView } from './chat.js';

const msg = (id: string, author = 'a'): ChatMessage => ({
  id,
  at: 0,
  author,
  nickname: author,
  body: id,
  admin: false,
});

describe('T-11-015 채팅 상태', () => {
  it('들어오면 최근 줄을 받고, 새 줄은 뒤에 붙이고, 가린 줄은 뺀다. 차단한 작성자는 넣지 않는다', () => {
    const skip = (m: ChatMessage) => m.author === 'x';
    let v = applyChat(
      EMPTY_CHAT,
      { t: 'hello', messages: [msg('1'), msg('2', 'x')], online: 3, write: true },
      skip,
    );
    expect(v).toMatchObject({ status: 'open', online: 3, write: true });
    expect(v.messages.map((m) => m.id)).toEqual(['1']);
    v = applyChat(v, { t: 'msg', m: msg('3') }, skip);
    expect(applyChat(v, { t: 'msg', m: msg('4', 'x') }, skip)).toBe(v);
    v = applyChat(v, { t: 'hide', id: '1' }, skip);
    expect(v.messages.map((m) => m.id)).toEqual(['3']);
  });

  it('T-11-180 이전 줄은 앞에 붙이고(겹치거나 차단한 줄 빼고), 다시 붙어도 남긴다', () => {
    const skip = (m: ChatMessage) => m.author === 'x';
    const at = (id: string, t: number, author = 'a') => ({ ...msg(id, author), at: t });
    const full = Array.from({ length: CHAT_HISTORY }, (_, i) => at(`n${i}`, 100 + i));
    let v = applyChat(EMPTY_CHAT, { t: 'hello', messages: full, online: 1, write: false }, skip);
    expect(v.more).toBe(true);
    v = applyChat(
      { ...v, loadingOlder: true },
      { t: 'older', messages: [at('o1', 1), at('o2', 2, 'x'), at('n0', 100)], more: false },
      skip,
    );
    expect(v.messages.slice(0, 2).map((m) => m.id)).toEqual(['o1', 'n0']);
    expect(v).toMatchObject({ more: false, loadingOlder: false });
    v = applyChat(v, { t: 'hello', messages: [at('n9', 109)], online: 1, write: false }, skip);
    expect(v.messages.map((m) => m.id)).toEqual(['o1', ...full.slice(0, 9).map((m) => m.id), 'n9']);
    expect(v.more).toBe(false);
    expect(
      applyChat(EMPTY_CHAT, { t: 'hello', messages: [at('a', 1)], online: 1, write: false }, skip)
        .more,
    ).toBe(false);
  });

  it('정지되면 쓰기를 끄고, 다른 거절은 상태를 바꾸지 않는다', () => {
    const open: ChatView = { ...EMPTY_CHAT, status: 'open', write: true };
    expect(applyChat(open, { t: 'err', code: 'muted' }, () => false).write).toBe(false);
    expect(applyChat(open, { t: 'err', code: 'rate' }, () => false)).toBe(open);
  });

  it('소켓 주소는 API 주소를 ws로 바꾸고 입장권을 붙인다', () => {
    expect(chatSocketUrl(null, 'https://api.example')).toBe('wss://api.example/v1/chat/ws');
    expect(chatSocketUrl('t 1', 'http://localhost:8787')).toBe(
      'ws://localhost:8787/v1/chat/ws?t=t%201',
    );
  });
});

describe('T-11-015 openChat', () => {
  let sockets: FakeWS[];
  class FakeWS {
    onopen: (() => void) | null = null;
    onmessage: ((m: { data: unknown }) => void) | null = null;
    onclose: (() => void) | null = null;
    sent: string[] = [];
    closed = false;
    constructor(readonly url: string) {
      sockets.push(this);
    }
    send(d: string) {
      this.sent.push(d);
    }
    close() {
      this.closed = true;
    }
    emit(e: unknown) {
      this.onmessage?.({ data: JSON.stringify(e) });
    }
  }
  beforeEach(() => {
    sockets = [];
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWS);
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            data: {
              ticket: `tk${sockets.length}`,
              reason: null,
              author: 'me',
              nickname: '나',
              admin: false,
              mutedUntil: null,
              blocked: ['x'],
              reported: ['r'],
            },
          }),
          { status: 200 },
        ),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('입장권으로 붙고, 끊기면 새 입장권으로 다시 붙는다. 닫으면 멈춘다', async () => {
    const views: ChatView[] = [];
    const chat = openChat((v) => views.push(v));
    await vi.waitFor(() => expect(sockets).toHaveLength(1));
    expect(sockets[0]!.url).toContain('?t=tk0');
    expect(chat.send('안녕')).toBe(false); // hello 전
    sockets[0]!.onopen?.();
    sockets[0]!.emit({
      t: 'hello',
      messages: [msg('1'), msg('2', 'x'), msg('r', 'c')],
      online: 1,
      write: true,
    });
    expect(views.at(-1)!.messages.map((m) => m.id)).toEqual(['1']);
    expect(views.at(-1)!.me?.author).toBe('me');
    expect(chat.send('안녕')).toBe(true);
    expect(JSON.parse(sockets[0]!.sent.at(-1)!)).toEqual({ t: 'send', body: '안녕' });

    sockets[0]!.emit({ t: 'msg', m: msg('3', 'b') });
    chat.drop('3');
    expect(views.at(-1)!.messages.map((m) => m.id)).toEqual(['1']);
    chat.block('a');
    expect(views.at(-1)!.messages).toEqual([]);

    sockets[0]!.onclose?.();
    expect(views.at(-1)!.status).toBe('retrying');
    await vi.advanceTimersByTimeAsync(2_000);
    expect(sockets).toHaveLength(2);
    expect(sockets[1]!.url).toContain('?t=tk1');
    sockets[1]!.emit({
      t: 'hello',
      messages: [msg('1'), msg('3', 'b'), msg('4', 'b')],
      online: 1,
      write: true,
    });
    expect(views.at(-1)!.messages.map((m) => m.id)).toEqual(['4']); // 차단·신고한 줄은 다시 붙어도 빠진다

    chat.close();
    expect(sockets[1]!.closed).toBe(true);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(sockets).toHaveLength(2);
  });
});
