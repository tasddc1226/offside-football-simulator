import type { Bindings } from '../env.js';
import { allowedOriginsFor } from '../middleware/originGuard.js';
import { HUB } from './hub.js';

/**
 * T-10-072 `GET LIVE_SOCKET_PATH` — WebSocket 업그레이드를 허브로 넘긴다. Hono 앱(로그·CORS 미들웨어) 앞에서
 * 받는다: 101 응답은 헤더를 고칠 수 없고, 연결 하나를 요청 로그 한 줄로 남길 이유도 없다. 우리 웹이 아닌
 * 페이지는 상태 변경 요청과 같은 Origin 규칙(originGuard)으로 막는다.
 */
export function liveSocket(req: Request, env: Bindings): Response | Promise<Response> {
  if (req.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    return new Response(null, { status: 426, headers: { Upgrade: 'websocket' } });
  }
  const origin = req.headers.get('Origin');
  if (!origin || !allowedOriginsFor(req.url, env).includes(origin))
    return new Response(null, { status: 403 });
  if (!env.LIVE) return new Response(null, { status: 503 });
  return env.LIVE.get(env.LIVE.idFromName(HUB)).fetch(req);
}
