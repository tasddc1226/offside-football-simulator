import { describe, expect, it } from 'vitest';
import { app } from './index.js';

describe('GET /v1/health', () => {
  it('returns ok with a request id', async () => {
    const res = await app.request('/v1/health');

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { ok: boolean }; meta: { requestId: string } };
    expect(body).toMatchObject({ data: { ok: true } });
    expect(typeof body.meta.requestId).toBe('string');
    expect(body.meta.requestId.length).toBeGreaterThan(0);
  });
});
