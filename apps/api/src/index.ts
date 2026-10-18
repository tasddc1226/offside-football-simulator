import { sweepAutomation } from './db/repos/automationEnforcement.js';
import { CHAT_SOCKET_PATH } from '@offside/contracts/chat';
import { LIVE_SOCKET_PATH } from '@offside/contracts/polling';
import { app } from './app.js';
import { updateClubStrength } from './clubStrength/update.js';
import { runBackupStep } from './cron/backup.js';
import { runSnapshotOffload } from './careerSnapshots.js';
import { runDailyTick } from './cron/dailyRunner.js';
import { runSeasonEventsArchive } from './cron/seasonEventsArchive.js';
import { runSeasonTelemetryArchive } from './cron/seasonTelemetryArchive.js';
import { runSeasonGauge } from './cron/seasonGauge.js';
import { loadSeasonSchedule } from './seasonSchedule.js';
import { runInfraHealth } from './cron/infraHealth.js';
import { createDb } from './db/client.js';
import { runFirstsRescan } from './db/repos/firsts.js';
import type { Bindings } from './env.js';
import { chatSocket } from './chat/socket.js';
import { liveSocket } from './live/socket.js';
import { publishPushWork } from './push/queuePublish.js';
import { consumePushWork } from './push/queue.js';
import { queueReengagement } from './push/reengagement.js';
import { consumeCareerReminders, queueCareerReminders } from './push/careerReminder.js';
import { queueAttendanceReminders } from './push/attendanceReminder.js';
import { queueGiftReminders } from './push/giftReminder.js';
import { consumeCupResults, publishCupResults } from './push/cupResult.js';
import { consumeCommunityPush } from './push/communityQueue.js';
import { runCup } from './team/cup.js';
import { runCupAutopilot } from './team/cupAutopilot.js';
import { purgeEdgeOrigin } from './edgeCache.js';
import { STALE } from './edgeKeys.js';
import { runSeasonClose } from './team/seasonClose.js';
import { logErrorText } from './logError.js';

import { consumeBillingAlerts, recoverBillingAlerts } from './iap/alerts.js';

