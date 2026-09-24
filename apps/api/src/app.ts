import { Hono } from 'hono';
import type { AppEnv } from './env.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { bodyGuard } from './middleware/bodyGuard.js';
import { cors } from './middleware/cors.js';
import { logger } from './middleware/logger.js';
import { originGuard } from './middleware/originGuard.js';
import { requestId } from './middleware/requestId.js';
import { session } from './middleware/session.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerCareerRoutes } from './routes/careers.js';
import { registerProfileRoutes } from './routes/profile.js';

export function createApp(options: { testRoutes?: boolean } = {}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', requestId);
  app.use('*', logger);
  app.use('*', cors);
  app.use('*', originGuard);
  app.use('*', bodyGuard);
  app.use('*', session);

  app.get('/v1/health', (c) => {
    return c.json({
      data: { ok: true },
      meta: { requestId: c.get('requestId') },
    });
  });

  registerProfileRoutes(app);
  registerAuthRoutes(app);
  registerCareerRoutes(app);

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
