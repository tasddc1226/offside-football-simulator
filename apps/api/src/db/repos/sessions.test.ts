import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../../test/d1.js';
import { createProfile } from './profiles.js';
import { createSession, findActiveSession, revokeSession } from './sessions.js';

describe('sessions repo', () => {
  let ctx: TestD1;
  let profileId: string;

  beforeAll(async () => {
    ctx = await createTestD1();
    profileId = (await createProfile(ctx.db)).id;
  });

  afterAll(async () => {
    await ctx.dispose();
  });

  it('finds an active session by token hash', async () => {
    const session = await createSession(ctx.db, {
      profileId,
      channel: 'web',
      tokenHash: 'a'.repeat(64),
      expiresAt: '2027-01-01T00:00:00Z',
    });

    const found = await findActiveSession(ctx.db, session.tokenHash, '2026-09-02T00:00:00Z');
    expect(found?.id).toBe(session.id);
  });

  it('does not return an expired session', async () => {
    const session = await createSession(ctx.db, {
      profileId,
      channel: 'web',
      tokenHash: 'b'.repeat(64),
      expiresAt: '2026-01-01T00:00:00Z',
    });

    const found = await findActiveSession(ctx.db, session.tokenHash, '2026-09-02T00:00:00Z');
    expect(found).toBeUndefined();
  });

  it('does not return a revoked session', async () => {
    const session = await createSession(ctx.db, {
      profileId,
      channel: 'toss',
      tokenHash: 'c'.repeat(64),
      expiresAt: '2027-01-01T00:00:00Z',
    });

    await revokeSession(ctx.db, session.id, '2026-09-02T00:00:00Z');

    const found = await findActiveSession(ctx.db, session.tokenHash, '2026-09-02T01:00:00Z');
    expect(found).toBeUndefined();
  });
});
