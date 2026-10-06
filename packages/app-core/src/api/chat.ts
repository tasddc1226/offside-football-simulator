// T-11-015 실시간 채팅(라운지). 화면을 열면 입장권을 받아(쓸 수 없으면 읽기만) 소켓을 열고, 닫으면 끊는다.
// 끊기면 2초부터 두 배씩 최대 1분까지 기다렸다가 새 입장권으로 다시 붙는다(입장권은 한 번만 쓴다).
// 타입은 type-only import라 번들에 zod가 들어가지 않는다.
import type {
  AdminChatReport,
  AdminChatReportList,
  AdminChatReportResolve,
  ChatBlockResponse,
  ChatMuteInput,
  ChatTicketResponse,
  CommentReportInput,
} from '@offside/contracts';
import {
  CHAT_BODY_MAX,
  type CHAT_MUTE_DAYS,
  CHAT_SOCKET_PATH,
  type ChatClientEvent,
  type ChatMessage,
  type ChatRejectCode,
  type ChatServerEvent,
} from '@offside/contracts/chat';
import { LIVE_PING, LIVE_PING_SEC } from '@offside/contracts/polling';
import { kstParts } from '../boardText.js';
import { chatRejectText } from '../i18n/ko/chatReject.js';
import { apiBaseUrl, apiFetch, withProfile } from './client.js';

export type { AdminChatReport, ChatMessage, ChatRejectCode, ChatTicketResponse };

export const chatTicket = () =>
  withProfile(() =>
    apiFetch<ChatTicketResponse>('/v1/chat/ticket', { method: 'POST', keepCache: true }),
  );
/** 메시지 신고 — 여럿이 신고하면 모두의 화면에서 가려진다. */
export const reportChat = (id: string, input: CommentReportInput) =>
  withProfile(() =>
    apiFetch<undefined>(`/v1/chat/messages/${id}/report`, {
      method: 'POST',
      body: JSON.stringify(input),
      keepCache: true,
    }),
  );
/** 작성자 차단(게시판 댓글 차단과 같은 목록) — 그 사람의 메시지가 내 화면에서 빠진다. */
export const blockChatAuthor = (id: string) =>
  withProfile(() =>
    apiFetch<ChatBlockResponse>(`/v1/chat/messages/${id}/block`, { method: 'POST' }),
  );
export const adminHideChat = (id: string) =>
  apiFetch<undefined>(`/v1/admin/chat/messages/${id}/hide`, { method: 'POST', keepCache: true });
export const adminMuteChat = (id: string, input: ChatMuteInput) =>
  apiFetch<undefined>(`/v1/admin/chat/messages/${id}/mute`, {
    method: 'POST',
    body: JSON.stringify(input),
    keepCache: true,
  });

/** 처리하지 않은 채팅 신고(운영자). */
export const fetchChatReports = () => apiFetch<AdminChatReportList>('/v1/admin/chat/reports');
export const resolveChatReport = (input: AdminChatReportResolve) =>
  apiFetch<undefined>('/v1/admin/chat/reports/resolve', {
    method: 'POST',
    body: JSON.stringify(input),
    keepCache: true,
  });
/** 신고 처리 방법 — 가리기, 기각, 또는 정지 일수. */
export type ChatReportAction = 'hide' | 'dismiss' | (typeof CHAT_MUTE_DAYS)[number];
/** 신고 하나를 처리한다. 성공 여부와 알릴 문구(실패면 오류 문구)를 돌려준다. */
export async function resolveChatReportAs(it: AdminChatReport, action: ChatReportAction) {
  const mute = typeof action === 'number';
  const r = await resolveChatReport(
    mute
      ? { messageId: it.messageId, action: 'mute', days: action }
      : { messageId: it.messageId, action },
  );
  if (!r.ok) return { ok: false, text: r.error.message };
  const text = mute
    ? `${it.nickname}님을 ${action}일 정지했어요`
    : action === 'hide'
      ? '메시지를 가렸어요'
      : '신고를 기각했어요';
  return { ok: true, text };
}

/** 방이 내 줄을 거절한 이유(웹·앱 같은 문구). 읽을 때 지금 언어로 고른다. */
export const CHAT_REJECT_TEXT: Record<ChatRejectCode, string> = {
  get readonly() {
    return chatRejectText.rejectReadonly;
  },
  get muted() {
    return chatRejectText.rejectMuted;
  },
  get long() {
    return chatRejectText.rejectLong({ max: CHAT_BODY_MAX });
  },
  get filter() {
    return chatRejectText.rejectFilter;
  },
  get rate() {
    return chatRejectText.rejectRate;
  },
};
/** 메시지 옆 시각(KST HH:MM). */
export const chatTime = (at: number) => kstParts(new Date(at).toISOString()).time;
/** 정지 안내 문장. */
export function chatMutedText(until: string | null) {
  const p = until ? kstParts(until) : null;
  return p
    ? chatRejectText.mutedUntil({ until: `${p.day} ${p.time}` })
    : chatRejectText.mutedNotice;
}

export const chatSocketUrl = (ticket: string | null, base = apiBaseUrl()) =>
  `${base.replace(/^http/, 'ws')}${CHAT_SOCKET_PATH}${ticket ? `?t=${encodeURIComponent(ticket)}` : ''}`;

