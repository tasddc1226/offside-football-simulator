// T-11-128 구단주 시즌 결산과 휘장. 결산은 cron이 굳힌 값만 읽는다(team/seasonClose.ts) — 굳히는 중이면 pending.
import {
  OwnerHonorsResponseSchema,
  RECAP_SQUAD_MAX,
  SeasonPickQuerySchema,
  SeasonRecapResponseSchema,
  type OwnerHonor,
  type SeasonRecap,
  type SeasonRecapStats,
} from '@offside/contracts';
import { openTeamSeasons, teamSeasonClosed } from '@offside/contracts/service-seasons';
import { and, asc, desc, eq, isNotNull, lte, sql } from 'drizzle-orm';
import type { Hono } from 'hono';
import type { Db } from '../db/client.js';
import { teamPlayerCard } from '../db/repos/ownerTeams.js';
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

/** owner_season_records.stats_json(team/seasonClose.ts가 굳힌 모양) — 최다 득점 선수는 ID만, 팀 실점 · 최다 점수 차가 더 있다. */
type StoredStats = {
  stats: Omit<SeasonRecapStats, 'scorer'>;
  scorer: { id: string | null; goals: number | null };
  team: { goalsAgainst: number | null; bestMargin: number | null };
};

const parseStats = (json: string | null): StoredStats | null => {
  if (!json) return null;
  try {
    return JSON.parse(json) as StoredStats;
  } catch {
    return null;
  }
};

/** 굳힌 묶음에 최다 득점 선수의 이름 · 포지션을 붙인다(이름은 신고로 가리면 null — 지금 값을 읽는다). */
async function recapStats(db: Db, stored: StoredStats | null): Promise<SeasonRecapStats | null> {
  if (!stored) return null;
  const { stats, scorer: top } = stored;
  const scorerId = top.id;
  const [scorer] = scorerId
    ? await db
        .select({ name: careers.publicName, pos: careers.pos })
        .from(careers)
        .where(eq(careers.id, scorerId))
    : [];
  return {
    ...stats,
    scorer:
      scorerId && scorer
        ? { careerId: scorerId, name: scorer.name, pos: scorer.pos, goals: top.goals ?? 0 }
        : null,
  };
}

/** 그 시즌에 키워 마감 전에 은퇴한 내 선수(결산 기록과 같은 기준 — team/seasonClose.ts), 레전드 점수 순. */
// SQL-wrapped fields retain column decoders with the explicit INDEXED BY source.
export const squadOf = (db: Db, profileId: string, season: number, cutoff: string) =>
  db
    .select({
      id: sql`${careers.id}`.mapWith(careers.id),
      pos: sql`${careers.pos}`.mapWith(careers.pos),
      nation: sql`${careers.nation}`.mapWith(careers.nation),
      dpos: sql`${careers.dpos}`.mapWith(careers.dpos),
      peak: sql`${careers.peak}`.mapWith(careers.peak),
      number: sql`${careers.shirtNumber}`.mapWith(careers.shirtNumber),
      publicName: sql`${careers.publicName}`.mapWith(careers.publicName),
      peakProfile: sql`${careers.peakProfile}`.mapWith(careers.peakProfile),
      cardAttrsJson: sql`${careers.cardAttrsJson}`.mapWith(careers.cardAttrsJson),
      serviceSeason: sql`${careers.serviceSeason}`.mapWith(careers.serviceSeason),
      legendScore: sql`${careers.legendScore}`.mapWith(careers.legendScore),
      lastClub: sql`${careers.lastClub}`.mapWith(careers.lastClub),
      lastClubId: sql`${careers.lastClubId}`.mapWith(careers.lastClubId),
    })
    // The cutoff index scans every owner's retired careers. Keep this owner-scoped
    // even when SQLite estimates that the global retirement index is cheaper.
    .from(sql`${careers} INDEXED BY careers_profile_status_legend_idx`)
    .where(
      and(
        eq(careers.profileId, profileId),
        sql`coalesce(${careers.serviceSeason}, 0) = ${season}`,
        eq(careers.hidden, 0),
        eq(careers.status, 'retired'),
        isNotNull(careers.legendScore),
        lte(careers.retiredAt, cutoff),
      ),
    )
    .orderBy(desc(careers.legendScore), asc(careers.id))
    .limit(RECAP_SQUAD_MAX);

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
    const [[row], honors, squad] = await Promise.all([
      db
        .select({
          r: ownerSeasonRecords,
          // 신고로 가린 이름은 publicName이 null이 된다(nameReports).
          name: careers.publicName,
          pos: careers.pos,
          lastClub: careers.lastClub,
          peak: careers.peak,
        })
        .from(ownerSeasonRecords)
        .leftJoin(careers, eq(careers.id, ownerSeasonRecords.bestCareerId))
        .where(
          and(eq(ownerSeasonRecords.profileId, profileId), eq(ownerSeasonRecords.season, season)),
        ),
      honorsOf(db, profileId, season),
      squadOf(db, profileId, season, state.cutoff),
    ]);
    if (!row) return reply('none', null, []);
    const { r } = row;
    const stored = parseStats(r.statsJson);
    const stats = await recapStats(db, stored);
    const ranked = state.ranked ?? { team: 0, ach: 0, hof: 0 };
    const cards = squad.map((p) => ({
      card: teamPlayerCard(p),
      lastClub: p.lastClub,
      lastClubId: p.lastClubId,
    }));
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
              peak: row.peak,
              // 대표 선수는 선수단 맨 앞(같은 기준 · 레전드 점수 순)이라 그 카드를 쓴다.
              card: cards.find((m) => m.card.careerId === r.bestCareerId)?.card ?? null,
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
              goalsAgainst: stored?.team.goalsAgainst ?? null,
              bestMargin: stored?.team.bestMargin ?? null,
              bestStreak: r.bestStreak,
            }
          : null,
      achievements:
        r.achScore !== null
          ? { score: r.achScore, done: r.achDone ?? 0, rank: r.achRank, ranked: ranked.ach }
          : null,
      stats,
      squad: cards,
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
