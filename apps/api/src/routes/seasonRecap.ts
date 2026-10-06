// T-11-128 구단주 시즌 결산과 휘장. 결산은 cron이 굳힌 값만 읽는다(team/seasonClose.ts) — 굳히는 중이면 pending.
import {
  OwnerHonorsResponseSchema,
  SeasonPickQuerySchema,
  SeasonRecapResponseSchema,
  type OwnerHonor,
  type SeasonRecap,
} from '@offside/contracts';
import { openTeamSeasons, teamSeasonClosed } from '@offside/contracts/service-seasons';
import { and, asc, eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import type { Db } from '../db/client.js';
import { careers, ownerHonors, ownerSeasonRecords } from '../db/schema.js';
import { getDb, type AppEnv } from '../env.js';
import { parseWithAppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { closeStateOf } from '../team/seasonClose.js';
import { nowIso, ok } from './shared.js';

const honorsOf = async (db: Db, profileId: string, season?: number): Promise<OwnerHonor[]> =>
  (
    await db
      .select()
      .from(ownerHonors)
      .where(
        and(
          eq(ownerHonors.profileId, profileId),
          season === undefined ? undefined : eq(ownerHonors.season, season),
        ),
      )
      .orderBy(asc(ownerHonors.season), asc(ownerHonors.kind))
  ).map(({ season: s, kind, band, rank, value, grantedAt }) => ({
    season: s,
    kind: kind as OwnerHonor['kind'],
    band,
    rank,
    value,
    grantedAt,
  }));

export function registerSeasonRecapRoutes(app: Hono<AppEnv>): void {
  // 내 시즌 결산. ?season= 없으면 가장 최근에 끝난 시즌.
  app.get('/v1/owner/season-recap', requireProfile, async (c) => {
    const db = getDb(c);
    const profileId = getSessionOrThrow(c).profileId;
    const now = nowIso();
    const closed = openTeamSeasons(now).filter((s) => teamSeasonClosed(s, now));
    const season =
      parseWithAppError(SeasonPickQuerySchema, c.req.query('season')) ?? closed.at(-1) ?? 0;
    const state = closed.includes(season) ? await closeStateOf(db, season) : null;
    const reply = (
      status: 'pending' | 'none' | 'ready',
      recap: SeasonRecap | null,
      honors: OwnerHonor[],
    ) =>
      ok(c, SeasonRecapResponseSchema, { season, status, recap, honors }, 200, 'private, no-store');
    if (state?.step !== 'done') return reply('pending', null, []);
    const [[row], honors] = await Promise.all([
      db
        .select({
          r: ownerSeasonRecords,
          // 신고로 가린 이름은 publicName이 null이 된다(nameReports).
          name: careers.publicName,
          pos: careers.pos,
          lastClub: careers.lastClub,
        })
        .from(ownerSeasonRecords)
        .leftJoin(careers, eq(careers.id, ownerSeasonRecords.bestCareerId))
        .where(
          and(eq(ownerSeasonRecords.profileId, profileId), eq(ownerSeasonRecords.season, season)),
        ),
      honorsOf(db, profileId, season),
    ]);
    if (!row) return reply('none', null, []);
    const { r } = row;
    const ranked = state.ranked ?? { team: 0, ach: 0, hof: 0 };
    const recap: SeasonRecap = {
      season,
      cutoff: state.cutoff,
      closedAt: state.closedAt ?? r.createdAt,
      players: r.players,
      retired: r.retired,
      best:
        r.bestCareerId && row.pos
          ? {
              careerId: r.bestCareerId,
              name: row.name,
              pos: row.pos,
              lastClub: row.lastClub,
              score: r.bestScore ?? 0,
            }
          : null,
      hofRank: r.hofRank,
      hofRanked: ranked.hof,
      retiredNumbers: r.retiredNumbers,
      wallOfHonor: r.wallOfHonor,
      firsts: r.firsts,
      team:
        r.teamId && r.teamName !== null
          ? {
              name: r.teamName,
              rating: r.teamRating ?? 0,
              rank: r.teamRank,
              ranked: ranked.team,
              wins: r.wins,
              draws: r.draws,
              losses: r.losses,
              goalsFor: r.goalsFor,
              bestStreak: r.bestStreak,
            }
          : null,
      achievements:
        r.achScore !== null
          ? { score: r.achScore, done: r.achDone ?? 0, rank: r.achRank, ranked: ranked.ach }
          : null,
    };
    return reply('ready', recap, honors);
  });

  // 결산을 볼 수 있는 시즌과 내 휘장 전부(시즌 기록 보관함 · 트로피장).
  app.get('/v1/owner/honors', requireProfile, async (c) => {
    const now = nowIso();
    const honors = await honorsOf(getDb(c), getSessionOrThrow(c).profileId);
    const seasons = openTeamSeasons(now).filter((s) => teamSeasonClosed(s, now));
    return ok(c, OwnerHonorsResponseSchema, { seasons, honors }, 200, 'private, no-store');
  });
}