/** 화면에 그리는 채팅 상태. */
export type ChatView = {
  status: 'connecting' | 'open' | 'retrying';
  messages: ChatMessage[];
  online: number;
  write: boolean;
  /** 입장권 응답 — 내 작성자 키·닉네임·운영자 여부·못 쓰는 이유. 받지 못했으면 null. */
  me: ChatTicketResponse | null;
};
export const EMPTY_CHAT: ChatView = {
  status: 'connecting',
  messages: [],
  online: 0,
  write: false,
  me: null,
};
/** 화면에 들고 있는 최대 줄 수(오래된 줄부터 버린다). */
const KEEP = 200;

/** 서버 이벤트 하나를 반영한 새 상태. skip이 참인 줄(차단한 작성자·내가 신고한 줄)은 넣지 않는다. */
export function applyChat(
  view: ChatView,
  e: ChatServerEvent,
  skip: (m: ChatMessage) => boolean,
): ChatView {
  switch (e.t) {
    case 'hello':
      return {
        ...view,
        status: 'open',
        messages: e.messages.filter((m) => !skip(m)),
        online: e.online,
        write: e.write,
      };
    case 'msg':
      return skip(e.m) ? view : { ...view, messages: [...view.messages, e.m].slice(-KEEP) };
    case 'online':
      return { ...view, online: e.n };
    case 'hide':
      return { ...view, messages: view.messages.filter((m) => m.id !== e.id) };
    case 'err':
      return e.code === 'muted' ? { ...view, write: false } : view;
  }
}

// app-core는 DOM 타입 없이 빌드한다 — liveSocket.ts와 같은 최소 소켓 모양.
interface Sock {
  onopen: (() => void) | null;
  onmessage: ((m: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  send(data: string): void;
  close(): void;
}
const g = globalThis as { WebSocket?: new (url: string) => Sock };

const RETRY_MIN_MS = 2_000;
const RETRY_MAX_MS = 60_000;

export type ChatSession = {
  /** 한 줄 보낸다. 소켓이 열려 있지 않으면 false. */
  send(body: string): boolean;
  /** 차단한 작성자의 줄을 지금 화면에서 빼고, 앞으로 오는 줄도 뺀다. */
  block(author: string): void;
  /** 내가 신고한 줄을 화면에서 뺀다(다시 붙어도 빠진다). */
  drop(id: string): void;
  close(): void;
};

/**
 * 채팅방에 붙는다. 상태가 바뀔 때마다 onChange, 내 줄이 거절되면 onReject를 부른다. restore는 거절된 줄 —
 * 고쳐 다시 보낼 수 있을 때만(정지·읽기 전용이 아니면) 준다.
 */
export function openChat(
  onChange: (v: ChatView) => void,
  onReject: (code: ChatRejectCode, restore: string | null) => void = () => {},
): ChatSession {
  let view = EMPTY_CHAT;
  /** 보냈지만 아직 방에서 돌아오지 않은 줄. */
  let pending = '';
  let blocked = new Set<string>();
  const dropped = new Set<string>();
  const skip = (m: ChatMessage) => blocked.has(m.author) || dropped.has(m.id);
  const refilter = () => set({ ...view, messages: view.messages.filter((m) => !skip(m)) });
  let ws: Sock | null = null;
  let ping: ReturnType<typeof setInterval> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let wait = RETRY_MIN_MS;
  let stopped = false;
  const set = (next: ChatView) => {
    view = next;
    onChange(view);
  };

  const open = async () => {
    const WS = g.WebSocket;
    if (stopped || !WS) return;
    const r = await chatTicket();
    if (stopped) return;
    const me = r.ok ? r.data : null;
    if (me) {
      blocked = new Set([...blocked, ...me.blocked]);
      for (const id of me.reported) dropped.add(id);
    }
    set({ ...view, me, status: view.status === 'open' ? 'retrying' : view.status });
    const sock = new WS(chatSocketUrl(me?.ticket ?? null));
    ws = sock;
    sock.onopen = () => {
      wait = RETRY_MIN_MS;
      ping = setInterval(() => sock.send(LIVE_PING), LIVE_PING_SEC * 1000);
    };
    sock.onmessage = (m) => {
      if (typeof m.data !== 'string' || !m.data.startsWith('{')) return; // pong
      let e: ChatServerEvent;
      try {
        e = JSON.parse(m.data) as ChatServerEvent;
      } catch {
        return;
      }
      if (e.t === 'msg' && e.m.author === view.me?.author) pending = '';
      set(applyChat(view, e, skip));
      if (e.t === 'err') {
        onReject(e.code, pending && e.code !== 'muted' && e.code !== 'readonly' ? pending : null);
        pending = '';
      }
    };
    sock.onclose = () => {
      clearInterval(ping);
      ws = null;
      if (stopped) return;
      set({ ...view, status: 'retrying' });
      retry = setTimeout(() => void open(), wait);
      wait = Math.min(wait * 2, RETRY_MAX_MS);
    };
  };

  void open();
  return {
    send(body) {
      if (!ws || view.status !== 'open') return false;
      ws.send(JSON.stringify({ t: 'send', body } satisfies ChatClientEvent));
      pending = body;
      return true;
    },
    block(author) {
      blocked = new Set([...blocked, author]);
      refilter();
    },
    drop(id) {
      dropped.add(id);
      refilter();
    },
    close() {
      stopped = true;
      clearInterval(ping);
      clearTimeout(retry);
      if (ws) {
        ws.onclose = null;
        ws.close();
        ws = null;
      }
    },
  };
}
