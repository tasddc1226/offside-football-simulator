import type { Bindings } from '../env.js';
import { allowedOriginsFor } from '../middleware/originGuard.js';
import { HUB } from './hub.js';

/**
 * T-10-072 `GET LIVE_SOCKET_PATH` — WebSocket 업그레이드를 허브로 넘긴다. Hono 앱(로그·CORS 미들웨어) 앞에서
 * 받는다: 101 응답은 헤더를 고칠 수 없고, 연결 하나를 요청 로그 한 줄로 남길 이유도 없다. 우리 웹이 아닌
 * 페이지는 상태 변경 요청과 같은 Origin 규칙(originGuard)으로 막는다. 네이티브 앱(T-11-003)은 Origin을 안 보내거나
 * API 자기 주소를 Origin으로 보낸다(React Native iOS) — 브라우저 페이지가 아니므로 받는다.
 */
export function liveSocket(req: Request, env: Bindings): Response | Promise<Response> {
  const refused = refuseUpgrade(req, env);
  if (refused) return refused;
  if (!env.LIVE) return new Response(null, { status: 503 });
  return env.LIVE.get(env.LIVE.idFromName(HUB)).fetch(req);
}

/** 소켓 입구 공통 검사(라이브·채팅). 받을 수 없으면 그 응답을, 받을 수 있으면 null을 돌려준다. */
export function refuseUpgrade(req: Request, env: Bindings): Response | null {
  if (req.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    return new Response(null, { status: 426, headers: { Upgrade: 'websocket' } });
  }
  const origin = req.headers.get('Origin');
  const native = origin === null || origin === new URL(req.url).origin;
  if (!native && !allowedOriginsFor(req.url, env).includes(origin))
    return new Response(null, { status: 403 });
  return null;
}
