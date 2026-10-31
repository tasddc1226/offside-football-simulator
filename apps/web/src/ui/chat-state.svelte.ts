import {
  EMPTY_CHAT,
  currentChatRoom,
  openChat,
  setChatRoom,
  type ChatRoomKey,
  type ChatSession,
  type ChatView,
  type ChatRejectCode,
} from '@offside/app-core/api/chat';
import { createChatUnread } from '@offside/app-core/chatUnread';
import type { ChatServerEvent } from '@offside/contracts/chat';
import type { FieldClientEvent } from '@offside/contracts/lounge-field';

export const chatState = $state<{ view: ChatView; unread: number; room: ChatRoomKey }>({
  view: EMPTY_CHAT,
  unread: 0,
  room: 'ko',
});
let tracker: ReturnType<typeof createChatUnread> | null = null;
let session: ChatSession | null = null;
const listeners = new Set<(view: ChatView) => void>();
const rejectListeners = new Set<(code: ChatRejectCode, restore: string | null) => void>();
/** T-11-600 라운지 필드 화면이 열려 있을 때 받은 이벤트를 먼저 본다(필드 이벤트면 true). */
let fieldHook: ((e: ChatServerEvent) => boolean) | null = null;

function unreadTracker() {
  if (!tracker) {
    let storage: Storage | undefined;
    try {
      storage = localStorage;
    } catch {
      /* 저장소 없이도 알림을 보여 준다. */
    }
    tracker = createChatUnread(storage, chatState.room);
  }
  return tracker;
}

export function markChatRead() {
  if (document.visibilityState !== 'visible' || chatState.view.status !== 'open') return;
  unreadTracker().read(chatState.view.messages);
  chatState.unread = 0;
}

export function chatSession() {
  if (!session) {
    // T-11-583 새로 붙을 때마다 방을 다시 고른다(화면 언어를 바꿨으면 그 언어 방).
    const room = currentChatRoom();
    if (room !== chatState.room) tracker = null;
    chatState.room = room;
  }
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
    chatState.room,
    (e) => fieldHook?.(e) ?? false,
  );
  return session;
}

/** T-11-583 다른 언어 방으로 옮긴다 — 지금 소켓을 닫고 그 방에 새로 붙는다. */
export function switchChatRoom(room: ChatRoomKey) {
  if (room === chatState.room && session) return;
  setChatRoom(room);
  refreshChatIdentity();
  chatSession();
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

/** T-11-504 탭을 잠깐 숨겼다 돌아와도 바로 끊지 않는다. 다시 붙을 때마다 입장권을 새로 받기 때문이다. */
export const CHAT_HIDDEN_GRACE_MS = 60_000;

/** 홈 알림과 채팅 화면은 소켓 하나를 공유한다. 숨긴 지 1분이 지난 탭은 연결을 유지하지 않는다. */
export function startChatNotifications() {
  let closing: ReturnType<typeof setTimeout> | undefined;
  const close = () => {
    clearTimeout(closing);
    closing = undefined;
    session?.close();
    session = null;
  };
  const visibility = () => {
    if (document.visibilityState === 'visible') {
      clearTimeout(closing);
      closing = undefined;
      chatSession();
    } else if (session && !closing) closing = setTimeout(close, CHAT_HIDDEN_GRACE_MS);
  };
  visibility();
  document.addEventListener('visibilitychange', visibility);
  return () => {
    document.removeEventListener('visibilitychange', visibility);
    close();
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

/** T-11-600 라운지 필드 화면이 받은 이벤트를 먼저 보게 한다(닫을 때 null). */
export function hookField(h: ((e: ChatServerEvent) => boolean) | null) {
  fieldHook = h;
}

/** T-11-600 라운지 필드 이벤트를 보낸다. 소켓이 열려 있지 않으면 false. */
export const sendField = (e: FieldClientEvent) => session?.field(e) ?? false;
