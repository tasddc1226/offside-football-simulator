import {
  LockerRoomSchema,
  LockerTeamSchema,
  ProfileSchema,
  successEnvelope,
} from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { deleteCareerCascade } from '../db/repos/careers.js';
import { upsertServiceSeason } from '../db/repos/serviceSeasons.js';
import {
  careers,
  careerPublications,
  lockerPlayerNotes,
  lockerTeams,
  sessions,
  snapshots,
} from '../db/schema.js';
import { moveCareersAndRebind, moveCareersAndRotateWebSession } from '../profile/merge.js';
import { executeProfileDeletion, issueDeleteConfirmToken } from '../profile/delete-profile.js';
import { createTestD1, type TestD1 } from '../test/d1.js';

const now = '2026-09-21T00:00:00.000Z';
const app = createApp();
let ctx: TestD1;
async function account() {
  const res = await app.request('/v1/profile', {}, ctx.env);
  const profile = successEnvelope(ProfileSchema).parse(await res.json()).data;
  return { id: profile.id, cookie: res.headers.get('set-cookie')!.split(';')[0]! };
}
async function player(
  owner: string,
  id: string,
  status: 'ACTIVE' | 'RETIRED' | 'DRAFT' = 'ACTIVE',
  position = 'ST',
) {
  await ctx.db.insert(careers).values({
    id,
    ownerProfileId: owner,
    status,
    revision: 2,
    createdServiceSeasonId: 'svc_test',
    rulesetVersion: '3.1.0',
    contentPackVersion: '0.10.0',
    lastSyncedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  for (const revision of [1, 2])
    await ctx.db.insert(snapshots).values({
      id: `${id}:${revision}`,
      careerId: id,
      revision,
      checkpoint: 'STEP_BOUNDARY',
      state: JSON.stringify({
        age: 25,
        seasonHistory: [{}, {}],
        player: {
          profile: { name: id, primaryPosition: position, baseOvr: revision === 2 ? 77 : 60 },
        },
      }),
      stateHash: 'test',
      rngStateJson: '{}',
      rulesetVersion: '3.1.0',
      contentPackVersion: '0.10.0',
      createdAt: now,
    });
}
function request(
  cookie: string,
  method: string,
  path = '/v1/locker-room/teams',
  body?: unknown,
  key = crypto.randomUUID(),
) {
  return app.request(
    path,
    {
      method,
      headers: {
        Cookie: cookie,
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    ctx.env,
  );
}
const input = (id: string | null = null) => ({
  name: '내 팀',
  formation: '4-3-3',
  lineup: Array.from({ length: 18 }, (_, i) => (i === 9 ? id : null)),
});
async function room(cookie: string) {
  const res = await request(cookie, 'GET', '/v1/locker-room?includeRecognition=1');
  expect(res.status).toBe(200);
  return successEnvelope(LockerRoomSchema).parse(await res.json()).data;
}
async function team(cookie: string, id: string | null = null) {
  const res = await request(cookie, 'POST', undefined, input(id));
  expect(res.status).toBe(201);
  return successEnvelope(LockerTeamSchema).parse(await res.json()).data;
}
beforeEach(async () => {
  ctx = await createTestD1();
  await upsertServiceSeason(ctx.db, {
    id: 'svc_test',
    name: 'Test',
    status: 'ACTIVE',
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: '2026-12-31T23:59:59Z',
    rulesetVersion: '3.1.0',
    contentPackVersion: '0.10.0',
    challengeSetId: 'cs_test',
  });
});
afterEach(async () => {
  await ctx.dispose();
});
describe('account locker room', () => {
  it('requires authentication and returns only owned, created players at their latest revision', async () => {
    expect((await app.request('/v1/locker-room', {}, ctx.env)).status).toBe(401);
    const a = await account();
    const b = await account();
    await player(a.id, 'active');
    await player(a.id, 'retired', 'RETIRED');
    await player(a.id, 'draft', 'DRAFT');
    await player(b.id, 'foreign');
    const data = await room(a.cookie);
    expect(data.players.map((p) => p.careerId)).toEqual(['active', 'retired']);
    expect(data.players.every((p) => p.ovr === 77 && p.age === 25 && p.seasons === 2)).toBe(true);
    expect(data.players[1]?.status).toBe('RETIRED');
    expect(data.players.every((p) => p.awardCount === 0 && p.milestoneCount === 0)).toBe(true);
    const recognition = await request(a.cookie, 'GET', '/v1/locker-room?includeRecognition=1');
    const recognitionData = successEnvelope(LockerRoomSchema).parse(await recognition.json()).data;
    expect(recognitionData.players.every((p) => p.awardCount === 0 && p.milestoneCount === 0)).toBe(true);
    await player(a.id, 'awarded');
    await ctx.db
      .update(snapshots)
      .set({
        state: JSON.stringify({
          age: 25,
          seasonHistory: [{ result: { awards: [{ recipientId: 'PLAYER' }, { recipientId: 'NPC' }], milestones: [{}] } }],
          player: { profile: { name: 'awarded', primaryPosition: 'ST', baseOvr: 77 } },
        }),
      })
      .where(eq(snapshots.id, 'awarded:2'));
    const awardedResponse = await request(a.cookie, 'GET', '/v1/locker-room?includeRecognition=1');
    const awardedData = successEnvelope(LockerRoomSchema).parse(await awardedResponse.json()).data;
    expect(awardedData.players.find((p) => p.careerId === 'awarded')).toMatchObject({ awardCount: 1, milestoneCount: 1 });
  });
  it('keeps the legacy default response to the original eight player keys', async () => {
    const a = await account();
    await player(a.id, 'legacy');
    const response = await request(a.cookie, 'GET', '/v1/locker-room');
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: { players: Array<Record<string, unknown>> } };
    expect(payload.data.players[0]).toEqual({
      careerId: 'legacy',
      name: 'legacy',
      position: 'ST',
      ovr: 77,
      age: 25,
      status: 'ACTIVE',
      seasons: 2,
      isTest: false,
    });
  });
  it('exposes peak evidence only from stored season results and leaves unsupported fields unknown', async () => {
    const a = await account();
    await player(a.id, 'evidence');
    await ctx.db
      .update(snapshots)
      .set({
        state: JSON.stringify({
          age: 28,
          seasonHistory: [
            {
              index: 1,
              result: {
                baseOvr: { before: 70, after: 78 },
                legacy: { ageAtStart: 20 },
                playerStats: { ratedMatches: 9, ratingSumTenths: 720, minutes: 700 },
              },
            },
            {
              index: 2,
              result: {
                baseOvr: { before: 78, after: 84 },
                legacy: { ageAtStart: 21 },
                playerStats: { ratedMatches: 10, ratingSumTenths: 760, minutes: 900 },
              },
            },
          ],
          player: { profile: { name: 'evidence', primaryPosition: 'ST', baseOvr: 84 } },
        }),
      })
      .where(eq(snapshots.id, 'evidence:2'));
    const data = await room(a.cookie);
    expect(data.players[0]).toMatchObject({
      peakOvr: 84,
      peakAge: 21,
      bestSeasonIndex: 2,
      note: null,
    });
  });
  it('isolates note lifecycle by owner, validates input, and leaves snapshots/public articles unchanged', async () => {
    const a = await account();
    const b = await account();
    await player(a.id, 'owned');
    await player(b.id, 'foreign');
    const before = await ctx.db.select().from(snapshots).where(eq(snapshots.careerId, 'owned'));
    expect((await request('', 'GET', '/v1/locker-room')).status).toBe(401);
    expect(
      (await request('', 'PUT', '/v1/locker-room/players/owned/note', { note: 'x' })).status,
    ).toBe(401);
    expect((await request('', 'DELETE', '/v1/locker-room/players/owned/note')).status).toBe(401);
    expect(
      (await request(b.cookie, 'PUT', '/v1/locker-room/players/owned/note', { note: '외부 메모' }))
        .status,
    ).toBe(404);
    expect((await request(b.cookie, 'DELETE', '/v1/locker-room/players/owned/note')).status).toBe(
      204,
    );
    expect(
      (await request(a.cookie, 'PUT', '/v1/locker-room/players/owned/note', { note: '' })).status,
    ).toBe(400);
    expect(
      (
        await request(a.cookie, 'PUT', '/v1/locker-room/players/owned/note', {
          note: 'x'.repeat(141),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(a.cookie, 'PUT', '/v1/locker-room/players/owned/note', {
          note: '비공개 메모',
        })
      ).status,
    ).toBe(200);
    expect((await room(a.cookie)).players.find((p) => p.careerId === 'owned')?.note).toBe(
      '비공개 메모',
    );
    expect(await ctx.db.select().from(snapshots).where(eq(snapshots.careerId, 'owned'))).toEqual(
      before,
    );
    await ctx.db.insert(careerPublications).values({
      id: '00000000-0000-4000-8000-000000000001',
      careerId: 'owned',
      articleJson: JSON.stringify({
        id: '00000000-0000-4000-8000-000000000001',
        playerName: 'owned',
        initialPosition: 'ST',
        seasons: 1,
        playedMatches: 1,
        minutes: 90,
        averageRatingTenths: null,
        clubCount: 1,
        highlights: [],
        publishedAt: now,
        challenge: {
          seed: 'seed',
          rulesetVersion: '3.1.0',
          contentPackVersion: '0.10.0',
          simulationMode: 'FAST',
          draft: {
            gender: 'MALE',
            nationalityCode: 'KR',
            preferredFoot: 'RIGHT',
            position: 'ST',
            archetypeId: 'poacher',
            backgroundId: 'ACADEMY',
          },
        },
      }),
      createdAt: now,
    });
    const article = await app.request(
      '/v1/articles/00000000-0000-4000-8000-000000000001',
      {},
      ctx.env,
    );
    expect(await article.text()).not.toContain('비공개 메모');
    expect((await request(a.cookie, 'DELETE', '/v1/locker-room/players/owned/note')).status).toBe(
      204,
    );
    expect((await request(a.cookie, 'DELETE', '/v1/locker-room/players/owned/note')).status).toBe(
      204,
    );
    expect((await room(a.cookie)).players.find((p) => p.careerId === 'owned')?.note).toBeNull();
  });
  it('saves partial teams idempotently, rejects stale updates, and isolates all mutations by owner', async () => {
    const a = await account();
    const b = await account();
    await player(a.id, 'striker');
    const key = crypto.randomUUID();
    const first = await request(a.cookie, 'POST', undefined, input('striker'), key);
    const created = successEnvelope(LockerTeamSchema).parse(await first.json()).data;
    expect((await request(a.cookie, 'POST', undefined, input('striker'), key)).status).toBe(201);
    expect((await room(a.cookie)).teams).toHaveLength(1);
    expect((await room(b.cookie)).teams).toHaveLength(0);
    const path = `/v1/locker-room/teams/${created.id}`;
    expect((await request(b.cookie, 'PUT', path, { ...input(), revision: 1 })).status).toBe(409);
    await request(b.cookie, 'DELETE', path);
    expect((await room(a.cookie)).teams).toHaveLength(1);
    expect(
      (await request(a.cookie, 'PUT', path, { ...input('striker'), name: '새 팀', revision: 1 }))
        .status,
    ).toBe(200);
    expect((await request(a.cookie, 'PUT', path, { ...input(), revision: 1 })).status).toBe(409);
    expect((await room(a.cookie)).teams[0]?.name).toBe('새 팀');
    expect((await request(a.cookie, 'DELETE', path)).status).toBe(204);
    expect((await room(a.cookie)).players).toHaveLength(1);
    expect((await room(a.cookie)).teams).toHaveLength(0);
  });
  it('rejects foreign players, duplicates, forged attributes and invalid goalkeeper assignments', async () => {
    const a = await account();
    const b = await account();
    await player(b.id, 'foreign');
    await player(a.id, 'striker');
    await player(a.id, 'keeper', 'ACTIVE', 'GK');
    const duplicate = input('striker');
    duplicate.lineup[11] = 'striker';
    const badKeeper = input();
    badKeeper.lineup[0] = 'striker';
    for (const body of [
      input('foreign'),
      duplicate,
      badKeeper,
      input('keeper'),
      { ...input(), ovr: 99 },
    ]) {
      expect((await request(a.cookie, 'POST', undefined, body)).status).toBe(400);
    }
    const valid = input('striker');
    valid.lineup[0] = 'keeper';
    expect((await request(a.cookie, 'POST', undefined, valid)).status).toBe(201);
  });
  it('clears deleted players from saved teams without deleting the team', async () => {
    const a = await account();
    await player(a.id, 'striker');
    await team(a.cookie, 'striker');
    await deleteCareerCascade(ctx.db, 'striker');
    const data = await room(a.cookie);
    expect(data.players).toEqual([]);
    expect(data.teams[0]?.lineup).toEqual(input().lineup);
  });
  it.each(['rebind', 'rotate'] as const)(
    'moves players and teams together on %s account merge',
    async (mode) => {
      const a = await account();
      const b = await account();
      await player(a.id, 'striker');
      expect(
        (
          await request(a.cookie, 'PUT', '/v1/locker-room/players/striker/note', {
            note: '첫 경기의 기억',
          })
        ).status,
      ).toBe(200);
      const original = await team(a.cookie, 'striker');
      await team(b.cookie);
      const [session] = await ctx.db.select().from(sessions).where(eq(sessions.profileId, a.id));
      const args = {
        fromProfileId: a.id,
        toProfileId: b.id,
        sessionId: session!.id,
        now: new Date().toISOString(),
      };
      if (mode === 'rebind') await moveCareersAndRebind(ctx.db, args);
      else await moveCareersAndRotateWebSession(ctx.db, args);
      const data = await room(b.cookie);
      expect(data.players).toHaveLength(1);
      expect(data.players[0]?.note).toBe('첫 경기의 기억');
      expect(data.teams).toHaveLength(2);
      expect(data.teams.find((t) => t.id === original.id)?.lineup[9]).toBe('striker');
      expect(
        await ctx.db.select().from(lockerTeams).where(eq(lockerTeams.ownerProfileId, a.id)),
      ).toHaveLength(0);
    },
  );
  it('erases teams with account deletion while preserving other accounts', async () => {
    const a = await account();
    const b = await account();
    await player(a.id, 'noted-player');
    expect(
      (
        await request(a.cookie, 'PUT', '/v1/locker-room/players/noted-player/note', {
          note: '비공개 메모',
        })
      ).status,
    ).toBe(200);
    await team(a.cookie);
    await team(b.cookie);
    const [session] = await ctx.db.select().from(sessions).where(eq(sessions.profileId, a.id));
    const args = {
      profileId: a.id,
      sessionId: session!.id,
      sessionTokenHash: session!.tokenHash,
      now: new Date().toISOString(),
    };
    const { confirmToken } = await issueDeleteConfirmToken(args);
    await executeProfileDeletion(ctx.db, { ...args, confirmToken });
    expect(
      await ctx.db.select().from(lockerTeams).where(eq(lockerTeams.ownerProfileId, a.id)),
    ).toHaveLength(0);
    expect(
      await ctx.db
        .select()
        .from(lockerPlayerNotes)
        .where(eq(lockerPlayerNotes.careerId, 'noted-player')),
    ).toHaveLength(0);
    expect((await room(b.cookie)).teams).toHaveLength(1);
  });
});
