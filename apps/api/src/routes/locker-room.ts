import {
  LockerPlayerSchema,
  LockerRoomSchema,
  LockerTeamSchema,
  SaveTeamSchema,
  TeamInputSchema,
  type LockerPlayer,
  type TeamInput,
} from '@offside/contracts';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { Hono } from 'hono';
import type { Db } from '../db/client.js';
import { careers, lockerTeams, serviceSeasons, snapshots } from '../db/schema.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { idempotency } from '../middleware/idempotency.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';

export async function lockerPlayers(db: Db, owner: string): Promise<LockerPlayer[]> {
  const rows = await db
    .select({
      careerId: careers.id,
      status: careers.status,
      name: sql<string>`json_extract(${snapshots.state}, '$.player.profile.name')`,
      position: sql<string>`json_extract(${snapshots.state}, '$.player.profile.primaryPosition')`,
      ovr: sql<number>`json_extract(${snapshots.state}, '$.player.profile.baseOvr')`,
      age: sql<number>`json_extract(${snapshots.state}, '$.age')`,
      seasons: sql<number>`json_array_length(${snapshots.state}, '$.seasonHistory')`,
      isTest: serviceSeasons.isTest,
    })
    .from(careers)
    .innerJoin(
      snapshots,
      and(eq(snapshots.careerId, careers.id), eq(snapshots.revision, careers.revision)),
    )
    .innerJoin(serviceSeasons, eq(serviceSeasons.id, careers.createdServiceSeasonId))
    .where(
      and(
        eq(careers.ownerProfileId, owner),
        ne(careers.status, 'DRAFT'),
        sql`json_type(${snapshots.state}, '$.player.profile') = 'object'`,
      ),
    )
    .orderBy(asc(careers.createdAt), asc(careers.id));
  return rows.map((row) => LockerPlayerSchema.parse({ ...row, isTest: row.isTest === 1 }));
}

function teamView(row: typeof lockerTeams.$inferSelect, players: readonly LockerPlayer[]) {
  const ids = new Set(players.map((p) => p.careerId));
  return LockerTeamSchema.parse({
    id: row.id,
    name: row.name,
    formation: row.formation,
    revision: row.revision,
    updatedAt: row.updatedAt,
    lineup: (JSON.parse(row.lineupJson) as (string | null)[]).map((id) =>
      id !== null && ids.has(id) ? id : null,
    ),
  });
}

function validateLineup(input: TeamInput, players: readonly LockerPlayer[]) {
  const roster = new Map(players.map((p) => [p.careerId, p]));
  input.lineup.forEach((id, slot) => {
    if (id === null) return;
    const player = roster.get(id);
    if (!player)
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '내 라커룸에 저장된 선수만 편성할 수 있습니다.',
      });
    if (
      (slot === 0 && player.position !== 'GK') ||
      (slot > 0 && slot < 11 && player.position === 'GK')
    )
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '골키퍼는 골키퍼 자리 또는 후보에 편성해 주세요.',
      });
  });
}
function jsonBody(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? '{}');
  } catch {
    throw new AppError({ code: 'VALIDATION_FAILED', message: '요청 본문이 올바르지 않습니다.' });
  }
}
export function registerLockerRoomRoutes(app: Hono<AppEnv>) {
  app.get('/v1/locker-room', requireProfile, async (c) => {
    const db = getDb(c);
    const owner = getSessionOrThrow(c).profileId;
    const players = await lockerPlayers(db, owner);
    const rows = await db
      .select()
      .from(lockerTeams)
      .where(eq(lockerTeams.ownerProfileId, owner))
      .orderBy(asc(lockerTeams.createdAt), asc(lockerTeams.id));
    return c.json({
      data: LockerRoomSchema.parse({
        profileId: owner,
        players,
        teams: rows.map((row) => teamView(row, players)),
      }),
      meta: { requestId: c.get('requestId') },
    });
  });
  app.post('/v1/locker-room/teams', requireProfile, idempotency, async (c) => {
    const db = getDb(c);
    const owner = getSessionOrThrow(c).profileId;
    const input = parseWithAppError(TeamInputSchema, jsonBody(c.get('rawBody')));
    const players = await lockerPlayers(db, owner);
    validateLineup(input, players);
    const now = new Date().toISOString();
    const [row] = await db
      .insert(lockerTeams)
      .values({
        id: crypto.randomUUID(),
        ownerProfileId: owner,
        name: input.name,
        formation: input.formation,
        lineupJson: JSON.stringify(input.lineup),
        revision: 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return c.json({ data: teamView(row!, players), meta: { requestId: c.get('requestId') } }, 201);
  });
  app.put('/v1/locker-room/teams/:id', requireProfile, idempotency, async (c) => {
    const db = getDb(c);
    const owner = getSessionOrThrow(c).profileId;
    const input = parseWithAppError(SaveTeamSchema, jsonBody(c.get('rawBody')));
    const players = await lockerPlayers(db, owner);
    validateLineup(input, players);
    const [row] = await db
      .update(lockerTeams)
      .set({
        name: input.name,
        formation: input.formation,
        lineupJson: JSON.stringify(input.lineup),
        revision: input.revision + 1,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(lockerTeams.id, c.req.param('id')),
          eq(lockerTeams.ownerProfileId, owner),
          eq(lockerTeams.revision, input.revision),
        ),
      )
      .returning();
    if (!row)
      throw new AppError({
        code: 'VALIDATION_FAILED',
        status: 409,
        message:
          '팀이 다른 곳에서 변경되었거나 더 이상 내 팀이 아닙니다. 최신 목록을 불러온 뒤 다시 편성해 주세요.',
      });
    return c.json({ data: teamView(row, players), meta: { requestId: c.get('requestId') } });
  });
  app.delete('/v1/locker-room/teams/:id', requireProfile, idempotency, async (c) => {
    const db = getDb(c);
    const owner = getSessionOrThrow(c).profileId;
    await db
      .delete(lockerTeams)
      .where(and(eq(lockerTeams.id, c.req.param('id')), eq(lockerTeams.ownerProfileId, owner)));
    return c.body(null, 204);
  });
}
