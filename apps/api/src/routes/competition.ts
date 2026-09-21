import {
  CompetitionActionResponseSchema,
  CompetitionChallengeSchema,
  CompetitionDailyResponseSchema,
  CompetitionEntrySchema,
  CompetitionHistoryResponseSchema,
  CompetitionScenarioSchema,
  CompetitionVisibilitySchema,
  CompetitionWeeklyResponseSchema,
  SubmitCompetitionActionSchema,
  type CompetitionEntry,
  type CompetitionScenario,
} from '@offside/contracts';
import {
  applyCompetitionAction,
  buildCompetitionMatchDefinition,
  compareCodePoints,
  COMPETITION_CHOICE_STEPS,
  initialCompetitionActionState,
  playCompetitionMatch,
  type CompetitionActionState,
  type CompetitionMatchDefinition,
} from '@offside/domain';
import { loadRuleset } from '@offside/content';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { competitionActions, competitionChallengeVersions, competitionEntries } from '../db/schema.js';
import { runBatch } from '../db/repos/batch.js';
import { getAttemptCount, recordAttempt } from '../db/repos/authAttempts.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { idempotency } from '../middleware/idempotency.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { sha256Hex } from '../db/hash.js';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const RULESET_VERSION = '3.3.0';
const CONTENT_PACK_VERSION = '0.12.0';
const SCORING_POLICY_VERSION = 'MATCH_EVIDENCE_V1';

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

type StoredChallenge = { definition: CompetitionMatchDefinition; scenario: CompetitionScenario };

function parseStoredChallenge(raw: string): StoredChallenge {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object') throw new Error('not object');
    const candidate = value as { definition?: CompetitionMatchDefinition; scenario?: unknown };
    if (!candidate.definition || !candidate.scenario) throw new Error('missing fields');
    const scenario = parseWithAppError(CompetitionScenarioSchema, candidate.scenario);
    return { definition: candidate.definition, scenario };
  } catch {
    invalid('오늘의 도전 구성을 확인할 수 없습니다.', 404);
  }
}

function challengeView(row: typeof competitionChallengeVersions.$inferSelect) {
  const stored = parseStoredChallenge(row.scenarioJson);
  return CompetitionChallengeSchema.parse({
    id: row.id,
    dayKey: row.dayKey,
    weekKey: row.weekKey,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    rulesetVersion: row.rulesetVersion,
    contentPackVersion: row.contentPackVersion,
    scoringPolicyVersion: row.scoringPolicyVersion,
    scenario: stored.scenario,
  });
}

function entryView(
  row: typeof competitionEntries.$inferSelect,
  challenge: typeof competitionChallengeVersions.$inferSelect,
): CompetitionEntry {
  const result = row.resultJson ? (JSON.parse(row.resultJson) as { match?: { appearance: 'START' | 'SUB' | 'OUT'; minutes: number; ratingTenths: number | null; result: { outcome: 'WIN' | 'DRAW' | 'LOSS' }; stats: Record<string, string | number | boolean> } }) : null;
  const match = result?.match;
  return CompetitionEntrySchema.parse({
    challengeId: challenge.id,
    dayKey: challenge.dayKey,
    weekKey: challenge.weekKey,
    actionIds: JSON.parse(row.actionIdsJson),
    revision: row.revision,
    completed: row.verificationStatus === 'VERIFIED',
    score: row.score,
    maxScore: row.maxScore,
    verificationStatus: row.verificationStatus,
    resultHash: row.resultHash,
    publicOptIn: row.publicOptIn === 1,
    submittedAt: row.submittedAt,
    evidence: match ? { appearance: match.appearance, minutes: match.minutes, ratingTenths: match.ratingTenths, outcome: match.result.outcome, positionStats: match.stats } : null,
    proof: {
      method: 'SERVER_MATCH',
      rulesetVersion: challenge.rulesetVersion,
      contentPackVersion: challenge.contentPackVersion,
      scoringPolicyVersion: challenge.scoringPolicyVersion,
    },
  });
}

