import {
  AdvanceAnnualRunSchema,
  ChooseAnnualDecisionSchema,
  CreateServerCareerSchema,
  StartAnnualRunSchema,
} from '@offside/contracts';
import type { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import {
  advanceServerAnnualRun,
  createAnnualCareer,
  getAnnualRun,
  requireAnnualKey,
  startServerAnnualRun,
} from '../annual-career.js';
import { annualRuns } from '../db/schema.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';

function json(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? '{}');
  } catch {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: '요청 본문이 올바른 JSON이 아닙니다.',
    });
  }
}
export function registerAnnualCareerRoutes(app: Hono<AppEnv>): void {
  app.post('/v1/careers/server', requireProfile, async (c) => {
    const input = parseWithAppError(CreateServerCareerSchema, json(c.get('rawBody')));
    const data = await createAnnualCareer(
      { d1: c.env.DB, db: getDb(c), session: getSessionOrThrow(c) },
      input,
      c.env.ACTIVE_SERVICE_SEASON_ID ?? '',
      requireAnnualKey(c.req.header('Idempotency-Key')),
    );
    return c.json(
      { data, meta: { requestId: c.get('requestId'), careerRevision: data.snapshot.revision } },
      201,
    );
  });
  app.post('/v1/careers/:id/annual-runs', requireProfile, async (c) => {
    const input = parseWithAppError(StartAnnualRunSchema, json(c.get('rawBody')));
    const data = await startServerAnnualRun(
      { d1: c.env.DB, db: getDb(c), session: getSessionOrThrow(c) },
      c.req.param('id'),
      input,
      requireAnnualKey(c.req.header('Idempotency-Key')),
    );
    return c.json({ data, meta: { requestId: c.get('requestId') } }, 201);
  });
  app.get('/v1/careers/:id/annual-runs/current', requireProfile, async (c) => {
    c.header('Cache-Control', 'no-store');
    const data = await getAnnualRun(
      { d1: c.env.DB, db: getDb(c), session: getSessionOrThrow(c) },
      c.req.param('id'),
    );
    return c.json({ data, meta: { requestId: c.get('requestId') } });
  });
  app.get('/v1/careers/:id/annual-runs/:runId', requireProfile, async (c) => {
    c.header('Cache-Control', 'no-store');
    const data = await getAnnualRun(
      { d1: c.env.DB, db: getDb(c), session: getSessionOrThrow(c) },
      c.req.param('id'),
      c.req.param('runId'),
    );
    return c.json({ data, meta: { requestId: c.get('requestId') } });
  });
  app.get('/v1/careers/:id/annual-reports', requireProfile, async (c) => {
    c.header('Cache-Control', 'no-store');
    const access = { d1: c.env.DB, db: getDb(c), session: getSessionOrThrow(c) };
    await getAnnualRun(access, c.req.param('id'));
    const rows = await access.db
      .select({ id: annualRuns.id, report: annualRuns.reportJson })
      .from(annualRuns)
      .where(eq(annualRuns.careerId, c.req.param('id')))
      .orderBy(desc(annualRuns.createdAt))
      .limit(50);
    return c.json({
      data: {
        reports: rows
          .filter((row) => row.report !== null)
          .map((row) => ({ runId: row.id, report: JSON.parse(row.report!) })),
      },
      meta: { requestId: c.get('requestId') },
    });
  });
  for (const kind of ['advance', 'decisions'] as const)
    app.post(`/v1/careers/:id/annual-runs/:runId/${kind}`, requireProfile, async (c) => {
      const input = parseWithAppError(
        kind === 'advance' ? AdvanceAnnualRunSchema : ChooseAnnualDecisionSchema,
        json(c.get('rawBody')),
      );
      const data = await advanceServerAnnualRun(
        { d1: c.env.DB, db: getDb(c), session: getSessionOrThrow(c) },
        c.req.param('id'),
        c.req.param('runId'),
        input,
        requireAnnualKey(c.req.header('Idempotency-Key')),
      );
      return c.json({ data, meta: { requestId: c.get('requestId') } });
    });
}
