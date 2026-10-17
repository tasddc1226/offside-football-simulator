// T-11-310 감독 커리어 API. 구글 로그인한 구단주만 쓴다(사람마다 다른 응답이라 엣지 캐시하지 않는다).
// 감독 커리어는 기기에서 돌고, 서버는 시작(카드를 감독으로 분류 · 선발에서 빼기 · 판매 내리기) · 포기(원래 선수로) ·
// 완료(감독 카드)만 맡는다.
import {
  FinishManagerBodySchema,
  ManagerCareerIdSchema,
  ManagerCareerResponseSchema,
  ManagersResponseSchema,
  ReleaseManagerResponseSchema,
  StartManagerBodySchema,
} from '@offside/contracts';
import type { FormationId } from '@offside/contracts/owner-team';
import { teamSeasonAt } from '@offside/contracts/service-seasons';
import type { Context, Hono } from 'hono';
import { NO_STORE, conflictError, notFoundError, nowIso, ok, readBody } from './shared.js';
import { checkCupManager } from './cup.js';
import { requireOwner } from './ownerTeam.js';
import {
  abandonManagerCareer,
  cardForManager,
  finishManagerCareer,
  isActiveConflict,
  listManagers,
  managerCareerOf,
  managerOriginOf,
  releaseManagerCard,
  startManagerCareer,
} from '../db/repos/managers.js';
import { marketRules } from '../db/repos/market.js';
import {
  careersByIds,
  eligibleMap,
  friendlyTeamOf,
  layoutOf,
  listEligibleCareers,
  listMyTeams,
  presetsOf,
  slotIdsOf,
  type FriendlyLineup,
  type OwnerTeamRow,
} from '../db/repos/ownerTeams.js';
import { ownerTeams } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { purgeEdge, waitUntil } from '../edgeCache.js';
import { STALE } from '../edgeKeys.js';
import { getDb, type AppEnv } from '../env.js';
import { parseWithAppError } from '../errors.js';
import { idempotency } from '../middleware/idempotency.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { refreshAfterChange } from '../team/ownerAchievements.js';
import { buildLineup, filledCount, lineupOvr } from '../team/sim.js';
import type { Db } from '../db/client.js';

const managerGone = () => notFoundError('감독 커리어를 찾을 수 없어요.', 'MANAGER_NOT_FOUND');

const managerIdOf = (c: Context<AppEnv>) =>
  parseWithAppError(ManagerCareerIdSchema, c.req.param('managerId'));

/** 32비트 시드(기기가 감독 커리어를 처음 만들 때 쓴다). */
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;

/**
 * 감독이 된 카드를 고칠 수 있는 팀(지금 시즌 · 프리시즌 친선 편성)의 선발 · 프리셋에서 뺀다. 지금 시즌 팀은 선발 수 · OVR도
 * 다시 센다. 닫힌 시즌 팀의 최종 기록은 그대로 둔다(그 시즌에 뛴 기록이다).
 */
async function stripFromTeams(db: Db, profileId: string, careerId: string, now: string) {
  const current = teamSeasonAt(now);
  const teams = (await listMyTeams(db, profileId)).filter(
    (t) => t.season === current || t.season === 0,
  );
  const drop = (ids: (string | null)[]) => ids.map((id) => (id === careerId ? null : id));
  for (const t of teams) {
    const set: Partial<OwnerTeamRow> = {};
    const slots = slotIdsOf(t);
    if (t.season === current && slots.includes(careerId)) {
      const next = drop(slots);
      const ids = next.filter((x): x is string => x !== null);
      const lineup = buildLineup(
        t.formation as FormationId,
        next,
        eligibleMap(await careersByIds(db, ids), profileId, t.season, true),
        layoutOf(t),
      );
      Object.assign(set, {
        slotsJson: JSON.stringify(next),
        filled: filledCount(lineup),
        ovr: lineupOvr(lineup),
      });
    }
    if (t.friendlyJson) {
      const f = friendlyTeamOf(t);
      const fs = slotIdsOf(f);
      if (fs.includes(careerId)) {
        const lineup: FriendlyLineup = JSON.parse(t.friendlyJson) as FriendlyLineup;
        set.friendlyJson = JSON.stringify({ ...lineup, slotsJson: JSON.stringify(drop(fs)) });
      }
    }
    const presets = presetsOf(t);
    if (presets.some((p) => p.slots.includes(careerId)))
      set.presetsJson = JSON.stringify(presets.map((p) => ({ ...p, slots: drop(p.slots) })));
    if (Object.keys(set).length)
      await db
        .update(ownerTeams)
        .set(set)
        .where(and(eq(ownerTeams.id, t.id), eq(ownerTeams.profileId, profileId)));
  }
  return current;
}

