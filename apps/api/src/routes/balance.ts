import {
  BALANCE_HISTORY_LIMIT,
  BalanceConfigSchema,
  BalanceScheduleSchema,
  BalanceHistorySchema,
  BalanceDraftInputSchema,
  BalanceVersionListSchema,
  BalanceVersionParamSchema,
  BalanceVersionSchema,
} from '@offside/contracts';
import type { Context, Hono } from 'hono';
import { activeSeason, displaySeasonAt, teamSeasonAt } from '@offside/contracts/service-seasons';
import { requireAdmin } from '../auth/admin.js';
import {
  activateBalance,
  clearBalanceSchedule,
  createBalanceDraft,
  deleteBalanceDraft,
  getActiveBalance,
  getBalanceSchedule,
  getBalanceVersion,
  listAppliedBalanceVersions,
  listBalanceVersions,
  scheduleBalance,
  updateBalanceDraft,
} from '../db/repos/balance.js';
import { edgeCached, purgeEdge } from '../edgeCache.js';
import { getDb, type AppEnv } from '../env.js';
import { ok, readBody, nowIso, conflictError, notFoundError } from './shared.js';
import { parseWithAppError } from '../errors.js';
import { EDGE, STALE } from '../edgeKeys.js';

// T-10-016 서버 밸런스 설정. 게임은 GET /v1/balance를 앱을 열 때 한 번 받고, 새 버전은 각 커리어의
// 다음 시즌 시작부터 적용한다. 관리자는 초안을 만들고 고친 뒤 활성화한다(되돌리기 = 옛 버전 재활성화).
const PUBLIC_TTL = 60;
const HISTORY_TTL = 600;

const versionParam = (c: Context<AppEnv>) =>
  parseWithAppError(BalanceVersionParamSchema, c.req.param('version'));
const draftInput = (c: Context<AppEnv>) => readBody(c, BalanceDraftInputSchema);

const notFound = () => notFoundError('밸런스 버전을 찾을 수 없어요.', 'BALANCE_NOT_FOUND');
const notDraft = () =>
  conflictError(
    '초안만 고치거나 지울 수 있어요. 복제해서 새 초안을 만들어 주세요.',
    'BALANCE_NOT_DRAFT',
  );

/** T-10-090 시즌 중에는 밸런스를 바꾸지 않는다(시즌 경쟁 조건 고정). */
const seasonLocked = (name: string) =>
  conflictError(
    `${name} 진행 중에는 밸런스를 바꿀 수 없어요. 시즌이 끝난 뒤 적용해 주세요.`,
    'SEASON_BALANCE_LOCKED',
  );

/** T-11-488 예약이 켜질 시즌: 지금 시즌(휴식기면 마지막 시즌)의 다음 시즌. */
const nextSeasonAt = (now: string) => (teamSeasonAt(now) ?? displaySeasonAt(now)) + 1;

async function versionOr404(c: Context<AppEnv>, version: number) {
  const v = await getBalanceVersion(getDb(c), version);
  if (!v) throw notFound();
  return v;
}

export function registerBalanceRoutes(app: Hono<AppEnv>): void {
  app.get(EDGE.balance, async (c) => {
    const data = await edgeCached(c, EDGE.balance, PUBLIC_TTL, async () => {
      const active = await getActiveBalance(getDb(c));
      return active
        ? { version: active.version, values: active.values, activatedAt: active.activatedAt }
        : { version: 0, values: {}, activatedAt: null };
    });
    return ok(c, BalanceConfigSchema, data);
  });

  // T-11-141 공개 이력(확률 도감 '확률과 공정성'). 모두에게 같은 응답이라 엣지에 담고, 활성화가 지운다.
  app.get(EDGE.balanceHistory, async (c) => {
    const data = await edgeCached(c, EDGE.balanceHistory, HISTORY_TTL, () =>
      listAppliedBalanceVersions(getDb(c), BALANCE_HISTORY_LIMIT),
    );
    return ok(c, BalanceHistorySchema, data);
  });

  app.get('/v1/admin/balance', async (c) => {
    await requireAdmin(c);
    const db = getDb(c);
    const [versions, s] = await Promise.all([listBalanceVersions(db), getBalanceSchedule(db)]);
    const scheduled = s && { version: s.version, season: s.season, scheduledAt: s.scheduledAt };
    return ok(c, BalanceVersionListSchema, { versions, scheduled });
  });

  // T-11-488 다음 시즌 개막에 켤 버전을 예약한다(하나만 — 다시 예약하면 바뀐다). 켜는 일은 5분 cron(cron/balanceSchedule.ts).
  app.post('/v1/admin/balance/:version/schedule', async (c) => {
    const version = versionParam(c);
    const viewer = await requireAdmin(c);
    const target = await versionOr404(c, version);
    if (target.status === 'active')
      // i18n-ignore 운영 도구 전용 문구(운영 도구는 한국어로 둔다)
      throw conflictError('이미 적용 중인 버전이에요.', 'BALANCE_ALREADY_ACTIVE');
    const now = nowIso();
    const scheduled = { version, season: nextSeasonAt(now), scheduledAt: now };
    await scheduleBalance(getDb(c), { ...scheduled, by: viewer.profileId! });
    return ok(c, BalanceScheduleSchema, scheduled);
  });

  app.delete('/v1/admin/balance-schedule', async (c) => {
    await requireAdmin(c);
    await clearBalanceSchedule(getDb(c));
    return c.body(null, 204);
  });

  app.post('/v1/admin/balance', async (c) => {
    const viewer = await requireAdmin(c);
    const input = draftInput(c);
    const created = await createBalanceDraft(getDb(c), input, viewer.profileId!, nowIso());
    return ok(c, BalanceVersionSchema, created, 201);
  });

  app.put('/v1/admin/balance/:version', async (c) => {
    const version = versionParam(c);
    await requireAdmin(c);
    const input = draftInput(c);
    const updated = await updateBalanceDraft(getDb(c), version, input, nowIso());
    if (!updated) {
      await versionOr404(c, version);
      throw notDraft();
    }
    return ok(c, BalanceVersionSchema, updated);
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
    if (target.status === 'active') return ok(c, BalanceVersionSchema, target);
    const now = nowIso();
    // T-10-090 급한 버그 수정만 ?override=season으로 시즌 중에 연다 — 감사 로그에 남긴다.
    const season = activeSeason(now);
    if (season && c.req.query('override') !== 'season') throw seasonLocked(season.name);
    await activateBalance(db, version, active?.version ?? null, viewer.profileId!, now, season?.id);
    purgeEdge(c, STALE.balanceActivated());
    const activated = { ...target, status: 'active' as const, activatedAt: now, updatedAt: now };
    return ok(c, BalanceVersionSchema, activated);
  });
}
