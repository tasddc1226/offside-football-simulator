// T-11-440 홈 채팅 버튼의 안 읽음 수(웹 chat-state.svelte.ts와 같은 방식). 폴링하지 않고 채팅 소켓 하나에 붙어 센다.
// 웹처럼 앱이 앞에 있을 때만 붙고, 채팅 화면에 있는 동안은 그 화면이 자기 소켓을 열므로 이쪽은 닫아 둔다.
// 읽음 기록은 웹과 같은 키(ft_chat_read)로 이 기기에만 둔다.
import { AppState } from 'react-native';
import { proxy } from 'valtio';
import { subscribeKey } from 'valtio/utils';
import { openChat, type ChatMessage, type ChatSession } from '@offside/app-core/api/chat';
import { createChatUnread } from '@offside/app-core/chatUnread';
import { appState } from '../store';
import { kv } from './setup';

export const chatUnread = proxy({ n: 0 });

let tracker: ReturnType<typeof createChatUnread> | null = null;
function unreadTracker() {
  tracker ??= createChatUnread({
    getItem: (k) => kv.getString(k) ?? null,
    setItem: (k, v) => kv.set(k, v),
  });
  return tracker;
}

let session: ChatSession | null = null;
let closing: ReturnType<typeof setTimeout> | undefined;
/** T-11-504 앱이 잠깐 뒤로 가도(제어 센터 · 알림 · 다른 앱 잠깐) 바로 끊지 않는다. 다시 붙을 때마다 입장권을 새로 받기 때문이다. */
export const CHAT_BACKGROUND_GRACE_MS = 60_000;

/** 소켓을 열어 둘지: 앱이 앞에 있고 채팅 화면이 아닐 때만. */
export function wantChatSocket(state: string, screen: string): boolean {
  return state === 'active' && screen !== 'chat';
}

function close() {
  clearTimeout(closing);
  closing = undefined;
  session?.close();
  session = null;
}

function sync() {
  const want = wantChatSocket(AppState.currentState, appState.screen);
  if (want) {
    clearTimeout(closing);
    closing = undefined;
    session ??= openChat((view) => {
      if (view.status === 'open')
        chatUnread.n = unreadTracker().count(view.messages, view.me?.author ?? undefined);
    });
  } else if (appState.screen === 'chat')
    close(); // 채팅 화면이 자기 소켓을 연다.
  else if (session && !closing) closing = setTimeout(close, CHAT_BACKGROUND_GRACE_MS);
}

/** 채팅 화면에서 본 줄을 읽음으로 남긴다. */
export function markChatRead(messages: readonly ChatMessage[]) {
  unreadTracker().read(messages);
  chatUnread.n = 0;
}

let started = false;
/** 앱을 켤 때 한 번 부른다. */
export function startChatUnread() {
  if (started) return;
  started = true;
  sync();
  AppState.addEventListener('change', sync);
  subscribeKey(appState, 'screen', sync);
}
