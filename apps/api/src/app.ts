import { HealthDataSchema } from '@offside/contracts';
import { Hono } from 'hono';
import type { AppEnv } from './env.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { bodyGuard } from './middleware/bodyGuard.js';
import { cors } from './middleware/cors.js';
import { logger } from './middleware/logger.js';
import { originGuard } from './middleware/originGuard.js';
import { requestId } from './middleware/requestId.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerAppAuthRoutes } from './routes/appAuth.js';
import { registerAppVersionRoutes } from './routes/appVersion.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerBalanceRoutes } from './routes/balance.js';
import { registerBoardRoutes } from './routes/boards.js';
import { registerReleaseNoteRoutes } from './routes/releaseNotes.js';
import { registerPushRoutes } from './routes/push.js';
import { registerNotificationRoutes } from './routes/notifications.js';
import { registerChatRoutes } from './routes/chat.js';
import { registerReportRoutes } from './routes/reports.js';
import { registerCareerRoutes } from './routes/careers.js';
import { registerClubCustomRoutes } from './routes/clubCustom.js';
import { registerHofRoutes } from './routes/hof.js';
import { registerFirstsRoutes } from './routes/firsts.js';
import { registerRetiredNumberRoutes } from './routes/retiredNumbers.js';
import { registerLiveRoutes } from './routes/live.js';
import { registerTickerRoutes } from './routes/ticker.js';
import { registerFriendRoutes } from './routes/friends.js';
import { registerOwnerTeamRoutes } from './routes/ownerTeam.js';
import { registerSeasonRecapRoutes } from './routes/seasonRecap.js';
import { registerTeamRoutes } from './routes/teams.js';
import { registerMarketRoutes } from './routes/market.js';
import { registerCupRoutes } from './routes/cup.js';
import { registerProfileRoutes } from './routes/profile.js';
import { ok } from './routes/shared.js';

export function createApp(options: { testRoutes?: boolean } = {}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', requestId);
  app.use('*', logger);
  app.use('*', cors);
  app.use('*', originGuard);
  app.use('*', bodyGuard);

  app.get('/v1/health', (c) => ok(c, HealthDataSchema, { ok: true }));

  registerProfileRoutes(app);
  registerAuthRoutes(app);
  registerAppAuthRoutes(app);
  registerAppVersionRoutes(app);
  registerCareerRoutes(app);
  registerHofRoutes(app);
  registerFirstsRoutes(app);
  registerRetiredNumberRoutes(app);
  registerLiveRoutes(app);
  registerTickerRoutes(app);
  registerClubCustomRoutes(app);
  registerOwnerTeamRoutes(app);
  registerSeasonRecapRoutes(app);
  registerFriendRoutes(app);
  registerTeamRoutes(app);
  registerMarketRoutes(app);
  registerCupRoutes(app);
  registerBoardRoutes(app);
  registerReleaseNoteRoutes(app);
  registerPushRoutes(app);
  registerNotificationRoutes(app);
  registerChatRoutes(app);
  registerReportRoutes(app);
  registerBalanceRoutes(app);
  registerAdminRoutes(app);

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
export default app;