export { app };
export { LiveHub } from './live/hub.js';
export { ChatRoom } from './chat/room.js';
export default {
  queue(batch: MessageBatch<unknown>, env: Bindings) {
    if (batch.queue === 'offside-push-production') return consumePushWork(batch, env);
    if (batch.queue === 'offside-billing-production') return consumeBillingAlerts(batch, env);
    if (batch.queue === 'offside-cup-push-production') return consumeCupResults(batch, env);
    return batch.queue === 'offside-career-push-production'
      ? consumeCareerReminders(batch, env)
      : consumeCommunityPush(batch, env);
  },
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
      console.error(JSON.stringify({ level: 'error', job, error: logErrorText(e) }));
    // 시즌 일정(게이지가 확정한 마감·다음 시즌)을 먼저 입힌다 — 아래 결산·보존·게이지가 같은 일정을 본다.
    await loadSeasonSchedule(env.DB, true).catch(logged('season-schedule'));
    if (controller.cron === '0 19 * * *') {
      // Bounded daily retention; FK SET NULL removes stale purchase attribution too.
      await env.DB.prepare(
        `DELETE FROM acquisition_sessions WHERE id IN (SELECT id FROM acquisition_sessions WHERE received_at < ? ORDER BY received_at LIMIT 1000)`,
      )
        .bind(new Date(controller.scheduledTime - 90 * 86400_000).toISOString())
        .run()
        .catch(logged('acquisition-retention'));
      let completed = false;
      await runDailyTick(env, controller.scheduledTime)
        .then((daily) => {
          completed = daily?.status === 'complete';
        })
        .finally(() => runInfraHealth(env, Date.now(), completed).catch(logged('infra-health')));
    } else {
      // 푸시 단계가 실패해도 뒤의 시즌 결산·컵 진행은 돈다(다음 5분에 다시 보낸다).
      await recoverBillingAlerts(env, controller.scheduledTime).catch(logged('billing-recovery'));
      await publishPushWork(env, 'news', controller.scheduledTime).catch(
        logged('news-push-publish'),
      );
      if (new Date(controller.scheduledTime).getUTCMinutes() === 0)
        await queueCareerReminders(env, controller.scheduledTime).catch(logged('career-reminder'));
      await queueReengagement(env, controller.scheduledTime).catch(logged('reengagement'));
      await queueAttendanceReminders(env, controller.scheduledTime).catch(
        logged('attendance-reminder'),
      );
      await queueGiftReminders(env, controller.scheduledTime).catch(logged('gift-reminder'));
      await publishPushWork(env, 'personal', controller.scheduledTime).catch(
        logged('personal-push-publish'),
      );
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
            JSON.stringify({ level: 'error', job: 'season-close', error: logErrorText(e) }),
          ),
        );
      // T-11-145 오프사이드 컵: 추첨 → 시각이 된 경기 → 진출·보상. 실패하면 다음 5분에 이어서 한다.
      await runCup(createDb(env.DB), new Date(controller.scheduledTime).toISOString())
        .then(async (r) => {
          if (!r) return;
          console.log(JSON.stringify({ level: 'info', job: 'cup', steps: r }));
          await publishCupResults(
            env,
            r.filter((x) => x.step === 'advance' && x.round === 'f').map((x) => String(x.cup)),
          );
        })
        .catch((e: unknown) =>
          console.error(JSON.stringify({ level: 'error', job: 'cup', error: logErrorText(e) })),
        );
      // T-11-251 다음 회차 만들기 → 접수 시작 알림 → 밀린 단계 슬랙 경보(15분마다).
      await runCupAutopilot(env, controller.scheduledTime).catch(logged('cup-autopilot'));
      // A cron round can commit before a later step fails; purge even on a partial run.
      if (env.PUBLIC_API_ORIGIN)
        await purgeEdgeOrigin(env.PUBLIC_API_ORIGIN, STALE.cupChanged()).catch((e) =>
          console.log(JSON.stringify({ level: 'error', job: 'cup-cache', error: logErrorText(e) })),
        );
      // Daily work has its own durable cursor and precedes bulk backup/archive work.
      const daily = await runDailyTick(env, controller.scheduledTime).catch((e: unknown) => {
        logged('daily-step')(e);
        return { status: 'retry' as const, error: logErrorText(e) };
      });
      // Yield bulk work when the primary is already rejecting maintenance requests.
      if (daily?.status === 'retry' && /overloaded|Network connection lost/.test(daily.error ?? ''))
        return;
      await runSeasonEventsArchive(env, controller.scheduledTime)
        .then(
          (r) =>
            r && console.log(JSON.stringify({ level: 'info', job: 'season-events-archive', ...r })),
        )
        .catch(logged('season-events-archive'));
      await runSeasonTelemetryArchive(env, controller.scheduledTime)
        .then(
          (r) =>
            r &&
            console.log(JSON.stringify({ level: 'info', job: 'season-telemetry-archive', ...r })),
        )
        .catch(logged('season-telemetry-archive'));
      // T-11-274 D1 → R2 백업을 5분마다 한 조각씩. UTC 19:00(KST 04:00) 뒤 첫 틱에 시작해 끝까지 이어받는다.
      // 15분 상한 안에 들게 한 조각은 45초만 읽고, 실패하면 다음 틱이 같은 조각을 다시 만든다.
      // Keep backup reads away from the hourly archive/reminder burst.
      if (env.BACKUP && new Date(controller.scheduledTime).getUTCMinutes() !== 0)
        await runBackupStep(env.DB, env.BACKUP, env.ENVIRONMENT, controller.scheduledTime)
          .then((r) => r && console.log(JSON.stringify({ level: 'info', job: 'backup', ...r })))
          .catch(logged('backup'));
      // T-11-311 이 기능 전에 은퇴한 기록의 상세 스냅샷을 D1에서 R2로 조금씩 옮긴다(다 옮기면 멈춘다).
      await runSnapshotOffload(env)
        .then(
          (r) => r && console.log(JSON.stringify({ level: 'info', job: 'snapshot-offload', ...r })),
        )
        .catch(logged('snapshot-offload'));
      if (env.AUTOMATION_HIDE_DISABLED !== '1')
        await sweepAutomation(env.DB, controller.scheduledTime, true).catch(logged('automation'));
      await updateClubStrength(env, controller.scheduledTime).catch(logged('club-strength'));
      // Health samples describe the database now, after the preceding cron work has finished.
      await runInfraHealth(env, Date.now(), daily?.status === 'complete').catch(
        logged('infra-health'),
      );
      // T-11-156 서버 최초 기록 전체 재계산을 몰아서 훑는다 — 공개 목록 조회가 조각을 기다리지 않게. 시간 한도까지
      // 돌 수 있어 앞 단계를 밀지 않게 맨 끝에 둔다.
      await runFirstsRescan(createDb(env.DB))
        .then(
          (n) =>
            n && console.log(JSON.stringify({ level: 'info', job: 'firsts-rescan', chunks: n })),
        )
        .catch(logged('firsts-rescan'));
    }
  },
};
