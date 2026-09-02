import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../../test/d1.js';
import { profiles } from '../schema.js';
import { createProfile, getProfile, updateSettings } from './profiles.js';

describe('profiles repo', () => {
  let ctx: TestD1;

  beforeAll(async () => {
    ctx = await createTestD1();
  });

  afterAll(async () => {
    await ctx.dispose();
  });

  it('creates a profile with default settings, then reads it back', async () => {
    const created = await createProfile(ctx.db);
    expect(created.settings).toEqual({
      reducedMotion: 'SYSTEM',
      textScale: 100,
      theme: 'SYSTEM',
      defaultSimulationMode: 'CHAPTER',
    });

    const fetched = await getProfile(ctx.db, created.id);
    expect(fetched).toEqual(created);
  });

  it('returns undefined for an unknown profile id', async () => {
    await expect(getProfile(ctx.db, 'prf_missing')).resolves.toBeUndefined();
  });

  it('partially updates settings after merging and validating', async () => {
    const created = await createProfile(ctx.db);
    const updated = await updateSettings(ctx.db, created.id, { theme: 'DARK' });
    expect(updated.settings).toEqual({
      reducedMotion: 'SYSTEM',
      textScale: 100,
      theme: 'DARK',
      defaultSimulationMode: 'CHAPTER',
    });
  });

  it('rejects an invalid settings value', async () => {
    const created = await createProfile(ctx.db);
    // @ts-expect-error 110은 ProfileSettings.textScale에 없는 값이다.
    await expect(updateSettings(ctx.db, created.id, { textScale: 110 })).rejects.toThrow();
  });

  it('rejects a duplicate google_sub', async () => {
    const now = new Date().toISOString();
    const settingsJson = JSON.stringify({
      reducedMotion: 'SYSTEM',
      textScale: 100,
      theme: 'SYSTEM',
      defaultSimulationMode: 'CHAPTER',
    });
    await ctx.db.insert(profiles).values({
      id: 'prf_dup_1',
      settingsJson,
      googleSub: 'google-sub-dup',
      createdAt: now,
      lastSeenAt: now,
    });

    await expect(
      ctx.db.insert(profiles).values({
        id: 'prf_dup_2',
        settingsJson,
        googleSub: 'google-sub-dup',
        createdAt: now,
        lastSeenAt: now,
      }),
    ).rejects.toThrow();
  });
});
