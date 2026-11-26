import {
  resolveBalance,
  XmasClaimBodySchema,
  XmasClaimResponseSchema,
  XmasEventSchema,
} from '@offside/contracts';
import { xmasPhase, xmasTreeCounting, type XmasPhase } from '@offside/contracts/xmas';
import type { Context, Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { ownerTeams } from '../db/schema.js';
import { EDGE } from '../edgeKeys.js';
import { purgeEdge } from '../edgeCache.js';
import { getViewer } from '../auth/admin.js';
import { cupKo } from '../cupText.js';
import { activeBalanceQuery, balanceVersionOf } from '../db/repos/balance.js';
import { getProfile, hasAccount } from '../db/repos/profiles.js';
import {
  claimXmas,
  xmasClaimKeyOf,
  parseXmasTarget,
  xmasEligible,
  xmasMineOf,
  xmasRewardOf,
  xmasTreeCount,
  xmasView,
} from '../db/repos/xmas.js';
import { getDb, type AppEnv } from '../env.js';
import { idempotency } from '../middleware/idempotency.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { requireOwner } from '../middleware/requireOwner.js';
import { conflictError, NO_STORE, nowIso, ok, readBody } from './shared.js';

// T-11-834 크리스마스 이벤트. 화면은 기간 안에서만 부른다(앱 · 웹이 날짜를 보고 홈을 열 때 한 번, 받은 뒤 다시). 기간이 아니면
// DB를 읽지 않고 닫힌 상태를 돌려준다. 운영자는 ?preview=1로 기간 전에도 열린 것처럼 볼 수 있다(QA).

async function phaseOf(c: Context<AppEnv>, nowMs: number) {
  const preview = c.req.query('preview') === '1' && (await getViewer(c)).admin;
  if (preview) return { phase: 'open' as const, counting: true, preview };
  const base = xmasPhase(nowMs);
  if (base !== 'open') return { phase: base, counting: false, preview };
  // 기간 안에서만 끄는 스위치(밸런스 xmasEvent)를 읽는다.
  const [row] = await activeBalanceQuery(getDb(c));
  const off = resolveBalance(row && balanceVersionOf(row).values).xmasEvent < 1;
  return { phase: xmasPhase(nowMs, off), counting: xmasTreeCounting(nowMs, off), preview };
}

async function viewOf(c: Context<AppEnv>, profileId: string, phase: XmasPhase, counting: boolean) {
  const db = getDb(c);
  if (phase !== 'open') return xmasView(phase, 0, null, false, false);
  const [count, mine, profile] = await Promise.all([
    xmasTreeCount(db),
    xmasMineOf(db, profileId),
    getProfile(db, profileId),
  ]);
  const owner = !!profile && hasAccount(profile) && !profile.deletedAt;
  return xmasView(phase, count, mine, owner, counting);
}

export function registerXmasRoutes(app: Hono<AppEnv>) {
  app.get('/v1/events/xmas', requireProfile, async (c) => {
    const { profileId } = getSessionOrThrow(c);
    const { phase, counting } = await phaseOf(c, Date.now());
    const r = await viewOf(c, profileId, phase, counting);
    return ok(c, XmasEventSchema, r, 200, NO_STORE);
  });

  app.post('/v1/events/xmas/claim', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const { target } = readBody(c, XmasClaimBodySchema);
    const t = parseXmasTarget(target);
    const { phase, counting } = await phaseOf(c, Date.now());
    if (phase !== 'open') throw conflictError(cupKo('xmasClosed'), 'XMAS_CLOSED');
    const db = getDb(c);
    const [mine, count] = await Promise.all([xmasMineOf(db, me.id), xmasTreeCount(db)]);
    if (!xmasEligible(t, mine, count)) throw conflictError(cupKo('xmasNotReady'), 'XMAS_NOT_READY');
    const now = nowIso();
    if (!(await claimXmas(db, me.id, t, now)))
      throw conflictError(cupKo('xmasClaimed'), 'XMAS_CLAIMED');
    const r = xmasRewardOf(t);
    const title = t.kind === 'sock' && t.key === 'team';
    if (title) {
      const teams = await db
        .select({ id: ownerTeams.id })
        .from(ownerTeams)
        .where(eq(ownerTeams.profileId, me.id));
      purgeEdge(
        c,
        teams.map(({ id }) => EDGE.ownerHall(id)),
      );
    }
    const claims = new Set(mine.claims).add(xmasClaimKeyOf(t));
    const event = xmasView(phase, count, { ...mine, claims }, true, counting);
    return ok(
      c,
      XmasClaimResponseSchema,
      {
        event,
        granted: { reroll: r.reroll ?? 0, boost: r.boost ?? 0, scout: r.scout ?? 0, rename: 0 },
        title,
      },
      200,
      NO_STORE,
    );
  });
}
