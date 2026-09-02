import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../../test/d1.js';
import { getCareer, insertCareer, listCareersByOwner, updateCareerRevision } from './careers.js';
import { createProfile } from './profiles.js';
import { upsertServiceSeason } from './serviceSeasons.js';

describe('careers repo', () => {
  let ctx: TestD1;
  let ownerProfileId: string;
  let serviceSeasonId: string;

  beforeAll(async () => {
    ctx = await createTestD1();
    ownerProfileId = (await createProfile(ctx.db)).id;
    serviceSeasonId = (
      await upsertServiceSeason(ctx.db, {
        id: 'svc_test',
        name: 'Test season',
        status: 'ACTIVE',
        startsAt: '2026-01-01T00:00:00Z',
        endsAt: '2026-12-31T23:59:59Z',
        rulesetVersion: '1.0.0',
        contentPackVersion: '0.1.0',
        challengeSetId: 'cs_test',
      })
    ).id;
  });

  afterAll(async () => {
    await ctx.dispose();
  });

  it('returns the inserted career by id', async () => {
    const career = await insertCareer(ctx.db, {
      id: 'car_get_1',
      ownerProfileId,
      status: 'ACTIVE',
      revision: 1,
      createdServiceSeasonId: serviceSeasonId,
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
      lastSyncedAt: '2026-09-01T00:00:00Z',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    });

    expect(await getCareer(ctx.db, career.id)).toEqual(career);
  });

  it('paginates by owner with a stable updated_at DESC, id ASC order', async () => {
    const owner = (await createProfile(ctx.db)).id;
    const inputs = [
      { id: 'car_page_a', updatedAt: '2026-09-01T00:00:00Z' },
      { id: 'car_page_b', updatedAt: '2026-09-02T00:00:00Z' },
      { id: 'car_page_c', updatedAt: '2026-09-03T00:00:00Z' },
    ];
    for (const input of inputs) {
      await insertCareer(ctx.db, {
        id: input.id,
        ownerProfileId: owner,
        status: 'ACTIVE',
        revision: 1,
        createdServiceSeasonId: serviceSeasonId,
        rulesetVersion: '1.0.0',
        contentPackVersion: '0.1.0',
        lastSyncedAt: input.updatedAt,
        createdAt: input.updatedAt,
        updatedAt: input.updatedAt,
      });
    }

    const firstPage = await listCareersByOwner(ctx.db, owner, { limit: 2 });
    expect(firstPage.items.map((item) => item.id)).toEqual(['car_page_c', 'car_page_b']);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await listCareersByOwner(ctx.db, owner, { limit: 2, cursor: firstPage.nextCursor });
    expect(secondPage.items.map((item) => item.id)).toEqual(['car_page_a']);
    expect(secondPage.nextCursor).toBeNull();
  });

  it('returns 0 affected rows when fromRevision does not match (conflict)', async () => {
    const career = await insertCareer(ctx.db, {
      id: 'car_conflict_1',
      ownerProfileId,
      status: 'ACTIVE',
      revision: 3,
      createdServiceSeasonId: serviceSeasonId,
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
      lastSyncedAt: '2026-09-01T00:00:00Z',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    });

    const conflicting = await updateCareerRevision(ctx.db, career.id, {
      fromRevision: 2,
      toRevision: 4,
      updatedAt: '2026-09-02T00:00:00Z',
    });
    expect(conflicting).toBe(0);

    const applied = await updateCareerRevision(ctx.db, career.id, {
      fromRevision: 3,
      toRevision: 4,
      updatedAt: '2026-09-02T00:00:00Z',
    });
    expect(applied).toBe(1);

    const updated = await getCareer(ctx.db, career.id);
    expect(updated?.revision).toBe(4);
  });
});
