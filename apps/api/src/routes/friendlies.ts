import {
  CareerStateSchema,
  FormationSchema,
  FriendlyHistorySchema,
  FriendlyReceiptSchema,
  LineupSchema,
  StartFriendlySchema,
  type FriendlyReceipt,
} from '@offside/contracts';
import { loadRetirementArtifacts } from '@offside/content';
import {
  planCareerArchiveWrite,
  sha256Hex,
  simulateFriendly,
  type CareerArchiveCore,
  type FriendlyPlayer,
} from '@offside/domain';
import { and, desc, eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { careerArchives, careers, friendlyMatches, lockerTeams } from '../db/schema.js';
import { getAttemptCount, recordAttempt } from '../db/repos/authAttempts.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';

function invalid(message: string, status: 404 | 409 | 422 = 422): never {
  throw new AppError({ code: 'VALIDATION_FAILED', status, message });
}
function parseBody(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? '{}');
  } catch {
    return invalid('요청 본문이 올바르지 않습니다.');
  }
}
export function registerFriendlyRoutes(app: Hono<AppEnv>) {
  app.get('/v1/locker-room/friendlies', requireProfile, async (c) => {
    c.header('Cache-Control', 'no-store');
    const rows = await getDb(c)
      .select()
      .from(friendlyMatches)
      .where(eq(friendlyMatches.ownerProfileId, getSessionOrThrow(c).profileId))
      .orderBy(desc(friendlyMatches.createdAt), desc(friendlyMatches.id))
      .limit(50);
    return c.json({
      data: FriendlyHistorySchema.parse({
        matches: rows.map((row) => JSON.parse(row.receiptJson) as unknown),
      }),
      meta: { requestId: c.get('requestId') },
    });
  });
  app.get('/v1/locker-room/friendlies/:id', requireProfile, async (c) => {
    c.header('Cache-Control', 'no-store');
    const [row] = await getDb(c)
      .select()
      .from(friendlyMatches)
      .where(
        and(
          eq(friendlyMatches.id, c.req.param('id')),
          eq(friendlyMatches.ownerProfileId, getSessionOrThrow(c).profileId),
        ),
      );
    if (!row) invalid('친선 경기 기록을 찾을 수 없습니다.', 404);
    return c.json({
      data: FriendlyReceiptSchema.parse(JSON.parse(row.receiptJson)),
      meta: { requestId: c.get('requestId') },
    });
  });
  // The receipt and unique request guard are the SAME INSERT, so parallel starts cannot create two matches.
  app.post('/v1/locker-room/teams/:id/friendlies', requireProfile, async (c) => {
    c.header('Cache-Control', 'no-store');
    const requestKey = c.req.header('Idempotency-Key');
    if (!requestKey || !/^[A-Za-z0-9_-]{8,128}$/.test(requestKey))
      invalid('Idempotency-Key가 필요합니다.');
    const input = parseWithAppError(StartFriendlySchema, parseBody(c.get('rawBody')));
    const owner = getSessionOrThrow(c).profileId;
    const db = getDb(c);
    const teamId = c.req.param('id');
    // Keys are profile-scoped. Merging transfers history, not the old session's retry namespace.
    const requestKeyHash = sha256Hex(JSON.stringify(['FRIENDLY_V1', owner, requestKey]));
    const requestHash = sha256Hex(JSON.stringify([teamId, input.revision, input.tactic]));
    const replay = async (): Promise<FriendlyReceipt | null> => {
      const [row] = await db
        .select()
        .from(friendlyMatches)
        .where(eq(friendlyMatches.requestKeyHash, requestKeyHash));
      if (!row) return null;
      if (row.ownerProfileId !== owner) invalid('친선 경기 기록을 찾을 수 없습니다.', 404);
      if (row.requestHash !== requestHash)
        invalid('같은 요청 키로 다른 친선 경기를 시작할 수 없습니다.', 409);
      return FriendlyReceiptSchema.parse(JSON.parse(row.receiptJson));
    };
    const previous = await replay();
    if (previous) return c.json({ data: previous, meta: { requestId: c.get('requestId') } }, 201);
    const now = new Date().toISOString();
    await recordAttempt(db, 'FRIENDLY_START', owner, now, 60_000);
    if ((await getAttemptCount(db, 'FRIENDLY_START', owner, now, 60_000)) > 10)
      throw new AppError({ code: 'RATE_LIMITED', message: '잠시 후 다시 경기를 시작해 주세요.' });
    const [team] = await db
      .select()
      .from(lockerTeams)
      .where(and(eq(lockerTeams.id, teamId), eq(lockerTeams.ownerProfileId, owner)));
    if (!team) invalid('내 저장 팀을 찾을 수 없습니다.', 404);
    if (team.revision !== input.revision)
      invalid('팀 편성이 변경되었습니다. 최신 팀을 불러온 뒤 다시 시작해 주세요.', 409);
    // Linearization point is this complete saved team revision. Later edits never rewrite the receipt.
    const ids = parseWithAppError(LineupSchema, JSON.parse(team.lineupJson) as unknown);
    if (!ids.slice(0, 11).some(Boolean))
      invalid('은퇴 선수 한 명 이상을 선발로 배치해 주세요. 빈 자리는 기본 동료가 채웁니다.');
    const lineup: (FriendlyPlayer | null)[] = [];
    for (const id of ids) {
      if (id === null) {
        lineup.push(null);
        continue;
      }
      const [row] = await db
        .select({ career: careers, archive: careerArchives })
        .from(careers)
        .innerJoin(careerArchives, eq(careers.id, careerArchives.careerId))
        .where(and(eq(careers.id, id), eq(careers.ownerProfileId, owner)));
      if (!row || (row.career.status !== 'RETIRED' && row.career.status !== 'ARCHIVED'))
        invalid(
          '친선 경기는 은퇴 기록이 저장된 내 선수만 참가합니다. 현역 선수는 팀 편성에서 빼 주세요.',
        );
      try {
        const archive = JSON.parse(row.archive.archiveJson) as CareerArchiveCore;
        const validated = planCareerArchiveWrite(archive, archive, {
          binding: {
            careerId: id,
            createdServiceSeasonId: row.career.createdServiceSeasonId,
            rulesetVersion: row.career.rulesetVersion,
            contentPackVersion: row.career.contentPackVersion,
          },
          artifacts: loadRetirementArtifacts(
            row.career.rulesetVersion,
            row.career.contentPackVersion,
          ),
        }).archive;
        if (validated.hash !== row.archive.archiveHash) throw new Error('Archive hash mismatch');
        const state = CareerStateSchema.parse(JSON.parse(validated.source.state));
        if (state.status !== 'RETIRED' || !state.player.profile)
          throw new Error('Retirement required');
        lineup.push({
          id,
          name: state.player.profile.name,
          position: state.player.profile.primaryPosition,
          attributes: state.attributes,
          archiveHash: validated.hash,
        });
      } catch {
        invalid('저장된 은퇴 기록을 확인할 수 없습니다. 원본 기록은 변경하지 않았습니다.');
      }
    }
    const frozen = {
      version: 'FRIENDLY_V1' as const,
      seed: crypto.randomUUID(),
      formation: FormationSchema.parse(team.formation),
      tactic: input.tactic,
      lineup,
    };
    let result;
    try {
      result = simulateFriendly(frozen);
    } catch {
      return invalid('포지션 편성을 확인해 주세요. 골키퍼는 골키퍼 자리에만 선발할 수 있습니다.');
    }
    const receipt = FriendlyReceiptSchema.parse({
      id: crypto.randomUUID(),
      teamId,
      teamName: team.name,
      teamRevision: team.revision,
      createdAt: now,
      input: frozen,
      result,
    });
    try {
      await db
        .insert(friendlyMatches)
        .values({
          id: receipt.id,
          ownerProfileId: owner,
          requestKeyHash,
          requestHash,
          receiptJson: JSON.stringify(receipt),
          createdAt: now,
        });
    } catch (error) {
      const winner = await replay();
      if (winner) return c.json({ data: winner, meta: { requestId: c.get('requestId') } }, 201);
      throw error;
    }
    return c.json({ data: receipt, meta: { requestId: c.get('requestId') } }, 201);
  });
}
