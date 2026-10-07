// T-11-150 구단주 프로필과 명예관. 남의 프로필은 팀 id로 연다 — 팀 프로필·랭킹이 이미 팀 id를 들고 있고, 프로필 id는
// 내보내지 않는다. 대표 칭호는 받은 칭호(컵 성적) 가운데서만 고른다.
import {
  MyOwnerProfileResponseSchema,
  OwnerProfileResponseSchema,
  PutOwnerTitleBodySchema,
  PutOwnerTitleResponseSchema,
  TeamIdSchema,
} from '@offside/contracts';
import { TITLE_NONE, titlesOf } from '@offside/contracts/owner-title';
import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { cupKo } from '../cupText.js';
import { ownerProfileOf } from '../db/repos/ownerProfile.js';
import { getProfile } from '../db/repos/profiles.js';
import { liveTeam } from '../db/repos/ownerTeams.js';
import { profiles } from '../db/schema.js';
import { getDb, type AppEnv } from '../env.js';
import { parseWithAppError } from '../errors.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { resolveSession } from '../middleware/session.js';
import { reqLang } from '../lang.js';
import { cupHonorsOf } from '../team/cup.js';
import { requireOwner } from './ownerTeam.js';
import { NO_STORE, conflictError, nowIso, ok, readBody, teamNotFound } from './shared.js';

export function registerOwnerProfileRoutes(app: Hono<AppEnv>): void {
  // 남의(또는 내) 구단주 프로필 — 그 구단주의 아무 시즌 팀 id로 연다. mine이 사람마다 달라 캐시하지 않는다.
  app.get('/v1/owners/by-team/:teamId', async (c) => {
    const id = parseWithAppError(TeamIdSchema, c.req.param('teamId'));
    const db = getDb(c);
    const [[found], session] = await Promise.all([liveTeam(db, id), resolveSession(c)]);
    if (!found) throw teamNotFound();
    const profile = await getProfile(db, found.team.profileId);
    if (!profile) throw teamNotFound();
    const owner = await ownerProfileOf(
      db,
      { id: profile.id, nickname: profile.nickname, title: profile.title ?? null },
      nowIso(),
      reqLang(c),
    );
    return ok(
      c,
      OwnerProfileResponseSchema,
      { owner, mine: session?.profileId === profile.id },
      200,
      NO_STORE,
    );
  });

  // 명예관 — 내 프로필과 고를 수 있는 칭호.
  app.get('/v1/owner/profile', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const [owner, honors] = await Promise.all([
      ownerProfileOf(
        db,
        { id: me.id, nickname: me.nickname, title: me.title ?? null },
        nowIso(),
        reqLang(c),
      ),
      cupHonorsOf(db, me.id),
    ]);
    return ok(
      c,
      MyOwnerProfileResponseSchema,
      { owner, titles: titlesOf(honors), pinned: !!me.titlePinned },
      200,
      NO_STORE,
    );
  });

  // 대표 칭호 고르기(전체 교체라 자연 멱등). 칭호 id면 그 칭호, 'none'이면 달지 않기, null이면 다시 자동(가장 좋은 칭호).
  app.put('/v1/owner/title', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const { title } = readBody(c, PutOwnerTitleBodySchema);
    const titles = titlesOf(await cupHonorsOf(db, me.id));
    if (title && title !== TITLE_NONE && !titles.includes(title))
      throw conflictError(cupKo('titleNotOwned'), 'TITLE_NOT_OWNED');
    const next =
      title === null
        ? { title: titles[0] ?? null, titlePinned: 0 }
        : { title: title === TITLE_NONE ? null : title, titlePinned: 1 };
    await db.update(profiles).set(next).where(eq(profiles.id, me.id));
    return ok(
      c,
      PutOwnerTitleResponseSchema,
      { title: next.title, pinned: next.titlePinned === 1 },
      200,
      NO_STORE,
    );
  });
}
