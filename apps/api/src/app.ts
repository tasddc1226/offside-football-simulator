import { registerAcquisitionRoutes } from './routes/acquisition.js';
import { HealthDataSchema } from '@offside/contracts';
import { Hono } from 'hono';
import type { AppEnv } from './env.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { bodyGuard } from './middleware/bodyGuard.js';
import { cors } from './middleware/cors.js';
import { logger } from './middleware/logger.js';
import { cupHomeCache } from './middleware/cupHomeCache.js';
import { originGuard } from './middleware/originGuard.js';
import { requestId } from './middleware/requestId.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { seasonScheduleMiddleware } from './seasonSchedule.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerAppAuthRoutes } from './routes/appAuth.js';
import { registerAppVersionRoutes } from './routes/appVersion.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerAppleWebAuthRoutes } from './routes/appleWebAuth.js';
import { registerClubStrengthRoutes } from './routes/clubStrength.js';
import { registerBalanceRoutes } from './routes/balance.js';
import { registerBoardRoutes } from './routes/boards.js';
import { registerTranslateRoutes } from './routes/translate.js';
import { registerReleaseNoteRoutes } from './routes/releaseNotes.js';
import { registerPushRoutes } from './routes/push.js';
import { registerNotificationRoutes } from './routes/notifications.js';
import { registerChatRoutes } from './routes/chat.js';
import { registerReportRoutes } from './routes/reports.js';
import { registerCareerActivityRoutes } from './routes/careerActivity.js';
import { registerCareerRoutes } from './routes/careers.js';
import { registerClubCustomRoutes } from './routes/clubCustom.js';
import { registerHofRoutes } from './routes/hof.js';
import { registerBest11Routes } from './routes/best11.js';
import { registerFirstsRoutes } from './routes/firsts.js';
import { registerRetiredNumberRoutes } from './routes/retiredNumbers.js';
import { registerLiveRoutes } from './routes/live.js';
import { registerTickerRoutes } from './routes/ticker.js';
import { registerSeasonGaugeRoutes } from './routes/seasonGauge.js';
import { registerServerStatusRoutes } from './routes/serverStatus.js';
import { registerClientErrorRoutes } from './routes/clientErrors.js';
import { registerFriendRoutes } from './routes/friends.js';
import { registerOwnerTeamRoutes } from './routes/ownerTeam.js';
import { registerOwnerSummaryRoutes } from './routes/ownerSummary.js';
import { registerSeasonRecapRoutes } from './routes/seasonRecap.js';
import { registerTeamRoutes } from './routes/teams.js';
import { registerTeamCommentRoutes } from './routes/teamComments.js';
import { registerMarketRoutes } from './routes/market.js';
import { registerManagerRoutes } from './routes/managers.js';
import { registerCardExchangeRoutes } from './routes/cardExchanges.js';
import { registerCupRoutes } from './routes/cup.js';
import { registerLeagueRoutes } from './routes/league.js';
import { registerIapRoutes } from './routes/iap.js';
import { registerWebPayRoutes } from './routes/webPay.js';
import { registerAttendanceRoutes } from './routes/attendance.js';
import { registerSeasonPassRoutes } from './routes/seasonPass.js';
import { registerAdminCupRoutes } from './routes/adminCups.js';
import { registerAdminLeagueRoutes } from './routes/adminLeagues.js';
import { registerOwnerProfileRoutes } from './routes/ownerProfile.js';
import { registerProfileRoutes } from './routes/profile.js';
import { ok } from './routes/shared.js';

export function createApp(options: { testRoutes?: boolean } = {}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', requestId);
  app.use('*', logger);
  app.use('*', securityHeaders);
  app.use('*', cupHomeCache);
  app.use('*', cors);
  app.use('*', originGuard);
  app.use('*', bodyGuard);
  app.use('*', seasonScheduleMiddleware);

  app.get('/v1/health', (c) => ok(c, HealthDataSchema, { ok: true }));

  registerProfileRoutes(app);
  registerAuthRoutes(app);
  registerAppleWebAuthRoutes(app);
  registerAppAuthRoutes(app);
  registerAppVersionRoutes(app);
  registerCareerRoutes(app);
  registerCareerActivityRoutes(app);
  registerHofRoutes(app);
  registerBest11Routes(app);
  registerFirstsRoutes(app);
  registerRetiredNumberRoutes(app);
  registerLiveRoutes(app);
  registerTickerRoutes(app);
  registerSeasonGaugeRoutes(app);
  registerServerStatusRoutes(app);
  registerClientErrorRoutes(app);
  registerClubCustomRoutes(app);
  registerOwnerTeamRoutes(app);
  registerSeasonRecapRoutes(app);
  registerOwnerSummaryRoutes(app);
  registerOwnerProfileRoutes(app);
  registerFriendRoutes(app);
  registerTeamRoutes(app);
  registerTeamCommentRoutes(app);
  registerMarketRoutes(app);
  registerManagerRoutes(app);
  registerCardExchangeRoutes(app);
  registerCupRoutes(app);
  registerLeagueRoutes(app);
  registerIapRoutes(app);
  registerWebPayRoutes(app);
  registerAcquisitionRoutes(app);
  registerAttendanceRoutes(app);
  registerSeasonPassRoutes(app);
  registerBoardRoutes(app);
  registerTranslateRoutes(app);
  registerReleaseNoteRoutes(app);
  registerPushRoutes(app);
  registerNotificationRoutes(app);
  registerChatRoutes(app);
  registerReportRoutes(app);
  registerBalanceRoutes(app);
  registerClubStrengthRoutes(app);
  registerAdminRoutes(app);
  registerAdminCupRoutes(app);
  registerAdminLeagueRoutes(app);

  if (options.testRoutes) {
    app.get('/v1/test/throw', () => {
      throw new Error('boom');
    });
  }

  app.onError(errorHandler);
  app.notFound(notFoundHandler);

  return app;
}

export const app = createApp();
