import {
  BalanceConfigSchema,
  BalanceDraftInputSchema,
  BalanceVersionListSchema,
  BalanceVersionParamSchema,
  BalanceVersionSchema,
  successEnvelope,
} from '@offside/contracts';
import type { Context, Hono } from 'hono';
import { requireAdmin } from '../auth/admin.js';
import {
  activateBalance,
  createBalanceDraft,
  deleteBalanceDraft,
  getActiveBalance,
  getBalanceVersion,
  listBalanceVersions,
  updateBalanceDraft,
} from '../db/repos/balance.js';
import { edgeCached, purgeEdge } from '../edgeCache.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseJsonBody, parseWithAppError } from '../errors.js';

// T-10-016 서버 밸런스 설정. 게임은 GET /v1/balance를 앱을 열 때 한 번 받고, 새 버전은 각 커리어의
// 다음 시즌 시작부터 적용한다. 관리자는 초안을 만들고 고친 뒤 활성화한다(되돌리기 = 옛 버전 재활성화).
const PUBLIC_PATH = '/v1/balance';
const PUBLIC_TTL = 60;

const envelope = (c: Context<AppEnv>, data: unknown) => ({ data, meta: { requestId: c.get('requestId') } });
const versionParam = (c: Context<AppEnv>) => parseWithAppError(BalanceVersionParamSchema, c.req.param('version'));
const draftInput = (c: Context<AppEnv>) => parseWithAppError(BalanceDraftInputSchema, parseJsonBody(c.get('rawBody') ?? ''));
const nowIso = () => new Date().toISOString();

const notFound = () =>
  new AppError({ code: 'VALIDATION_FAILED', status: 404, message: '밸런스 버전을 찾을 수 없습니다.', details: { reason: 'BALANCE_NOT_FOUND' } });
const notDraft = () =>
  new AppError({ code: 'VALIDATION_FAILED', status: 409, message: '초안만 고치거나 지울 수 있습니다. 복제해서 새 초안을 만드세요.', details: { reason: 'BALANCE_NOT_DRAFT' } });

async function versionOr404(c: Context<AppEnv>, version: number) {
  const v = await getBalanceVersion(getDb(c), version);
  if (!v) throw notFound();
  return v;
}

export function registerBalanceRoutes(app: Hono<AppEnv>): void {
  app.get(PUBLIC_PATH, async (c) => {
    const data = await edgeCached(c, PUBLIC_PATH, PUBLIC_TTL, async () => {
      const active = await getActiveBalance(getDb(c));
      return active ? { version: active.version, values: active.values, activatedAt: active.activatedAt } : { version: 0, values: {}, activatedAt: null };
    });
    return c.json(successEnvelope(BalanceConfigSchema).parse(envelope(c, data)), 200);
  });

  app.get('/v1/admin/balance', async (c) => {
    await requireAdmin(c);
    const versions = await listBalanceVersions(getDb(c));
    return c.json(successEnvelope(BalanceVersionListSchema).parse(envelope(c, { versions })), 200);
  });

  app.post('/v1/admin/balance', async (c) => {
    const viewer = await requireAdmin(c);
    const input = draftInput(c);
    const version = await createBalanceDraft(getDb(c), input, viewer.profileId!, nowIso());
    return c.json(successEnvelope(BalanceVersionSchema).parse(envelope(c, await versionOr404(c, version))), 201);
  });

  app.put('/v1/admin/balance/:version', async (c) => {
    const version = versionParam(c);
    await requireAdmin(c);
    const input = draftInput(c);
    if (!(await updateBalanceDraft(getDb(c), version, input, nowIso()))) {
      await versionOr404(c, version);
      throw notDraft();
    }
    return c.json(successEnvelope(BalanceVersionSchema).parse(envelope(c, await versionOr404(c, version))), 200);
  });

  app.delete('/v1/admin/balance/:version', async (c) => {
    const version = versionParam(c);
    await requireAdmin(c);
    if (!(await deleteBalanceDraft(getDb(c), version))) {
      await versionOr404(c, version);
      throw notDraft();
    }
    return c.body(null, 204);
  });

  app.post('/v1/admin/balance/:version/activate', async (c) => {
    const version = versionParam(c);
    const viewer = await requireAdmin(c);
    const db = getDb(c);
    const [target, active] = await Promise.all([versionOr404(c, version), getActiveBalance(db)]);
    if (target.status !== 'active') {
      await activateBalance(db, version, active?.version ?? null, viewer.profileId!, nowIso());
      purgeEdge(c, [PUBLIC_PATH]);
    }
    return c.json(successEnvelope(BalanceVersionSchema).parse(envelope(c, await versionOr404(c, version))), 200);
  });
}
