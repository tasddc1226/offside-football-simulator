import { CHAT_ROOM } from '@offside/contracts/chat';
import type { Bindings } from '../env.js';
import { refuseUpgrade } from '../live/socket.js';

/** T-11-015 `GET CHAT_SOCKET_PATH` — 라이브 소켓과 같은 입구 규칙으로 채팅방에 넘긴다(입장권 `?t=`은 방이 본다). */
export function chatSocket(req: Request, env: Bindings): Response | Promise<Response> {
  const refused = refuseUpgrade(req, env);
  if (refused) return refused;
  if (!env.CHAT) return new Response(null, { status: 503 });
  return chatRoom(env.CHAT).fetch(req);
}

export const chatRoom = (ns: NonNullable<Bindings['CHAT']>) => ns.get(ns.idFromName(CHAT_ROOM));
