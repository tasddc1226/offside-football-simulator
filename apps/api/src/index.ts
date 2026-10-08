import { CHAT_SOCKET_PATH } from '@offside/contracts/chat';
import { LIVE_SOCKET_PATH } from '@offside/contracts/polling';
import { app } from './app.js';
import { runDaily } from './cron/daily.js';
import { runSeasonEventsArchive } from './cron/seasonEventsArchive.js';
import { runSeasonGauge } from './cron/seasonGauge.js';
import { loadSeasonSchedule } from './seasonSchedule.js';
import { runInfraHealth } from './cron/infraHealth.js';
import { createDb } from './db/client.js';
import type { Bindings } from './env.js';
import { chatSocket } from './chat/socket.js';
import { liveSocket } from './live/socket.js';
import { runNewsPush } from './push/dispatch.js';
import { runPersonalPush } from './push/personal.js';
import { queueReengagement } from './push/reengagement.js';
import { runCup } from './team/cup.js';
import { runSeasonClose } from './team/seasonClose.js';

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
    const logged = (job: string) => (e: unknown) =>
      console.error(JSON.stringify({ level: 'error', job, error: String(e).slice(0, 500) }));
    // 시즌 일정(게이지가 확정한 마감·다음 시즌)을 먼저 입힌다 — 아래 결산·보존·게이지가 같은 일정을 본다.
    await loadSeasonSchedule(env.DB, true).catch(logged('season-schedule'));
    if (controller.cron === '0 19 * * *')
      await runDaily(env, controller.scheduledTime).finally(() =>
        runInfraHealth(env, controller.scheduledTime).catch(logged('infra-health')),
      );
    else {
      // 푸시 단계가 실패해도 뒤의 시즌 결산·컵 진행은 돈다(다음 5분에 다시 보낸다).
      await runNewsPush(env).catch(logged('news-push'));
      await queueReengagement(env, controller.scheduledTime).catch(logged('reengagement'));
      await runPersonalPush(env, controller.scheduledTime).catch(logged('personal-push'));
      // 시즌 진행 게이지: 30분마다 세어 굳히고, 90%에 닿으면 마감 시각을 확정해 시즌 일정에
      // 다음 시즌과 함께 적는다. 결산보다 먼저 돈다.
      await runSeasonGauge(env.DB, new Date(controller.scheduledTime).toISOString())
        .then((r) => r && console.log(JSON.stringify({ level: 'info', job: 'season-gauge', ...r })))
        .catch(logged('season-gauge'));
      // T-11-128 끝난 시즌 결산을 한 단계씩 굳힌다. 시간이 급한 알림을 먼저 보내고,
      // 실패하면 다음 5분에 같은 단계를 다시 한다.
      await runSeasonClose(createDb(env.DB), new Date(controller.scheduledTime).toISOString())
        .then((r) => r && console.log(JSON.stringify({ level: 'info', job: 'season-close', ...r })))
        .catch((e: unknown) =>
          console.error(
            JSON.stringify({ level: 'error', job: 'season-close', error: String(e).slice(0, 500) }),
          ),
        );
      // T-11-145 오프사이드 컵: 추첨 → 시각이 된 경기 → 진출·보상. 실패하면 다음 5분에 이어서 한다.
      await runCup(createDb(env.DB), new Date(controller.scheduledTime).toISOString())
        .then((r) => r && console.log(JSON.stringify({ level: 'info', job: 'cup', steps: r })))
        .catch((e: unknown) =>
          console.error(
            JSON.stringify({ level: 'error', job: 'cup', error: String(e).slice(0, 500) }),
          ),
        );
      await runSeasonEventsArchive(env, controller.scheduledTime)
        .then(
          (r) =>
            r && console.log(JSON.stringify({ level: 'info', job: 'season-events-archive', ...r })),
        )
        .catch(logged('season-events-archive'));
      await runInfraHealth(env, controller.scheduledTime).catch(logged('infra-health'));
    }
  },
};
