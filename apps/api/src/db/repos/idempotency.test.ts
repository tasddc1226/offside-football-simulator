import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../../test/d1.js';
import { idempotency } from '../schema.js';
import { getIdempotent, purgeExpired, putIdempotent } from './idempotency.js';
import { createProfile } from './profiles.js';

describe('idempotency repo', () => {
  let ctx: TestD1;
  let ownerProfileId: string;

  beforeAll(async () => {
    ctx = await createTestD1();
    ownerProfileId = (await createProfile(ctx.db)).id;
  });

  afterAll(async () => {
    await ctx.dispose();
  });

  it('a second request with the same key returns the first stored response', async () => {
    await putIdempotent(ctx.db, {
      ownerProfileId,
      key: 'idem-key-1',
      requestHash: 'a'.repeat(64),
      responseStatus: 200,
      responseBody: '{"data":{"ok":true}}',
      createdAt: '2026-09-01T00:00:00Z',
      expiresAt: '2027-09-01T00:00:00Z',
    });

    const first = await getIdempotent(ctx.db, ownerProfileId, 'idem-key-1', '2026-09-01T00:00:01Z');
    const second = await getIdempotent(ctx.db, ownerProfileId, 'idem-key-1', '2026-09-01T00:00:02Z');
    expect(first?.responseStatus).toBe(200);
    expect(second).toEqual(first);
  });

  it('does not return an already-expired key', async () => {
    await putIdempotent(ctx.db, {
      ownerProfileId,
      key: 'idem-key-expired',
      requestHash: 'b'.repeat(64),
      responseStatus: 200,
      responseBody: '{}',
      createdAt: '2026-01-01T00:00:00Z',
      expiresAt: '2026-01-02T00:00:00Z',
    });

    await expect(getIdempotent(ctx.db, ownerProfileId, 'idem-key-expired', '2026-09-01T00:00:00Z')).resolves.toBeUndefined();
  });

  it('purgeExpired removes expired rows from the table', async () => {
    await putIdempotent(ctx.db, {
      ownerProfileId,
      key: 'idem-key-purge',
      requestHash: 'c'.repeat(64),
      responseStatus: 200,
      responseBody: '{}',
      createdAt: '2026-01-01T00:00:00Z',
      expiresAt: '2026-01-02T00:00:00Z',
    });

    const deleted = await purgeExpired(ctx.db, '2026-09-01T00:00:00Z');
    expect(deleted).toBeGreaterThanOrEqual(1);

    const [row] = await ctx.db
      .select()
      .from(idempotency)
      .where(eq(idempotency.key, 'idem-key-purge'));
    expect(row).toBeUndefined();
  });
});
