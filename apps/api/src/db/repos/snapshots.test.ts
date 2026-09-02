import type { RngState } from '@offside/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../../test/d1.js';
import { insertCareer } from './careers.js';
import { createProfile } from './profiles.js';
import { upsertServiceSeason } from './serviceSeasons.js';
import { getLatestSnapshot, listSnapshots, pruneSnapshots, putSnapshot } from './snapshots.js';

const RNG_STATE: RngState = { s: [1, 2, 3, 4], draws: 0 };

describe('snapshots repo', () => {
  let ctx: TestD1;
  let careerId: string;

  beforeAll(async () => {
    ctx = await createTestD1();
    const owner = (await createProfile(ctx.db)).id;
    const season = await upsertServiceSeason(ctx.db, {
      id: 'svc_snapshot_test',
      name: 'Snapshot test season',
      status: 'ACTIVE',
      startsAt: '2026-01-01T00:00:00Z',
      endsAt: '2026-12-31T23:59:59Z',
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
      challengeSetId: 'cs_test',
    });
    const career = await insertCareer(ctx.db, {
      id: 'car_snapshot_1',
      ownerProfileId: owner,
      status: 'ACTIVE',
      revision: 1,
      createdServiceSeasonId: season.id,
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
      lastSyncedAt: '2026-09-01T00:00:00Z',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    });
    careerId = career.id;
  });

  afterAll(async () => {
    await ctx.dispose();
  });

  function snapshotInput(revision: number) {
    return {
      careerId,
      revision,
      checkpoint: 'STEP_BOUNDARY' as const,
      state: JSON.stringify({ schemaVersion: 1, careerId }),
      stateHash: 'a'.repeat(64),
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
      rngState: RNG_STATE,
      createdAt: `2026-09-01T00:00:${String(revision).padStart(2, '0')}Z`,
    };
  }

  it('rejects a duplicate (career_id, revision)', async () => {
    await putSnapshot(ctx.db, snapshotInput(1));
    await expect(putSnapshot(ctx.db, snapshotInput(1))).rejects.toThrow();
  });

  it('getLatestSnapshot returns the highest revision', async () => {
    await putSnapshot(ctx.db, snapshotInput(2));
    await putSnapshot(ctx.db, snapshotInput(3));

    const latest = await getLatestSnapshot(ctx.db, careerId);
    expect(latest?.revision).toBe(3);
  });

  it('pruneSnapshots(keep 5) keeps only the latest 5 of 8', async () => {
    const career2 = await insertCareer(ctx.db, {
      id: 'car_snapshot_prune',
      ownerProfileId: (await createProfile(ctx.db)).id,
      status: 'ACTIVE',
      revision: 8,
      createdServiceSeasonId: 'svc_snapshot_test',
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
      lastSyncedAt: '2026-09-01T00:00:00Z',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    });

    for (let revision = 1; revision <= 8; revision++) {
      await putSnapshot(ctx.db, {
        careerId: career2.id,
        revision,
        checkpoint: 'STEP_BOUNDARY',
        state: JSON.stringify({ schemaVersion: 1, careerId: career2.id }),
        stateHash: 'b'.repeat(64),
        rulesetVersion: '1.0.0',
        contentPackVersion: '0.1.0',
        rngState: RNG_STATE,
        createdAt: `2026-09-01T00:${String(revision).padStart(2, '0')}:00Z`,
      });
    }

    await pruneSnapshots(ctx.db, career2.id, 5);

    const remaining = await listSnapshots(ctx.db, career2.id, { limit: 100 });
    expect(remaining.map((snapshot) => snapshot.revision).sort((a, b) => a - b)).toEqual([4, 5, 6, 7, 8]);
  });
});
