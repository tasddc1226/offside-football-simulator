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
  scheduled(controller: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    if (controller.cron === '0 19 * * *') ctx.waitUntil(runDaily(env, controller.scheduledTime));
    else ctx.waitUntil(runNewsPush(env));
  },
};
