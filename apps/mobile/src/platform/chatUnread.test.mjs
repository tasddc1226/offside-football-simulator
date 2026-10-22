/* global vi, beforeEach, describe, it, expect */
// T-11-440 앱 홈 채팅 버튼 안 읽음 — 웹과 같은 소켓 하나로 세고, 폴링하지 않는다.
const f = vi.hoisted(() => ({
  appState: 'active',
  appListeners: [],
  keyListeners: [],
  store: { screen: 'home' },
  values: new Map(),
  opened: [],
}));
vi.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return f.appState;
    },
    addEventListener: (_e, fn) => {
      f.appListeners.push(fn);
      return { remove() {} };
    },
  },
}));
vi.mock('valtio', () => ({ proxy: (state) => state }));
vi.mock('valtio/utils', () => ({
  subscribeKey: (_obj, _key, fn) => {
    f.keyListeners.push(fn);
    return () => {};
  },
}));
vi.mock('../store', () => ({ appState: f.store }));
vi.mock('./setup', () => ({
  kv: {
    getString: (k) => f.values.get(k),
    set: (k, v) => f.values.set(k, v),
  },
}));
vi.mock('@offside/app-core/api/chat', () => ({
  openChat: (onChange) => {
    const s = { onChange, closed: false, close: () => (s.closed = true) };
    f.opened.push(s);
    return s;
  },
}));

const msg = (id, at, author = 'other') => ({
  id,
  at,
  author,
  nickname: 'n',
  admin: false,
  body: 'b',
});

beforeEach(() => {
  vi.resetModules();
  f.appState = 'active';
  f.appListeners.length = 0;
  f.keyListeners.length = 0;
  f.store.screen = 'home';
  f.values.clear();
  f.opened.length = 0;
});

describe('app chat unread', () => {
  it('keeps one socket while the app is active and off the chat screen', async () => {
    const m = await import('./chatUnread.ts');
    expect(m.wantChatSocket('active', 'home')).toBe(true);
    expect(m.wantChatSocket('active', 'chat')).toBe(false);
    expect(m.wantChatSocket('background', 'home')).toBe(false);
    m.startChatUnread();
    m.startChatUnread();
    expect(f.opened).toHaveLength(1);
    // 채팅 화면으로 가면 닫고(그 화면이 자기 소켓을 연다), 돌아오면 다시 붙는다.
    f.store.screen = 'chat';
    f.keyListeners.forEach((fn) => fn());
    expect(f.opened[0].closed).toBe(true);
    f.store.screen = 'home';
    f.keyListeners.forEach((fn) => fn());
    expect(f.opened).toHaveLength(2);
    // 다른 화면끼리 옮겨 다닐 때는 다시 붙지 않는다.
    f.store.screen = 'owner';
    f.keyListeners.forEach((fn) => fn());
    expect(f.opened).toHaveLength(2);
    // 백그라운드로 가면 닫는다.
    f.appState = 'background';
    f.appListeners.forEach((fn) => fn('background'));
    expect(f.opened[1].closed).toBe(true);
  });

  it('counts new messages from others after the first visit and clears when read', async () => {
    const m = await import('./chatUnread.ts');
    m.startChatUnread();
    const s = f.opened[0];
    const me = { author: 'me' };
    s.onChange({ status: 'open', me, messages: [msg('old', 1)] });
    expect(m.chatUnread.n).toBe(0);
    const next = [msg('old', 1), msg('mine', 2, 'me'), msg('new', 3)];
    s.onChange({ status: 'open', me, messages: next });
    expect(m.chatUnread.n).toBe(1);
    m.markChatRead(next);
    expect(m.chatUnread.n).toBe(0);
    expect(JSON.parse(f.values.get('ft_chat_read'))).toMatchObject({ at: 3 });
  });
});
