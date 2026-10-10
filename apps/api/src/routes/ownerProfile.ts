// T-11-150 구단주 프로필과 명예관(대표 칭호). 남의 프로필은 팀 id로 연다 — 팀 프로필·랭킹이 이미 팀 id를 들고 있고, 프로필 id는
// 내보내지 않는다. 대표 칭호는 받은 칭호(컵 성적) 가운데서만 고른다.
import {
  OwnerProfileResponseSchema,
  OwnerArchiveResponseSchema,
  OwnerTitleBackfillBodySchema,
  OwnerTitleBackfillResponseSchema,
  OwnerTitlesResponseSchema,
  PutOwnerTitleBodySchema,
  PutOwnerTitleResponseSchema,
  TeamIdSchema,
} from '@offside/contracts';
import { TITLE_NONE, titlesOf } from '@offside/contracts/owner-title';
import { desc, eq, inArray } from 'drizzle-orm';
import type { Hono } from 'hono';
import { cupKo } from '../cupText.js';
import { permanentTitlesOf, backfillOwnerTitles } from '../db/repos/ownerTitles.js';
import { appMeta, ownerTitleAwards } from '../db/schema.js';
import { requireAdmin } from '../auth/admin.js';
import { and } from 'drizzle-orm';
import { ownerProfileOf } from '../db/repos/ownerProfile.js';
import { liveTeam } from '../db/repos/ownerTeams.js';
import { ownerTeams, profiles } from '../db/schema.js';
import { getDb, type AppEnv } from '../env.js';
import { parseWithAppError } from '../errors.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { resolveSession } from '../middleware/session.js';
import { purgeEdge } from '../edgeCache.js';
import { EDGE } from '../edgeKeys.js';
import { reqLang } from '../lang.js';
import { cupHonorsOf } from '../team/cup.js';
import {
  openTeamSeasons,
  teamSeasonClosed,
  teamSeasonAt,
  teamSeasonName,
} from '@offside/contracts/service-seasons';
import { closeMetaKey } from '../team/seasonClose.js';
import { honorsOf } from './seasonRecap.js';
import { requireOwner } from './ownerTeam.js';
import { NO_STORE, conflictError, nowIso, ok, readBody, teamNotFound } from './shared.js';

