import {
  EMPTY_CHAT,
  openChat,
  type ChatSession,
  type ChatView,
  type ChatRejectCode,
} from '@offside/app-core/api/chat';
import { createChatUnread } from './chat-unread.js';

export const chatState = $state<{ view: ChatView; unread: number }>({
  view: EMPTY_CHAT,
  unread: 0,
});
let tracker: ReturnType<typeof createChatUnread> | null = null;
let session: ChatSession | null = null;
const listeners = new Set<(view: ChatView) => void>();
const rejectListeners = new Set<(code: ChatRejectCode, restore: string | null) => void>();

function unreadTracker() {
  if (!tracker) {
    let storage: Storage | undefined;
    try {
      storage = localStorage;
    } catch {
      /* 저장소 없이도 알림을 보여 준다. */
    }
    tracker = createChatUnread(storage);
  }
  return tracker;
}

export function markChatRead() {
  if (document.visibilityState !== 'visible' || chatState.view.status !== 'open') return;
  unreadTracker().read(chatState.view.messages);
  chatState.unread = 0;
}

export function chatSession() {
  session ??= openChat(
    (view) => {
      chatState.view = view;
      if (view.status === 'open')
        chatState.unread = unreadTracker().count(view.messages, view.me?.author ?? undefined);
      for (const listener of listeners) listener(view);
    },
    (code, restore) => {
      for (const listener of rejectListeners) listener(code, restore);
    },
  );
  return session;
}

/** 계정·닉네임 쓰기가 끝나면 이전 권한의 소켓을 닫고 새 티켓을 받는다. */
export function refreshChatIdentity() {
  const connected = !!session;
  session?.close();
  session = null;
  chatState.view = EMPTY_CHAT;
  chatState.unread = 0;
  for (const listener of listeners) listener(EMPTY_CHAT);
  if (connected && document.visibilityState === 'visible') chatSession();
}

/** 홈 알림과 채팅 화면은 소켓 하나를 공유한다. 숨겨진 탭은 연결을 유지하지 않는다. */
export function startChatNotifications() {
  const visibility = () => {
    if (document.visibilityState === 'visible') chatSession();
    else {
      session?.close();
      session = null;
    }
  };
  visibility();
  document.addEventListener('visibilitychange', visibility);
  return () => {
    document.removeEventListener('visibilitychange', visibility);
    session?.close();
    session = null;
  };
}

export function listenChat(
  change: (view: ChatView) => void,
  reject: (code: ChatRejectCode, restore: string | null) => void,
) {
  listeners.add(change);
  rejectListeners.add(reject);
  change(chatState.view);
  return () => {
    listeners.delete(change);
    rejectListeners.delete(reject);
  };
}
