import { describe, expect, it } from 'vitest';
import { createChatUnread } from './chat-unread.js';

const message = (id: string, at: number, author = 'other') => ({
  id,
  at,
  author,
  nickname: '테스터',
  admin: false,
  body: '테스트',
});

describe('채팅 읽지 않은 메시지', () => {
  it('첫 접속의 과거 대화는 제외하고 새 메시지와 같은 시각의 새 줄을 센다', () => {
    const unread = createChatUnread();
    const old = message('old', 10);
    expect(unread.count([old])).toBe(0);
    const messages = [old, message('same-time', 10), message('new', 20)];
    expect(unread.count(messages)).toBe(2);
    unread.read(messages);
    expect(unread.count(messages)).toBe(0);
  });

  it('내 메시지와 목록에서 가려진 메시지는 알리지 않는다', () => {
    const unread = createChatUnread();
    unread.read([]);
    const own = message('own', 10, 'me');
    const other = message('other', 20);
    expect(unread.count([own, other], 'me')).toBe(1);
    expect(unread.count([own], 'me')).toBe(0);
  });

  it('새로고침과 재연결 후에도 마지막으로 읽은 기록을 유지한다', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    createChatUnread(storage).read([message('read', 10)]);
    const unread = createChatUnread(storage);
    expect(unread.count([message('read', 10), message('new', 20)])).toBe(1);
    unread.read([message('old-history', 5)]);
    expect(unread.count([message('read', 10), message('new', 20)])).toBe(1);
  });

  it('저장소 접근이 실패하거나 기록이 깨져도 동작한다', () => {
    const storage = {
      getItem: () => '{broken',
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const unread = createChatUnread(storage);
    expect(unread.count([])).toBe(0);
    expect(unread.count([message('new', 10)])).toBe(1);
    unread.read([message('new', 10)]);
    expect(unread.count([message('new', 10)])).toBe(0);
  });
});