export function registerManagerRoutes(app: Hono<AppEnv>): void {
  // 감독 화면: 진행 중 커리어 · 끝낸 감독 카드 · 시작할 수 있는 카드. 화면을 열 때 한 번 부른다(웹 메모 1분).
  app.get('/v1/managers', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const now = nowIso();
    const season = teamSeasonAt(now);
    const [list, cards, teams] = await Promise.all([
      listManagers(
        db,
        me.id,
        marketRules(db).then((r) => r.releaseRate),
      ),
      // 지금 가진 카드 전부(시즌 상관없이 · 감독 아닌 카드) — listEligibleCareers는 시즌 이하로 거르므로 넉넉히 준다.
      listEligibleCareers(db, me.id, Number.MAX_SAFE_INTEGER),
      listMyTeams(db, me.id),
    ]);
    const team = teams.find((t) => t.season === season);
    const lineup = new Set(team ? slotIdsOf(team) : []);
    return ok(
      c,
      ManagersResponseSchema,
      {
        ...list,
        candidates: cards.map((p) => ({
          careerId: p.id,
          publicName: p.publicName,
          number: p.number,
          pos: p.pos,
          dpos: (p.dpos ?? null) as never,
          peak: p.peak,
          ...(p.look ? { look: p.look } : {}),
          season: p.serviceSeason,
          cardValue: p.cardValue,
          inLineup: lineup.has(p.id),
          listed: !!p.listingId,
        })),
        coachId: team?.coachId ?? null,
        hasTeam: !!team,
      },
      200,
      NO_STORE,
    );
  });

  // 감독 커리어 시작. 진행 중인 커리어는 한 번에 하나. 카드는 감독으로 분류되고 선발 · 판매에서 빠진다.
  app.post('/v1/managers', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const input = readBody(c, StartManagerBodySchema);
    const now = nowIso();
    const card = await cardForManager(db, input.careerId);
    if (!card || card.ownerId !== me.id || card.hidden)
      throw notFoundError('내 선수 카드를 찾을 수 없어요.', 'CARD_NOT_FOUND');
    if (card.manager) throw conflictError('이미 감독인 선수예요.', 'CARD_MANAGER');
    const season = teamSeasonAt(now);
    if (season !== null) await checkCupManager(db, me.id, season, input.careerId);
    const origin = await managerOriginOf(db, input.careerId);
    if (!origin) throw notFoundError('내 선수 카드를 찾을 수 없어요.', 'CARD_NOT_FOUND');
    let id: string | null;
    try {
      id = await startManagerCareer(db, {
        profileId: me.id,
        careerId: input.careerId,
        seed: newSeed(),
        origin,
        now,
      });
    } catch (e) {
      if (isActiveConflict(e))
        throw conflictError(
          '진행 중인 감독 커리어를 먼저 마치거나 포기해 주세요.',
          'MANAGER_ACTIVE',
        );
      throw e;
    }
    if (!id) throw conflictError('이미 감독인 선수예요.', 'CARD_MANAGER');
    const current = await stripFromTeams(db, me.id, input.careerId, now);
    if (current !== null) {
      purgeEdge(c, STALE.teamSaved(current));
      waitUntil(c, refreshAfterChange(db, me.id, current));
    }
    const career = await managerCareerOf(db, id, me.id);
    return ok(c, ManagerCareerResponseSchema, { career: career! }, 201, NO_STORE);
  });

  // 진행 중인 감독 커리어 포기: 원래 선수로 돌아온다(선발에는 다시 넣지 않는다).
  app.post('/v1/managers/:managerId/abandon', requireProfile, async (c) => {
    const me = await requireOwner(c);
    if (
      !(await abandonManagerCareer(getDb(c), {
        id: managerIdOf(c),
        profileId: me.id,
        now: nowIso(),
      }))
    )
      throw managerGone();
    return c.body(null, 204);
  });

  // T-11-345 끝낸 감독 경질. 지금 시즌 · 프리시즌 팀 감독 칸에 앉아 있으면 먼저 내려야 한다(선수 방출이 선발을
  // 먼저 빼게 하는 것과 같다). 직접 키운 선수면 방출처럼 자금을 받는다. 되돌릴 수 없다.
  app.post('/v1/managers/:managerId/release', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const id = managerIdOf(c);
    const now = nowIso();
    const found = await managerCareerOf(db, id, me.id);
    if (!found || found.status !== 'done') throw managerGone();
    const current = teamSeasonAt(now);
    const seated = (await listMyTeams(db, me.id)).some(
      (t) => (t.season === current || t.season === 0) && t.coachId === found.careerId,
    );
    if (seated) throw conflictError('감독 칸에서 내린 뒤 경질할 수 있어요.', 'MANAGER_SEATED');
    const res = await releaseManagerCard(db, {
      profileId: me.id,
      careerId: found.careerId,
      rate: (await marketRules(db)).releaseRate,
      now,
    });
    if (!res) throw managerGone();
    return ok(c, ReleaseManagerResponseSchema, res, 200, NO_STORE);
  });

  // 감독 커리어 완료: 결과(감독 카드)를 적는다. 그 뒤 다른 선수로 새 감독 커리어를 시작할 수 있다.
  app.post('/v1/managers/:managerId/finish', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const id = managerIdOf(c);
    const input = readBody(c, FinishManagerBodySchema);
    const now = nowIso();
    const season = teamSeasonAt(now) ?? 0;
    if (
      !(await finishManagerCareer(db, { id, profileId: me.id, result: input.result, season, now }))
    ) {
      const found = await managerCareerOf(db, id, me.id);
      // 재시도(이미 끝낸 같은 커리어)는 지금 결과를 그대로 돌려준다.
      if (found?.status === 'done') return ok(c, ManagerCareerResponseSchema, { career: found });
      throw managerGone();
    }
    waitUntil(c, refreshAfterChange(db, me.id, season));
    const career = await managerCareerOf(db, id, me.id);
    if (!career) throw managerGone();
    return ok(c, ManagerCareerResponseSchema, { career }, 200, NO_STORE);
  });
}
