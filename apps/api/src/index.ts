import { app } from './app.js';
import { runDaily } from './cron/daily.js';
import type { Bindings } from './env.js';

export { app };
export default {
  fetch: app.fetch,
  // T-10-070 매일 정리·백업(wrangler.jsonc triggers.crons).
  scheduled(controller: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(runDaily(env, controller.scheduledTime));
  },
};
