// T-11-128 구단주 시즌 결산과 휘장. 결산은 cron이 굳힌 값만 읽는다(team/seasonClose.ts) — 굳히는 중이면 pending.
import {
  OwnerHonorsResponseSchema,
  RECAP_SQUAD_MAX,
  SeasonPickQuerySchema,
  SeasonRecapResponseSchema,
  type OwnerHonor,
  type SeasonRecap,
  type SeasonRecapStats,
  type TeamPlayer,
} from '@offside/contracts';
import { CARD_TIERS } from '@offside/contracts/card-tier';
import { openTeamSeasons, teamSeasonClosed } from '@offside/contracts/service-seasons';
import { and, asc, desc, eq, isNotNull, lte, sql } from 'drizzle-orm';
import type { Hono } from 'hono';
import type { Db } from '../db/client.js';
import { estimatedAttrsOf, peakOf, toLineupCareer } from '../db/repos/ownerTeams.js';
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

/** owner_season_records.stats_json(team/seasonClose.ts가 굳힌 모양). */
type StoredStats = Omit<SeasonRecapStats, 'tiers' | 'scorer'> & {
  tiers: number[];
  scorerId: string | null;
  scorerGoals: number | null;
  goalsAgainst: number | null;
  bestMargin: number | null;
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
  const {
    apps,
    goals,
    assists,
    trophies,
    awards,
    caps,
    ballon,
    peak,
    tiers,
    scorerId,
    scorerGoals,
  } = stored;
  const [scorer] = scorerId
    ? await db
        .select({ name: careers.publicName, pos: careers.pos })
        .from(careers)
        .where(eq(careers.id, scorerId))
    : [];
  return {
    apps,
    goals,
    assists,
    trophies,
    awards,
    caps,
    ballon,
    peak,
    tiers: Object.fromEntries(
      CARD_TIERS.map((t, i) => [t, tiers[i] ?? 0]),
    ) as SeasonRecapStats['tiers'],
    scorer:
      scorerId && scorer
        ? { careerId: scorerId, name: scorer.name, pos: scorer.pos, goals: scorerGoals ?? 0 }
        : null,
  };
}

/** 선수 카드 — 팀 화면 카드와 같은 값(옛 기록은 추정 능력치). */
function cardOf(
  row: Parameters<typeof toLineupCareer>[0] & {
    cardAttrsJson: string | null;
    legendScore: number | null;
  },
): TeamPlayer {
  const profile = peakOf(row.peakProfile);
  const career = toLineupCareer(row, profile);
  const estimated = profile ? null : estimatedAttrsOf(row.cardAttrsJson);
  return {
    careerId: row.id,
    pos: career.pos,
    nation: career.nation,
    dpos: career.dpos,
    peak: career.peak,
    roles: career.roles,
    attrs: profile?.attrs ?? estimated,
    attrsEstimated: estimated !== null,
    number: career.number,
    publicName: career.publicName,
    legendScore: row.legendScore,
    season: career.season,
  };
}

/** 그 시즌에 키워 마감 전에 은퇴한 내 선수(결산 기록과 같은 기준 — team/seasonClose.ts), 레전드 점수 순. */
const squadOf = (db: Db, profileId: string, season: number, cutoff: string) =>
  db
    .select({
      id: careers.id,
      pos: careers.pos,
      nation: careers.nation,
      dpos: careers.dpos,
      peak: careers.peak,
      number: careers.shirtNumber,
      publicName: careers.publicName,
      peakProfile: careers.peakProfile,
      cardAttrsJson: careers.cardAttrsJson,
      serviceSeason: careers.serviceSeason,
      legendScore: careers.legendScore,
      lastClub: careers.lastClub,
      lastClubId: careers.lastClubId,
    })
    .from(careers)
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
          nation: careers.nation,
          dpos: careers.dpos,
          number: careers.shirtNumber,
          peakProfile: careers.peakProfile,
          cardAttrsJson: careers.cardAttrsJson,
          serviceSeason: careers.serviceSeason,
          legendScore: careers.legendScore,
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
              card: cardOf({ ...row, id: r.bestCareerId, pos: row.pos, publicName: row.name }),
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
              goalsAgainst: stored?.goalsAgainst ?? null,
              bestMargin: stored?.bestMargin ?? null,
              bestStreak: r.bestStreak,
            }
          : null,
      achievements:
        r.achScore !== null
          ? { score: r.achScore, done: r.achDone ?? 0, rank: r.achRank, ranked: ranked.ach }
          : null,
      stats,
      squad: squad.map((p) => ({
        card: cardOf(p),
        lastClub: p.lastClub,
        lastClubId: p.lastClubId,
      })),
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
