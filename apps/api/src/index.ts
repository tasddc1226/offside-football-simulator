import { Hono } from 'hono';

export const app = new Hono();

app.get('/v1/health', (c) => {
  return c.json({
    data: { ok: true },
    meta: { requestId: crypto.randomUUID() },
  });
});

export default app;
