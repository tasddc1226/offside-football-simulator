import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../../test/d1.js';
import { insertCareer } from './careers.js';
import { appendCommands, listCommandsSince, type AppendCommandEntry } from './commandLog.js';
import { createProfile } from './profiles.js';
import { upsertServiceSeason } from './serviceSeasons.js';

describe('commandLog repo', () => {
  let ctx: TestD1;
  let careerId: string;

  beforeAll(async () => {
    ctx = await createTestD1();
    const owner = (await createProfile(ctx.db)).id;
    const season = await upsertServiceSeason(ctx.db, {
      id: 'svc_command_log_test',
      name: 'Command log test season',
      status: 'ACTIVE',
      startsAt: '2026-01-01T00:00:00Z',
      endsAt: '2026-12-31T23:59:59Z',
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
      challengeSetId: 'cs_test',
    });
    const career = await insertCareer(ctx.db, {
      id: 'car_command_log_1',
      ownerProfileId: owner,
      status: 'ACTIVE',
      revision: 3,
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

  function entry(revision: number): AppendCommandEntry {
    return {
      revision,
      commandId: `cmd_${revision}`,
      commandType: 'ADVANCE',
      payload: { revision },
      resultHash: 'a'.repeat(64),
      createdAt: `2026-09-01T00:00:${String(revision).padStart(2, '0')}Z`,
    };
  }

  it('appends commands and rolls back the whole batch on a PK conflict', async () => {
    await appendCommands(ctx.db, careerId, [entry(1), entry(2), entry(3)]);

    await expect(appendCommands(ctx.db, careerId, [entry(4), entry(5), entry(3)])).rejects.toThrow();

    const remaining = await listCommandsSince(ctx.db, careerId, 0);
    expect(remaining.map((command) => command.revision)).toEqual([1, 2, 3]);
  });

  it('listCommandsSince returns only revisions strictly after the boundary', async () => {
    const after = await listCommandsSince(ctx.db, careerId, 1);
    expect(after.map((command) => command.revision)).toEqual([2, 3]);
  });
});
