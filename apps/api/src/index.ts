import { LIVE_SOCKET_PATH } from '@offside/contracts/polling';
import { app } from './app.js';
import { runDaily } from './cron/daily.js';
import type { Bindings } from './env.js';
import { liveSocket } from './live/socket.js';

export { app };
export { LiveHub } from './live/hub.js';
export default {
  fetch(req: Request, env: Bindings, ctx: ExecutionContext) {
    // T-10-072 홈 라이브 소켓은 Hono 앱(미들웨어) 앞에서 받는다(live/socket.ts).
    if (new URL(req.url).pathname === LIVE_SOCKET_PATH) return liveSocket(req, env);
    return app.fetch(req, env, ctx);
  },
  // T-10-070 매일 정리·백업(wrangler.jsonc triggers.crons).
  scheduled(controller: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(runDaily(env, controller.scheduledTime));
  },
};