function ensureOpen(row: typeof competitionChallengeVersions.$inferSelect, now: Date) {
  if (row.dayKey !== kstDayKey(now)) invalid('지난 도전은 새 기록을 제출할 수 없습니다.', 409);
  if (now < new Date(row.startsAt) || now >= new Date(row.endsAt))
    invalid('오늘의 도전 제출 시간이 아닙니다.', 409);
  if (row.rulesetVersion !== RULESET_VERSION || row.contentPackVersion !== CONTENT_PACK_VERSION)
    invalid('현재 도전 버전이 준비되지 않았습니다.', 409);
}

async function publicAlias(owner: string, weekKey: string): Promise<string> {
  return `선수-${(await sha256Hex(`${weekKey}:${owner}`)).slice(0, 8).toUpperCase()}`;
}

async function rateLimit(db: ReturnType<typeof getDb>, owner: string, now: string) {
  await recordAttempt(db, 'COMPETITION_ENTRY', owner, now, 60_000);
  if ((await getAttemptCount(db, 'COMPETITION_ENTRY', owner, now, 60_000)) > 12)
    throw new AppError({ code: 'RATE_LIMITED', message: '잠시 후 다시 도전해 주세요.' });
}

function toScenario(definition: CompetitionMatchDefinition, ruleset: ReturnType<typeof loadRuleset>): CompetitionScenario {
  const opponent = ruleset.teams.find((team) => team.id === definition.opponentId);
  const opponentName = opponent?.name ?? definition.opponentId;
  return {
    title: '오늘의 경기 운영',
    intro: '같은 포지션·상대·선수 조건에서 세 번의 판단을 내리고 실제 경기 기록으로 결과를 확인합니다. 5분 안에 끝나는 짧은 경기 도전입니다.',
    position: definition.position,
    opponentName,
    steps: COMPETITION_CHOICE_STEPS.map((step) => ({
      id: step.id,
      title: step.title,
      prompt: step.prompt,
      choices: step.choices.map(([id, label, description]) => ({ id, label, description })),
    })),
    scorePolicy: {
      version: SCORING_POLICY_VERSION,
      description: '하루 1회, 세 행동을 서버가 고정된 경기 입력으로 계산합니다. 0~400점은 출전 시간+평점+포지션별 기록(공격·창출·수비·선방, 불리한 기록 차감)으로 산출되며 선택별 점수나 결과는 미리 공개하지 않습니다.',
    },
  };
}

