/**
 * T-11-015 실시간 채팅 한도·메시지 모양. zod가 없는 서브패스(`@offside/contracts/chat`)라 웹·앱 번들과 서버의
 * Durable Object가 같은 값을 쓴다. 방은 지금 라운지 하나다.
 */
import type { OwnerTier } from './owner-tier.js';
export const CHAT_SOCKET_PATH = '/v1/chat/ws';
export const CHAT_ROOM = 'lounge';
/** 메시지 한 줄 최대 길이(자). */
export const CHAT_BODY_MAX = 200;
/** 들어오면 받는 최근 메시지 수. */
export const CHAT_HISTORY = 50;
/** 방이 들고 있는 기간. 지난 메시지는 지운다(신고된 메시지는 D1 chat_reports에 사본이 남는다). */
export const CHAT_KEEP_MS = 7 * 24 * 60 * 60 * 1000;
/** 도배 방지 — 한 줄 쓰고 GAP_MS는 쉬고, WINDOW_MS 동안 BURST줄까지. 운영자는 제한이 없다. */
export const CHAT_GAP_MS = 1_500;
export const CHAT_WINDOW_MS = 10_000;
export const CHAT_BURST = 5;
/** 서로 다른 사람의 신고가 이만큼 쌓이면 메시지를 가린다. */
export const CHAT_REPORT_HIDE = 3;
/** 입장권 수명 — 발급받고 바로 소켓을 연다. */
export const CHAT_TICKET_MS = 60_000;
/** 운영자가 고르는 채팅 정지 기간(일). */
export const CHAT_MUTE_DAYS = [1, 7, 30] as const;

/** 방이 보내는 메시지 한 줄. author는 작성자를 가리키는 불투명한 키다(프로필 id는 내보내지 않는다). */
export type ChatMessage = {
  id: string;
  /** epoch ms. */
  at: number;
  author: string;
  nickname: string;
  body: string;
  admin: boolean;
  /** T-11-128 보낸 사람의 지난 시즌 구단주 티어(보낸 때 기준). 옛 메시지엔 없다. */
  tier?: OwnerTier | null;
  /** T-11-150 보낸 사람의 대표 칭호(owner-title.ts id, 보낸 때 기준). 옛 메시지엔 없다. */
  title?: string | null;
  avatarId?: string | null;
};

/** 쓰기를 거절한 이유(보낸 사람에게만 간다). */
export type ChatRejectCode = 'readonly' | 'muted' | 'long' | 'filter' | 'rate';

/** 서버 → 클라이언트. */
export type ChatServerEvent =
  /** more(T-11-180): 이보다 이전 줄이 더 있다. 옛 방엔 없다. */
  | { t: 'hello'; messages: ChatMessage[]; online: number; write: boolean; more?: boolean }
  | { t: 'msg'; m: ChatMessage }
  | { t: 'avatar'; author: string; avatarId: string | null }
  | { t: 'hide'; id: string }
  /** 접속자 수가 바뀌었다(누가 들어오거나 나갔다). */
  | { t: 'online'; n: number }
  | { t: 'err'; code: ChatRejectCode }
  /** T-11-180 'older' 요청의 답(그 소켓에만) — before보다 이전 줄을 오래된 순으로. more가 거짓이면 더 없다. */
  | { t: 'older'; messages: ChatMessage[]; more: boolean };

/** 클라이언트 → 서버(핑은 LIVE_PING 문자열 그대로). */
export type ChatClientEvent =
  | { t: 'send'; body: string }
  /** T-11-180 위로 올리면 before(메시지 id)보다 이전 줄을 CHAT_HISTORY개씩 부른다. 옛 방은 무시한다. */
  | { t: 'older'; before: string };

/** 입장권을 못 받는 이유 — login: 계정 로그인 전, nickname: 닉네임을 아직 안 정함, muted: 채팅 정지 중. */
export const CHAT_DENY_REASONS = ['login', 'nickname', 'muted'] as const;
