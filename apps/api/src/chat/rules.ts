import {
  CHAT_BODY_MAX,
  CHAT_BURST,
  CHAT_GAP_MS,
  CHAT_WINDOW_MS,
  type ChatRejectCode,
} from '@offside/contracts/chat';
import { hasLink, hasProfanity } from '@offside/contracts/content-filter';
import { sha256Hex } from '../db/hash.js';

// T-11-015 채팅 한 줄을 받을지 정하는 순수 규칙(방 Durable Object가 부른다).

export type SendCheck =
  { ok: true; body: string; sent: number[] } | { ok: false; code: ChatRejectCode };

/**
 * 보낸 사람의 최근 전송 시각(sent)과 본문을 보고 받을지 정한다. 받으면 다듬은 본문과 새 전송 기록을 돌려준다.
 * 빈 줄은 null(조용히 버린다). 운영자는 도배 제한과 필터를 거치지 않는다.
 */
export function checkSend(
  raw: unknown,
  sent: number[],
  now: number,
  admin: boolean,
): SendCheck | null {
  if (typeof raw !== 'string') return null;
  const body = raw.replace(/\s+/g, ' ').trim();
  if (!body) return null;
  if (body.length > CHAT_BODY_MAX) return { ok: false, code: 'long' };
  if (admin) return { ok: true, body, sent };
  if (hasLink(body) || hasProfanity(body)) return { ok: false, code: 'filter' };
  const recent = sent.filter((at) => now - at < CHAT_WINDOW_MS);
  if (recent.length >= CHAT_BURST || now - (recent.at(-1) ?? -Infinity) < CHAT_GAP_MS)
    return { ok: false, code: 'rate' };
  return { ok: true, body, sent: [...recent, now] };
}

/** 메시지에 붙이는 작성자 키 — 프로필 id를 내보내지 않고도 내 메시지·차단한 사람을 알아본다. */
export const chatAuthor = async (profileId: string) =>
  (await sha256Hex(`chat:${profileId}`)).slice(0, 16);