export function registerOwnerProfileRoutes(app: Hono<AppEnv>): void {
  // No team required: the archive belongs to the authenticated owner, including owners who only raise players.
  app.get('/v1/owner/archive', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const now = nowIso();
    const lang = reqLang(c);
    const closed = openTeamSeasons(now).filter((s) => teamSeasonClosed(s, now));
    const [owner, honors, states] = await Promise.all([
      ownerProfileOf(db, me, now, lang),
      honorsOf(db, me.id),
      closed.length
        ? db
            .select()
            .from(appMeta)
            .where(inArray(appMeta.key, closed.map(closeMetaKey)))
        : [],
    ]);
    const done = new Set(
      states.flatMap((s) => {
        try {
          return JSON.parse(s.value).step === 'done' ? [s.key] : [];
        } catch {
          return [];
        }
      }),
    );
    const pendingSeasons = closed.filter((s) => !done.has(closeMetaKey(s)));
    // Always give a new owner a current-season starting point; never synthesize final results.
    const current = teamSeasonAt(now) ?? 0;
    if (!owner.seasons.some((s) => s.season === current))
      owner.seasons.push({
        season: current,
        name: teamSeasonName(current, lang),
        achScore: null,
        teamName: null,
        teamRank: null,
        closed: false,
      });
    for (const s of owner.seasons)
      if (pendingSeasons.includes(s.season)) {
        s.achScore = null;
        s.teamRank = null;
      }
    return ok(
      c,
      OwnerArchiveResponseSchema,
      {
        owner,
        honors: honors.filter((h) => done.has(closeMetaKey(h.season))),
        pendingSeasons,
      },
      200,
      NO_STORE,
    );
  });

  // 남의(또는 내) 구단주 프로필 — 그 구단주의 아무 시즌 팀 id로 연다. mine이 사람마다 달라 캐시하지 않는다.
  app.get('/v1/owners/by-team/:teamId', async (c) => {
    const id = parseWithAppError(TeamIdSchema, c.req.param('teamId'));
    const db = getDb(c);
    const [[found], session] = await Promise.all([liveTeam(db, id), resolveSession(c)]);
    if (!found) throw teamNotFound();
    const profileId = found.team.profileId;
    const owner = await ownerProfileOf(
      db,
      { id: profileId, nickname: found.ownerNickname, title: found.title },
      nowIso(),
      reqLang(c),
    );
    return ok(
      c,
      OwnerProfileResponseSchema,
      { owner, mine: session?.profileId === profileId },
      200,
      NO_STORE,
    );
  });

  // Admin preview is read-only; apply requires dryRun:false. Bounded cursor batches are resumable.
  app.post('/v1/admin/owner-titles/backfill', async (c) => {
    await requireAdmin(c);
    const { after, limit, dryRun } = readBody(c, OwnerTitleBackfillBodySchema);
    const result = await backfillOwnerTitles(getDb(c), nowIso(), after, limit, dryRun);
    return ok(c, OwnerTitleBackfillResponseSchema, result, 200, NO_STORE);
  });

  // 명예관 — 지금 대표 칭호와 고를 수 있는 칭호, '내 구단주 프로필 보기'용 가장 최근 팀.
  app.get('/v1/owner/title', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const [honors, permanent, [latest]] = await Promise.all([
      cupHonorsOf(db, me.id),
      permanentTitlesOf(db, me.id, nowIso()),
      db
        .select({ id: ownerTeams.id })
        .from(ownerTeams)
        .where(eq(ownerTeams.profileId, me.id))
        .orderBy(desc(ownerTeams.season))
        .limit(1),
    ]);
    return ok(
      c,
      OwnerTitlesResponseSchema,
      {
        title: me.title,
        titles: [...titlesOf(honors), ...permanent.filter((t) => t.earnedAt).map((t) => t.id)],
        permanent,
        pinned: me.titlePinned,
        teamId: latest?.id ?? null,
      },
      200,
      NO_STORE,
    );
  });

  // 대표 칭호 고르기(전체 교체라 자연 멱등). 칭호 id면 그 칭호, 'none'이면 달지 않기, null이면 다시 자동(가장 좋은 칭호).
  app.put('/v1/owner/title', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const { title } = readBody(c, PutOwnerTitleBodySchema);
    const [honors, permanent] = await Promise.all([
      cupHonorsOf(db, me.id),
      permanentTitlesOf(db, me.id, nowIso()),
    ]);
    const cupTitles = titlesOf(honors);
    const titles = [...cupTitles, ...permanent.filter((t) => t.earnedAt).map((t) => t.id)];
    if (title && title !== TITLE_NONE && !titles.includes(title))
      throw conflictError(cupKo('titleNotOwned'), 'TITLE_NOT_OWNED');
    const next =
      title === null
        ? { title: cupTitles[0] ?? null, titlePinned: 0 }
        : { title: title === TITLE_NONE ? null : title, titlePinned: 1 };
    await db.update(profiles).set(next).where(eq(profiles.id, me.id));
    const seasons = await db
      .select({ season: ownerTeams.season })
      .from(ownerTeams)
      .where(eq(ownerTeams.profileId, me.id));
    // Known first-page keys are purged; remaining rank pages expire within the existing five-minute TTL.
    purgeEdge(
      c,
      seasons.flatMap(({ season }) => [
        ...['rating', 'ovr', 'value'].map((sort) => EDGE.teamRank(season, sort, 1)),
        EDGE.achRank(season, 1),
      ]),
    );
    if (next.title)
      await db
        .update(ownerTitleAwards)
        .set({ seenAt: nowIso() })
        .where(
          and(eq(ownerTitleAwards.profileId, me.id), eq(ownerTitleAwards.titleId, next.title)),
        );
    return ok(
      c,
      PutOwnerTitleResponseSchema,
      { title: next.title, pinned: next.titlePinned === 1 },
      200,
      NO_STORE,
    );
  });
}
