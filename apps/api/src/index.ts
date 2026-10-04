import { CHAT_SOCKET_PATH } from '@offside/contracts/chat';
import { LIVE_SOCKET_PATH } from '@offside/contracts/polling';
import { app } from './app.js';
import { runDaily } from './cron/daily.js';
import type { Bindings } from './env.js';
import { chatSocket } from './chat/socket.js';
import { liveSocket } from './live/socket.js';
import { runNewsPush } from './push/dispatch.js';

export { app };
export { LiveHub } from './live/hub.js';
export { ChatRoom } from './chat/room.js';
export default {
  fetch(req: Request, env: Bindings, ctx: ExecutionContext) {
    // T-10-072 홈 라이브 소켓은 Hono 앱(미들웨어) 앞에서 받는다(live/socket.ts).
    const { pathname } = new URL(req.url);
    if (pathname === LIVE_SOCKET_PATH) return liveSocket(req, env);
    // T-11-015 채팅 소켓도 같은 까닭으로 앞에서 받는다(chat/socket.ts).
    if (pathname === CHAT_SOCKET_PATH) return chatSocket(req, env);
    return app.fetch(req, env, ctx);
  },
  // T-10-070 매일 정리·백업(wrangler.jsonc triggers.crons).
  // T-11-082 끝까지 await한다. waitUntil로 넘기면 핸들러가 끝난 뒤 30초만 더 살아서, DB가 커진 09-30부터 백업이 매일
  // 중간에 끊겼다(실행 기록은 success). 핸들러가 기다리면 cron은 15분까지 돈다.
  async scheduled(controller: ScheduledController, env: Bindings) {
    if (controller.cron === '0 19 * * *') await runDaily(env, controller.scheduledTime);
    else await runNewsPush(env);
  },
};
