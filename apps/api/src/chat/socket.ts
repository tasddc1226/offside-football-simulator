import { CHAT_ROOMS, chatRoomName, isChatRoom, type ChatRoomKey } from '@offside/contracts/chat';
import type { Bindings } from '../env.js';
import { refuseUpgrade } from '../live/socket.js';

/** T-11-583 `?room=`(언어 방). 없거나 모르는 값이면 한국어 방이다. */
export const chatRoomKey = (v: string | null | undefined): ChatRoomKey =>
  isChatRoom(v) ? v : 'ko';

/** T-11-015 `GET CHAT_SOCKET_PATH` — 라이브 소켓과 같은 입구 규칙으로 채팅방에 넘긴다(입장권 `?t=`은 방이 본다). */
export function chatSocket(req: Request, env: Bindings): Response | Promise<Response> {
  const refused = refuseUpgrade(req, env);
  if (refused) return refused;
  if (!env.CHAT) return new Response(null, { status: 503 });
  return chatRoom(env.CHAT, chatRoomKey(new URL(req.url).searchParams.get('room'))).fetch(req);
}

export const chatRoom = (ns: NonNullable<Bindings['CHAT']>, room: ChatRoomKey = 'ko') =>
  ns.get(ns.idFromName(chatRoomName(room)));
/** T-11-583 언어 방 모두(정지 · 아바타처럼 사람 단위로 모든 방에 알릴 때). */
export const chatRooms = (ns: NonNullable<Bindings['CHAT']>) =>
  CHAT_ROOMS.map((r) => chatRoom(ns, r));