async function ensureDailyChallenge(
  db: ReturnType<typeof getDb>,
  dayKey: string,
): Promise<typeof competitionChallengeVersions.$inferSelect> {
  const ruleset = loadRuleset(RULESET_VERSION);
  const definition = buildCompetitionMatchDefinition(ruleset, dayKey);
  const scenario = toScenario(definition, ruleset);
  const startsAt = new Date(`${dayKey}T00:00:00+09:00`);
  const endsAt = new Date(startsAt.getTime() + 86_400_000);
  await db
    .insert(competitionChallengeVersions)
    .values({
      id: `daily-${dayKey}`,
      dayKey,
      weekKey: kstWeekKey(dayKey),
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      rulesetVersion: RULESET_VERSION,
      contentPackVersion: CONTENT_PACK_VERSION,
      scoringPolicyVersion: SCORING_POLICY_VERSION,
      scenarioJson: JSON.stringify({ definition, scenario }),
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing({ target: competitionChallengeVersions.dayKey });
  const [row] = await db
    .select()
    .from(competitionChallengeVersions)
    .where(eq(competitionChallengeVersions.dayKey, dayKey));
  if (!row) invalid('오늘의 도전이 아직 열리지 않았습니다.', 404);
  return row;
}

async function ensureEntry(
  db: ReturnType<typeof getDb>,
  owner: string,
  challenge: typeof competitionChallengeVersions.$inferSelect,
  definition: CompetitionMatchDefinition,
) {
  const [existing] = await db
    .select()
    .from(competitionEntries)
    .where(and(eq(competitionEntries.ownerProfileId, owner), eq(competitionEntries.challengeVersionId, challenge.id)));
  if (existing) return existing;
  try {
    await db.insert(competitionEntries).values({
      id: crypto.randomUUID(),
      challengeVersionId: challenge.id,
      ownerProfileId: owner,
      actionIdsJson: '[]',
      revision: 0,
      stateJson: JSON.stringify(initialCompetitionActionState(definition)),
      resultJson: null,
      resultHash: null,
      score: null,
      maxScore: null,
      verificationStatus: 'IN_PROGRESS',
      publicOptIn: 0,
      publicAlias: await publicAlias(owner, challenge.weekKey),
      submittedAt: null,
    });
  } catch {
    // The profile/day unique index is the admission lock; read its deterministic winner.
  }
  const [created] = await db
    .select()
    .from(competitionEntries)
    .where(and(eq(competitionEntries.ownerProfileId, owner), eq(competitionEntries.challengeVersionId, challenge.id)));
  if (!created) throw new AppError({ code: 'SERVICE_UNAVAILABLE', message: '도전 상태를 만들 수 없습니다.' });
  return created;
}

async function replayAction(db: ReturnType<typeof getDb>, requestKeyHash: string, requestHash: string) {
  const [saved] = await db.select().from(competitionActions).where(eq(competitionActions.requestKeyHash, requestKeyHash));
  if (!saved) return null;
  if (saved.requestHash !== requestHash) invalid('같은 요청 키로 다른 행동을 제출할 수 없습니다.', 409);
  return CompetitionActionResponseSchema.parse(JSON.parse(saved.responseJson));
}

export function registerCompetitionRoutes(app: Hono<AppEnv>) {
  app.get('/v1/competition/daily', requireProfile, async (c) => {
    const db = getDb(c);
    const owner = getSessionOrThrow(c).profileId;
    const now = new Date();
    const requestedDay = c.req.query('dayKey');
    const dayKey = requestedDay ?? kstDayKey(now);
    if (!DAY_KEY.test(dayKey)) invalid('일자 키가 올바르지 않습니다.');
    const currentDay = kstDayKey(now);
    if (dayKey > currentDay) invalid('아직 열리지 않은 도전입니다.', 409);
    const challenge = dayKey === currentDay
      ? await ensureDailyChallenge(db, dayKey)
      : (await db.select().from(competitionChallengeVersions).where(eq(competitionChallengeVersions.dayKey, dayKey)))[0];
    if (!challenge) invalid('지난 도전 구성을 확인할 수 없습니다.', 404);
    const [entry] = await db
      .select()
      .from(competitionEntries)
      .where(and(eq(competitionEntries.ownerProfileId, owner), eq(competitionEntries.challengeVersionId, challenge.id)));
    return c.json({ data: CompetitionDailyResponseSchema.parse({ challenge: challengeView(challenge), entry: entry ? entryView(entry, challenge) : null }), meta: { requestId: c.get('requestId') } });
  });

  app.get('/v1/competition/history', requireProfile, async (c) => {
    const owner = getSessionOrThrow(c).profileId;
    const db = getDb(c);
    const rows = await db
      .select({ entry: competitionEntries, challenge: competitionChallengeVersions })
      .from(competitionEntries)
      .innerJoin(competitionChallengeVersions, eq(competitionChallengeVersions.id, competitionEntries.challengeVersionId))
      .where(eq(competitionEntries.ownerProfileId, owner))
      .orderBy(desc(competitionChallengeVersions.dayKey))
      .limit(366);
    return c.json({ data: CompetitionHistoryResponseSchema.parse({ entries: rows.map((row) => entryView(row.entry, row.challenge)) }), meta: { requestId: c.get('requestId') } });
  });

  app.post('/v1/competition/challenges/:challengeId/actions', requireProfile, idempotency, async (c) => {
    const requestKey = c.req.header('Idempotency-Key');
    if (!requestKey || !/^[A-Za-z0-9_-]{8,128}$/.test(requestKey)) invalid('Idempotency-Key가 필요합니다.');
    const input = parseWithAppError(SubmitCompetitionActionSchema, JSON.parse(c.get('rawBody') ?? '{}'));
    const db = getDb(c);
    const owner = getSessionOrThrow(c).profileId;
    const now = new Date();
    let [challenge] = await db.select().from(competitionChallengeVersions).where(eq(competitionChallengeVersions.id, c.req.param('challengeId')));
    if (!challenge && c.req.param('challengeId') === `daily-${kstDayKey(now)}`) {
      challenge = await ensureDailyChallenge(db, kstDayKey(now));
    }
    if (!challenge) invalid('도전 버전을 찾을 수 없습니다.', 404);
    ensureOpen(challenge, now);
    const stored = parseStoredChallenge(challenge.scenarioJson);
    const requestKeyHash = await sha256Hex(JSON.stringify(['COMPETITION_MATCH_V1', owner, challenge.id, requestKey]));
    const requestHash = await sha256Hex(JSON.stringify([challenge.id, input]));
    const replay = await replayAction(db, requestKeyHash, requestHash);
    if (replay) return c.json({ data: replay, meta: { requestId: c.get('requestId') } }, 200);
    await rateLimit(db, owner, now.toISOString());
    const entry = await ensureEntry(db, owner, challenge, stored.definition);
    if (entry.verificationStatus === 'VERIFIED') invalid('오늘의 도전은 이미 제출했습니다.', 409);
    if (entry.revision !== input.expectedRevision) {
      throw new AppError({ code: 'CAREER_REVISION_CONFLICT', status: 409, message: '도전 상태가 바뀌었습니다.', details: { serverRevision: entry.revision, expectedRevision: input.expectedRevision } });
    }
    const stepIndex = entry.actionIdsJson === '[]' ? 0 : (JSON.parse(entry.actionIdsJson) as string[]).length;
    const step = stored.scenario.steps[stepIndex];
    if (!step) invalid('오늘의 도전은 이미 모든 장면을 마쳤습니다.', 409);
    if (!step.choices.some((choice) => choice.id === input.actionId)) invalid('허용되지 않은 경기 선택입니다.');
    const state = JSON.parse(entry.stateJson) as CompetitionActionState;
    const nextState = applyCompetitionAction(stored.definition, state, input.actionId);
    const actionIds = [...state.actionIds, input.actionId];
    const nextRevision = entry.revision + 1;
    const complete = nextRevision === stored.scenario.steps.length;
    let score: number | null = null;
    let maxScore: number | null = null;
    let resultHash: string | null = null;
    let resultJson: string | null = null;
    let submittedAt: string | null = null;
    if (complete) {
      const result = playCompetitionMatch(loadRuleset(challenge.rulesetVersion), stored.definition, nextState);
      score = result.score;
      maxScore = result.maxScore;
      resultJson = JSON.stringify({ actionIds, match: result.match, score, maxScore });
      resultHash = await sha256Hex(resultJson);
      submittedAt = now.toISOString();
    }
    const nextRow = {
      ...entry,
      revision: nextRevision,
      actionIdsJson: JSON.stringify(actionIds),
      stateJson: JSON.stringify(nextState),
      resultJson,
      resultHash,
      score,
      maxScore,
      verificationStatus: complete ? 'VERIFIED' as const : 'IN_PROGRESS' as const,
      submittedAt,
    };
    const response = {
      entry: entryView(nextRow, challenge),
      nextStepIndex: complete ? stored.scenario.steps.length : nextRevision,
    };
    try {
      await runBatch(db, [
        db.update(competitionEntries).set({
          revision: nextRevision,
          actionIdsJson: JSON.stringify(actionIds),
          stateJson: JSON.stringify(nextState),
          resultJson,
          resultHash,
          score,
          maxScore,
          verificationStatus: complete ? 'VERIFIED' : 'IN_PROGRESS',
          submittedAt,
        }).where(and(eq(competitionEntries.id, entry.id), eq(competitionEntries.revision, input.expectedRevision))),
        db.insert(competitionActions).values({
          id: crypto.randomUUID(),
          entryId: entry.id,
          revision: nextRevision,
          actionId: input.actionId,
          expectedRevision: input.expectedRevision,
          requestKeyHash,
          requestHash,
          responseJson: JSON.stringify(response),
          createdAt: now.toISOString(),
        }),
      ]);
    } catch {
      const retry = await replayAction(db, requestKeyHash, requestHash);
      if (retry) return c.json({ data: retry, meta: { requestId: c.get('requestId') } }, 200);
      throw new AppError({ code: 'CAREER_REVISION_CONFLICT', status: 409, message: '동시에 제출된 다른 행동이 먼저 반영되었습니다.' });
    }
    return c.json({ data: response, meta: { requestId: c.get('requestId') } }, complete ? 201 : 200);
  });

  app.get('/v1/competition/weekly', async (c) => {
    const queryWeek = c.req.query('weekKey');
    const weekKey = queryWeek ?? kstWeekKey(kstDayKey(new Date()));
    if (!DAY_KEY.test(weekKey)) invalid('주간 키가 올바르지 않습니다.');
    const db = getDb(c);
    const rows = await db.select({ entry: competitionEntries, challenge: competitionChallengeVersions }).from(competitionEntries)
      .innerJoin(competitionChallengeVersions, eq(competitionChallengeVersions.id, competitionEntries.challengeVersionId))
      .where(and(eq(competitionChallengeVersions.weekKey, weekKey), eq(competitionEntries.verificationStatus, 'VERIFIED'), eq(competitionEntries.publicOptIn, 1)))
      .orderBy(desc(competitionEntries.score), asc(competitionEntries.submittedAt));
    const totals = new Map<string, { alias: string; score: number; maxScore: number; days: number; proof: CompetitionEntry['proof'] }>();
    for (const row of rows) {
      if (row.entry.score === null || row.entry.maxScore === null) continue;
      const existing = totals.get(row.entry.ownerProfileId);
      if (existing) { existing.score += row.entry.score; existing.maxScore += row.entry.maxScore; existing.days += 1; }
      else totals.set(row.entry.ownerProfileId, { alias: row.entry.publicAlias, score: row.entry.score, maxScore: row.entry.maxScore, days: 1, proof: { method: 'SERVER_MATCH', rulesetVersion: row.challenge.rulesetVersion, contentPackVersion: row.challenge.contentPackVersion, scoringPolicyVersion: row.challenge.scoringPolicyVersion } });
    }
    const ordered = [...totals.values()].sort((a, b) => b.score - a.score || b.days - a.days || compareCodePoints(a.alias, b.alias)).slice(0, 100);
    let previousScore: number | null = null;
    let previousRank = 0;
    const result = ordered.map((row, index) => {
      if (previousScore === null || row.score !== previousScore) previousRank = index + 1;
      previousScore = row.score;
      return { rank: previousRank, alias: row.alias, score: row.score, maxScore: row.maxScore, challengeDays: row.days, proof: row.proof };
    });
    return c.json({ data: CompetitionWeeklyResponseSchema.parse({ weekKey, rows: result }), meta: { requestId: c.get('requestId') } });
  });

  app.put('/v1/competition/leaderboard/visibility', requireProfile, idempotency, async (c) => {
    const input = parseWithAppError(CompetitionVisibilitySchema, JSON.parse(c.get('rawBody') ?? '{}'));
    const owner = getSessionOrThrow(c).profileId;
    await getDb(c).update(competitionEntries).set({ publicOptIn: input.publicOptIn ? 1 : 0 }).where(eq(competitionEntries.ownerProfileId, owner));
    return c.json({ data: input, meta: { requestId: c.get('requestId') } });
  });
}
