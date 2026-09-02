import { Hono } from 'hono';
import type { Bindings } from './env.js';

export const app = new Hono<{ Bindings: Bindings }>();

app.get('/v1/health', (c) => {
  return c.json({
    data: { ok: true },
    meta: { requestId: crypto.randomUUID() },
  });
});

export default app;
