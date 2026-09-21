import {
  CompetitionDailyResponseSchema,
  CompetitionEntrySchema,
  CompetitionScenarioSchema,
  CompetitionWeeklyResponseSchema,
  SubmitCompetitionEntrySchema,
  CompetitionVisibilitySchema,
  type CompetitionEntry,
  type CompetitionScenario,
} from '@offside/contracts';
import { sha256Hex } from '@offside/domain';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { competitionChallengeVersions, competitionEntries } from '../db/schema.js';
import { getAttemptCount, recordAttempt } from '../db/repos/authAttempts.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { idempotency } from '../middleware/idempotency.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

function invalid(message: string, status: 404 | 409 | 422 = 422): never {
  throw new AppError({ code: 'VALIDATION_FAILED', status, message });
}

/** KST has no DST, so shifting before ISO formatting is deterministic in Workers and tests. */
export function kstDayKey(now: Date): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function kstWeekKey(dayKey: string): string {
  const date = new Date(`${dayKey}T00:00:00Z`);
  if (Number.isNaN(date.valueOf())) throw new Error('Invalid day key');
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

function parseScenario(raw: string): CompetitionScenario {
  try {
    return parseWithAppError(CompetitionScenarioSchema, JSON.parse(raw));
  } catch {
    invalid('오늘의 도전 구성을 확인할 수 없습니다.', 404);
  }
}

function challengeView(row: typeof competitionChallengeVersions.$inferSelect) {
  return {
    id: row.id,
    dayKey: row.dayKey,
    weekKey: row.weekKey,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    rulesetVersion: row.rulesetVersion,
    contentPackVersion: row.contentPackVersion,
    scoringPolicyVersion: row.scoringPolicyVersion,
    scenario: parseScenario(row.scenarioJson),
  };
}

function entryView(
  row: typeof competitionEntries.$inferSelect,
  challenge: typeof competitionChallengeVersions.$inferSelect,
): CompetitionEntry {
  return CompetitionEntrySchema.parse({
    challengeId: challenge.id,
    dayKey: challenge.dayKey,
    weekKey: challenge.weekKey,
    actionIds: JSON.parse(row.actionIdsJson),
    score: row.score,
    maxScore: row.maxScore,
    verificationStatus: row.verificationStatus,
    resultHash: row.resultHash,
    publicOptIn: row.publicOptIn === 1,
    submittedAt: row.submittedAt,
    proof: {
      method: 'SERVER_REPLAY',
      rulesetVersion: challenge.rulesetVersion,
      contentPackVersion: challenge.contentPackVersion,
      scoringPolicyVersion: challenge.scoringPolicyVersion,
    },
  });
}

function ensureOpen(
  row: typeof competitionChallengeVersions.$inferSelect,
  now: Date,
  dayKey = kstDayKey(now),
) {
  if (row.dayKey !== dayKey) invalid('지난 도전은 새 기록을 제출할 수 없습니다.', 409);
  if (now < new Date(row.startsAt) || now >= new Date(row.endsAt))
    invalid('오늘의 도전 제출 시간이 아닙니다.', 409);
  if (row.rulesetVersion !== '3.3.0' || row.contentPackVersion !== '0.12.0')
    invalid('현재 도전 버전이 준비되지 않았습니다.', 409);
}

function resolveScenario(scenario: CompetitionScenario, actionIds: string[]) {
  if (actionIds.length !== scenario.steps.length) invalid('모든 경기 장면을 선택해 주세요.');
  const selected = scenario.steps.map((step, index) => {
    const actionId = actionIds[index];
    const choice = step.choices.find((candidate) => candidate.id === actionId);
    if (!choice) invalid('허용되지 않은 경기 선택입니다.');
    return { stepId: step.id, actionId, points: choice.points, outcome: choice.outcome };
  });
  const maxScore = scenario.steps.reduce(
    (sum, step) => sum + Math.max(...step.choices.map((choice) => choice.points)),
    0,
  );
  const score = selected.reduce((sum, choice) => sum + choice.points, 0);
  return { score, maxScore, selected };
}

function publicAlias(owner: string, weekKey: string): string {
  return `선수-${sha256Hex(`${weekKey}:${owner}`).slice(0, 8).toUpperCase()}`;
}

async function rateLimit(db: ReturnType<typeof getDb>, owner: string, now: string) {
  await recordAttempt(db, 'COMPETITION_ENTRY', owner, now, 60_000);
  if ((await getAttemptCount(db, 'COMPETITION_ENTRY', owner, now, 60_000)) > 10)
    throw new AppError({ code: 'RATE_LIMITED', message: '잠시 후 다시 도전해 주세요.' });
}

export function registerCompetitionRoutes(app: Hono<AppEnv>) {
  app.get('/v1/competition/daily', requireProfile, async (c) => {
    const db = getDb(c);
    const owner = getSessionOrThrow(c).profileId;
    const now = new Date();
    const dayKey = kstDayKey(now);
    const [challenge] = await db
      .select()
      .from(competitionChallengeVersions)
      .where(eq(competitionChallengeVersions.dayKey, dayKey));
    if (!challenge) invalid('오늘의 도전이 아직 열리지 않았습니다.', 404);
    const [entry] = await db
      .select()
      .from(competitionEntries)
      .where(
        and(
          eq(competitionEntries.ownerProfileId, owner),
          eq(competitionEntries.challengeVersionId, challenge.id),
        ),
      );
    return c.json({
      data: CompetitionDailyResponseSchema.parse({
        challenge: challengeView(challenge),
        entry: entry ? entryView(entry, challenge) : null,
      }),
      meta: { requestId: c.get('requestId') },
    });
  });

  app.post(
    '/v1/competition/challenges/:challengeId/entries',
    requireProfile,
    idempotency,
    async (c) => {
      const requestKey = c.req.header('Idempotency-Key');
      if (!requestKey || !/^[A-Za-z0-9_-]{8,128}$/.test(requestKey))
        invalid('Idempotency-Key가 필요합니다.');
      const input = parseWithAppError(
        SubmitCompetitionEntrySchema,
        JSON.parse(c.get('rawBody') ?? '{}'),
      );
      const db = getDb(c);
      const owner = getSessionOrThrow(c).profileId;
      const now = new Date();
      const nowText = now.toISOString();
      const challengeId = c.req.param('challengeId');
      const [challenge] = await db
        .select()
        .from(competitionChallengeVersions)
        .where(eq(competitionChallengeVersions.id, challengeId));
      if (!challenge) invalid('도전 버전을 찾을 수 없습니다.', 404);
      ensureOpen(challenge, now);
      const requestKeyHash = sha256Hex(
        JSON.stringify(['COMPETITION_V1', owner, challengeId, requestKey]),
      );
      const requestHash = sha256Hex(JSON.stringify([challengeId, input]));
      const replay = async () => {
        const [saved] = await db
          .select()
          .from(competitionEntries)
          .where(eq(competitionEntries.requestKeyHash, requestKeyHash));
        if (!saved) return null;
        if (saved.requestHash !== requestHash)
          invalid('같은 요청 키로 다른 도전을 제출할 수 없습니다.', 409);
        return entryView(saved, challenge);
      };
      const previous = await replay();
      if (previous) return c.json({ data: previous, meta: { requestId: c.get('requestId') } }, 201);
      await rateLimit(db, owner, nowText);
      const [existing] = await db
        .select()
        .from(competitionEntries)
        .where(
          and(
            eq(competitionEntries.ownerProfileId, owner),
            eq(competitionEntries.challengeVersionId, challenge.id),
          ),
        );
      if (existing) invalid('오늘의 도전은 이미 제출했습니다.', 409);
      const scenario = parseScenario(challenge.scenarioJson);
      const resolved = resolveScenario(scenario, input.actionIds);
      const result = {
        actionIds: input.actionIds,
        score: resolved.score,
        maxScore: resolved.maxScore,
        selected: resolved.selected,
      };
      const resultHash = sha256Hex(JSON.stringify(result));
      const row = {
        id: crypto.randomUUID(),
        challengeVersionId: challenge.id,
        ownerProfileId: owner,
        requestKeyHash,
        requestHash,
        actionIdsJson: JSON.stringify(input.actionIds),
        resultJson: JSON.stringify(result),
        resultHash,
        score: resolved.score,
        maxScore: resolved.maxScore,
        verificationStatus: 'VERIFIED' as const,
        publicOptIn: input.publicOptIn ? 1 : 0,
        publicAlias: publicAlias(owner, challenge.weekKey),
        submittedAt: nowText,
      };
      try {
        await db.insert(competitionEntries).values(row);
      } catch (error) {
        const winner = await replay();
        if (winner) return c.json({ data: winner, meta: { requestId: c.get('requestId') } }, 201);
        const [duplicate] = await db
          .select()
          .from(competitionEntries)
          .where(
            and(
              eq(competitionEntries.ownerProfileId, owner),
              eq(competitionEntries.challengeVersionId, challenge.id),
            ),
          );
        if (duplicate) invalid('오늘의 도전은 이미 제출했습니다.', 409);
        throw error;
      }
      return c.json(
        { data: entryView(row, challenge), meta: { requestId: c.get('requestId') } },
        201,
      );
    },
  );

  app.get('/v1/competition/weekly', async (c) => {
    const queryWeek = c.req.query('weekKey');
    const weekKey = queryWeek ?? kstWeekKey(kstDayKey(new Date()));
    if (!DAY_KEY.test(weekKey)) invalid('주간 키가 올바르지 않습니다.');
    const db = getDb(c);
    const rows = await db
      .select({ entry: competitionEntries, challenge: competitionChallengeVersions })
      .from(competitionEntries)
      .innerJoin(
        competitionChallengeVersions,
        eq(competitionChallengeVersions.id, competitionEntries.challengeVersionId),
      )
      .where(
        and(
          eq(competitionChallengeVersions.weekKey, weekKey),
          eq(competitionEntries.verificationStatus, 'VERIFIED'),
          eq(competitionEntries.publicOptIn, 1),
        ),
      )
      .orderBy(desc(competitionEntries.score), asc(competitionEntries.submittedAt));
    const totals = new Map<
      string,
      {
        alias: string;
        score: number;
        maxScore: number;
        days: number;
        proof: CompetitionEntry['proof'];
      }
    >();
    for (const row of rows) {
      const existing = totals.get(row.entry.ownerProfileId);
      if (existing) {
        existing.score += row.entry.score;
        existing.maxScore += row.entry.maxScore;
        existing.days += 1;
      } else {
        totals.set(row.entry.ownerProfileId, {
          alias: row.entry.publicAlias,
          score: row.entry.score,
          maxScore: row.entry.maxScore,
          days: 1,
          proof: {
            method: 'SERVER_REPLAY',
            rulesetVersion: row.challenge.rulesetVersion,
            contentPackVersion: row.challenge.contentPackVersion,
            scoringPolicyVersion: row.challenge.scoringPolicyVersion,
          },
        });
      }
    }
    const ordered = [...totals.values()]
      .sort((a, b) => b.score - a.score || b.days - a.days || a.alias.localeCompare(b.alias))
      .slice(0, 100);
    const result = ordered.map((row, index) => ({
      rank: index > 0 && row.score === ordered[index - 1]!.score ? index : index + 1,
      alias: row.alias,
      score: row.score,
      maxScore: row.maxScore,
      challengeDays: row.days,
      proof: row.proof,
    }));
    return c.json({
      data: CompetitionWeeklyResponseSchema.parse({ weekKey, rows: result }),
      meta: { requestId: c.get('requestId') },
    });
  });

  app.put('/v1/competition/leaderboard/visibility', requireProfile, idempotency, async (c) => {
    const input = parseWithAppError(
      CompetitionVisibilitySchema,
      JSON.parse(c.get('rawBody') ?? '{}'),
    );
    const owner = getSessionOrThrow(c).profileId;
    await getDb(c)
      .update(competitionEntries)
      .set({ publicOptIn: input.publicOptIn ? 1 : 0 })
      .where(eq(competitionEntries.ownerProfileId, owner));
    return c.json({ data: input, meta: { requestId: c.get('requestId') } });
  });
}
