import type { TeamRankSort } from '@offside/contracts';
import { TEAM_RANK_PER_PAGE, type FormationId } from '@offside/contracts/owner-team';
import {
  DETAIL_POSITIONS,
  FACE_ATTRS,
  type DetailPos,
  type PeakProfile,
} from '@offside/contracts/positions';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import type { Db } from '../client.js';
import { runBatch } from './batch.js';
import { honorsOf } from './firsts.js';
import {
  careerSeasons,
  careers,
  ownerTeams,
  profiles,
  retiredNumbers,
  teamLikes,
  teamMatches,
} from '../schema.js';
import type { LineupCareer, PlayerRef } from '../../team/sim.js';

// T-10-092 구단주 팀(시즌마다 한 팀)·팀 경기·라이브 랭킹.

export type OwnerTeamRow = typeof ownerTeams.$inferSelect;
export type TeamMatchRow = typeof teamMatches.$inferSelect;

/** careers.dpos(TEXT) → 세부 포지션. 프리시즌 선수·옛 기록은 null. */
export const dposOf = (v: string | null): DetailPos | null =>
  (DETAIL_POSITIONS as readonly string[]).includes(v ?? '') ? (v as DetailPos) : null;

/** careers.peak_profile(JSON) → 최고 시점 능력치. 이 기능 전에 은퇴한 기록이거나 모양이 틀리면 null. */
export function peakOf(json: string | null): PeakProfile | null {
  if (!json) return null;
  try {
    const p = JSON.parse(json) as Partial<PeakProfile>;
    return p.roles &&
      p.attrs &&
      DETAIL_POSITIONS.every((d) => Number.isFinite(p.roles![d])) &&
      FACE_ATTRS.every((k) => Number.isFinite(p.attrs![k]))
      ? (p as PeakProfile)
      : null;
  } catch {
    return null;
  }
}

/** 팀 행의 선발 11자리(커리어 id, 빈 자리 null). */
export const slotIdsOf = (row: Pick<OwnerTeamRow, 'slotsJson'>): (string | null)[] =>
  JSON.parse(row.slotsJson) as (string | null)[];

/** 팀 시즌(0 = 프리시즌)에 처음 올라온 커리어. */
const inTeamSeason = (season: number) =>
  season === 0 ? isNull(careers.serviceSeason) : eq(careers.serviceSeason, season);

/** 내 팀들(시즌 순). 시즌마다 한 팀이라 몇 개 되지 않는다. */
export function listMyTeams(db: Db, profileId: string) {
  return db
    .select()
    .from(ownerTeams)
    .where(eq(ownerTeams.profileId, profileId))
    .orderBy(asc(ownerTeams.season));
}

/** 그 시즌에 넣을 수 있는 내 은퇴 선수(그 시즌에 처음 올라온 선수, 최고 OVR 순). 은퇴 요약이 없는 기록(peak null)은 뺀다. */
export function listEligibleCareers(db: Db, profileId: string, season: number, limit = 300) {
  return db
    .select({
      id: careers.id,
      pos: careers.pos,
      dpos: careers.dpos,
      peak: careers.peak,
      peakProfile: careers.peakProfile,
      number: careers.shirtNumber,
      publicName: careers.publicName,
      legendScore: careers.legendScore,
    })
    .from(careers)
    .where(
      and(
        eq(careers.profileId, profileId),
        eq(careers.status, 'retired'),
        isNotNull(careers.peak),
        inTeamSeason(season),
      ),
    )
    .orderBy(desc(careers.peak))
    .limit(limit);
}

/** 오늘(한국 시각) 이 구단주가 건 경기 수. sinceIso는 한국 시각 자정의 UTC ISO. */
export function countMatchesSince(db: Db, profileId: string, sinceIso: string) {
  return db
    .select({ n: sql<number>`count(*)` })
    .from(teamMatches)
    .where(and(eq(teamMatches.profileId, profileId), gte(teamMatches.createdAt, sinceIso)));
}

/** 여러 팀 선발의 커리어를 한 번에 읽는다. 소유자·은퇴 여부는 부르는 쪽이 팀마다 확인한다. */
export async function careersByIds(db: Db, ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select({
      id: careers.id,
      profileId: careers.profileId,
      status: careers.status,
      pos: careers.pos,
      dpos: careers.dpos,
      peak: careers.peak,
      peakProfile: careers.peakProfile,
      number: careers.shirtNumber,
      publicName: careers.publicName,
      serviceSeason: careers.serviceSeason,
    })
    .from(careers)
    .where(inArray(careers.id, ids));
}
export type CareerLite = Awaited<ReturnType<typeof careersByIds>>[number];

/** 이 구단주의 그 시즌 팀에 넣을 수 있는 커리어만 골라 선발 맵으로(본인 소유 · 은퇴 · 은퇴 요약 있음 · 그 시즌 선수). */
export function eligibleMap(rows: readonly CareerLite[], ownerId: string, season: number) {
  const map = new Map<string, LineupCareer>();
  for (const r of rows) {
    if (r.profileId !== ownerId || r.status !== 'retired' || r.peak === null) continue;
    if ((r.serviceSeason ?? 0) !== season) continue;
    map.set(r.id, {
      id: r.id,
      pos: r.pos,
      dpos: dposOf(r.dpos),
      peak: r.peak,
      roles: peakOf(r.peakProfile)?.roles ?? null,
      number: r.number,
      publicName: r.publicName,
    });
  }
  return map;
}

/** 팀 한 개 + 구단주 닉네임(상대 팀). 구글 연결이 끊겼거나 삭제된 구단주의 팀은 없는 것으로 본다. */
export async function getTeamWithOwner(db: Db, teamId: string) {
  const [row] = await db
    .select({ team: ownerTeams, nickname: profiles.nickname, email: profiles.email })
    .from(ownerTeams)
    .innerJoin(profiles, eq(profiles.id, ownerTeams.profileId))
    .where(
      and(eq(ownerTeams.id, teamId), isNotNull(profiles.googleSub), isNull(profiles.deletedAt)),
    );
  return row;
}

/** 랭킹·상대에 오르는 팀: 그 시즌 · 선수가 한 명 이상 · 구글 연결이 살아 있는(삭제되지 않은) 구단주. */
const rankedIn = (season: number) =>
  and(
    eq(ownerTeams.season, season),
    gt(ownerTeams.filled, 0),
    isNotNull(profiles.googleSub),
    isNull(profiles.deletedAt),
  );

/** 상대 후보: 같은 시즌 다른 구단주의 팀 중 내 팀 OVR 위·아래로 가까운 팀을 perSide개씩(시즌·OVR 인덱스). */
export async function listOpponentCandidates(
  db: Db,
  profileId: string,
  season: number,
  ovr: number,
  perSide = 8,
) {
  const cols = { team: ownerTeams, nickname: profiles.nickname, email: profiles.email };
  const base = and(rankedIn(season), ne(ownerTeams.profileId, profileId));
  const [up, down] = await db.batch([
    db
      .select(cols)
      .from(ownerTeams)
      .innerJoin(profiles, eq(profiles.id, ownerTeams.profileId))
      .where(and(base, gte(ownerTeams.ovr, ovr)))
      .orderBy(asc(ownerTeams.ovr))
      .limit(perSide),
    db
      .select(cols)
      .from(ownerTeams)
      .innerJoin(profiles, eq(profiles.id, ownerTeams.profileId))
      .where(and(base, lt(ownerTeams.ovr, ovr)))
      .orderBy(desc(ownerTeams.ovr))
      .limit(perSide),
  ]);
  return [...up, ...down];
}

const RANK_ORDER: Record<TeamRankSort, ReturnType<typeof desc>[]> = {
  rating: [desc(ownerTeams.rating), desc(ownerTeams.ovr), asc(ownerTeams.createdAt)],
  ovr: [desc(ownerTeams.ovr), desc(ownerTeams.rating), asc(ownerTeams.createdAt)],
};

/** 라이브 랭킹 한 페이지 + 랭킹에 오른 팀 수. */
export async function listTeamRanking(db: Db, season: number, sort: TeamRankSort, page: number) {
  const [rows, [total]] = await db.batch([
    db
      .select({ team: ownerTeams })
      .from(ownerTeams)
      .innerJoin(profiles, eq(profiles.id, ownerTeams.profileId))
      .where(rankedIn(season))
      .orderBy(...RANK_ORDER[sort], asc(ownerTeams.id))
      .limit(TEAM_RANK_PER_PAGE)
      .offset((page - 1) * TEAM_RANK_PER_PAGE),
    db
      .select({ n: sql<number>`count(*)` })
      .from(ownerTeams)
      .innerJoin(profiles, eq(profiles.id, ownerTeams.profileId))
      .where(rankedIn(season)),
  ]);
  return { rows: rows.map((r) => r.team), total: Number(total?.n ?? 0) };
}

/** 레이팅 순위(랭킹과 같은 순서 — 레이팅 · OVR · 먼저 만든 팀). 랭킹에 오르지 않은 팀(선수 0명)이면 null. */
export async function ratingRankOf(db: Db, t: OwnerTeamRow): Promise<number | null> {
  if (t.filled === 0) return null;
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(ownerTeams)
    .innerJoin(profiles, eq(profiles.id, ownerTeams.profileId))
    .where(
      and(
        rankedIn(t.season),
        or(
          gt(ownerTeams.rating, t.rating),
          and(
            eq(ownerTeams.rating, t.rating),
            or(
              gt(ownerTeams.ovr, t.ovr),
              and(eq(ownerTeams.ovr, t.ovr), lt(ownerTeams.createdAt, t.createdAt)),
            ),
          ),
        ),
      ),
    );
  return Number(row?.n ?? 0) + 1;
}

// ───────── 좋아요 · 조회수(게시판 글과 같은 방식) ─────────

const likeOf = (teamId: string, profileId: string) =>
  and(eq(teamLikes.teamId, teamId), eq(teamLikes.profileId, profileId));

export async function isTeamLiked(db: Db, teamId: string, profileId: string): Promise<boolean> {
  const [row] = await db
    .select({ teamId: teamLikes.teamId })
    .from(teamLikes)
    .where(likeOf(teamId, profileId));
  return !!row;
}

/** 좋아요를 누르거나(like) 거둔다. 같은 batch에서 likes를 다시 세어 늘 실제 행 수와 같다(멱등). 없는 팀이면 undefined. */
export async function setTeamLike(
  db: Db,
  teamId: string,
  profileId: string,
  like: boolean,
  now: string,
): Promise<number | undefined> {
  const [, rows] = (await runBatch(db, [
    like
      ? db
          .insert(teamLikes)
          .select(
            db
              .select({
                teamId: ownerTeams.id,
                profileId: sql`${profileId}`.as('profile_id'),
                createdAt: sql`${now}`.as('created_at'),
              })
              .from(ownerTeams)
              .where(eq(ownerTeams.id, teamId)),
          )
          .onConflictDoNothing()
      : db.delete(teamLikes).where(likeOf(teamId, profileId)),
    db
      .update(ownerTeams)
      .set({
        likes: sql`(SELECT COUNT(*) FROM team_likes l WHERE l.team_id = owner_teams.id)`,
      })
      .where(eq(ownerTeams.id, teamId))
      .returning({ likes: ownerTeams.likes }),
  ])) as [unknown, { likes: number }[]];
  return rows[0]?.likes;
}

/** 조회수 +1. 없는 팀이면 false. */
export async function addTeamView(db: Db, teamId: string): Promise<boolean> {
  const res = await db
    .update(ownerTeams)
    .set({ views: sql`${ownerTeams.views} + 1` })
    .where(eq(ownerTeams.id, teamId));
  return res.meta.changes > 0;
}

export type TeamSnapshot = {
  teamId: string;
  name: string;
  owner: string;
  formation: FormationId;
  ovr: number;
};
export type StoredEvent = {
  minute: number;
  side: 'home' | 'away';
  scorer: PlayerRef;
  assist: PlayerRef | null;
};
/** team_matches.detail_json. */
export type MatchDetail = { home: TeamSnapshot; away: TeamSnapshot; events: StoredEvent[] };

/** 경기 한 판이 팀 행에 더하는 것(득실·레이팅 변화). */
type Side = { teamId: string; filled: number; ovr: number; goals: number; rating: number };

/** 경기 한 판을 남기고 두 팀 전적·레이팅·연승·득실(+ 다시 계산한 선발 수·OVR)을 한 batch로 고친다. 행 쓰기 3번. */
export function recordMatchStatements(
  db: Db,
  input: {
    id: string;
    profileId: string;
    home: Side;
    away: Side;
    detail: MatchDetail;
    now: string;
  },
) {
  const bump = (me: Side, them: Side) => {
    const won = me.goals > them.goals;
    const margin = me.goals - them.goals;
    return db
      .update(ownerTeams)
      .set({
        wins: sql`${ownerTeams.wins} + ${won ? 1 : 0}`,
        draws: sql`${ownerTeams.draws} + ${margin === 0 ? 1 : 0}`,
        losses: sql`${ownerTeams.losses} + ${margin < 0 ? 1 : 0}`,
        goalsFor: sql`${ownerTeams.goalsFor} + ${me.goals}`,
        goalsAgainst: sql`${ownerTeams.goalsAgainst} + ${them.goals}`,
        // 레이팅 변화는 읽은 값으로 셈한 차이만 더한다(동시에 치른 경기가 서로 덮어쓰지 않게).
        rating: sql`${ownerTeams.rating} + ${me.rating}`,
        streak: won ? sql`${ownerTeams.streak} + 1` : 0,
        bestStreak: won
          ? sql`max(${ownerTeams.bestStreak}, ${ownerTeams.streak} + 1)`
          : sql`${ownerTeams.bestStreak}`,
        bestMargin: sql`max(${ownerTeams.bestMargin}, ${Math.max(0, margin)})`,
        filled: me.filled,
        ovr: me.ovr,
      })
      .where(eq(ownerTeams.id, me.teamId));
  };
  return [
    db.insert(teamMatches).values({
      id: input.id,
      profileId: input.profileId,
      homeTeamId: input.home.teamId,
      awayTeamId: input.away.teamId,
      homeGoals: input.home.goals,
      awayGoals: input.away.goals,
      detailJson: JSON.stringify(input.detail),
      createdAt: input.now,
    }),
    bump(input.home, input.away),
    bump(input.away, input.home),
  ] as const;
}

/** 한 팀의 최근 경기(건 경기 + 받은 경기), 최근 limit개. */
export async function listRecentMatches(
  db: Db,
  profileId: string,
  teamId: string,
  limit = 10,
): Promise<TeamMatchRow[]> {
  const [home, away] = await db.batch([
    db
      .select()
      .from(teamMatches)
      .where(and(eq(teamMatches.profileId, profileId), eq(teamMatches.homeTeamId, teamId)))
      .orderBy(desc(teamMatches.createdAt))
      .limit(limit),
    db
      .select()
      .from(teamMatches)
      .where(eq(teamMatches.awayTeamId, teamId))
      .orderBy(desc(teamMatches.createdAt))
      .limit(limit),
  ]);
  return [...home, ...away]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .slice(0, limit);
}

/** 경기 기록에 나온 커리어의 지금 공개 이름. */
export async function publicNamesOf(db: Db, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: careers.id, publicName: careers.publicName })
    .from(careers)
    .where(and(inArray(careers.id, ids), isNotNull(careers.publicName)));
  return new Map(rows.map((r) => [r.id, r.publicName!]));
}

/**
 * 프로필 삭제 batch용(프로필은 소프트 삭제라 FK CASCADE가 돌지 않는다). 그 사람이 누른 좋아요를 지우고(수를 하나씩 빼고)
 * 팀을 지운다 — 팀 경기·팀이 받은 좋아요는 팀 FK CASCADE로 함께 지워진다.
 */
export const deleteOwnerTeamsStatements = (db: Db, profileId: string) => {
  const mine = eq(teamLikes.profileId, profileId);
  return [
    db
      .update(ownerTeams)
      .set({ likes: sql`${ownerTeams.likes} - 1` })
      .where(
        inArray(ownerTeams.id, db.select({ id: teamLikes.teamId }).from(teamLikes).where(mine)),
      ),
    db.delete(teamLikes).where(mine),
    db.delete(ownerTeams).where(eq(ownerTeams.profileId, profileId)),
  ] as const;
};

// ───────── 구단 시즌 업적 ─────────

/** 그 시즌에 처음 올라와(service_season, 팀 시즌 0 = 프리시즌 = NULL) 은퇴한 내 선수 + 영구결번 여부 + 받아 둔 시즌(리그·영예). */
export async function seasonCareersOf(db: Db, profileId: string, season: number) {
  const mine = and(
    eq(careers.profileId, profileId),
    eq(careers.status, 'retired'),
    isNotNull(careers.peak),
    inTeamSeason(season),
  );
  const [rows, seasons] = await db.batch([
    db
      .select({
        id: careers.id,
        pos: careers.pos,
        dpos: careers.dpos,
        caps: careers.caps,
        ballon: careers.ballon,
        trophies: careers.trophies,
        awards: careers.awards,
        apps: careers.apps,
        goals: careers.goals,
        assists: careers.assists,
        legendScore: careers.legendScore,
        rn: retiredNumbers.careerId,
      })
      .from(careers)
      .leftJoin(retiredNumbers, eq(retiredNumbers.careerId, careers.id))
      .where(mine),
    // 선수가 많아도 바인딩 수 한도에 걸리지 않게 id 목록 대신 하위 질의로 고른다.
    db
      .select({
        careerId: careerSeasons.careerId,
        league: careerSeasons.league,
        honorsJson: careerSeasons.honorsJson,
      })
      .from(careerSeasons)
      .where(
        inArray(careerSeasons.careerId, db.select({ id: careers.id }).from(careers).where(mine)),
      ),
  ]);
  const byCareer = new Map<string, { league: string; honors: string[] }[]>();
  for (const r of seasons) {
    const list = byCareer.get(r.careerId) ?? [];
    list.push({ league: r.league, honors: honorsOf(r.honorsJson) });
    byCareer.set(r.careerId, list);
  }
  return rows.map((r) => ({
    pos: r.pos,
    dpos: dposOf(r.dpos),
    caps: r.caps ?? 0,
    ballon: r.ballon ?? 0,
    trophies: r.trophies ?? 0,
    awards: r.awards ?? 0,
    apps: r.apps ?? 0,
    goals: r.goals ?? 0,
    assists: r.assists ?? 0,
    legendScore: r.legendScore ?? 0,
    retiredNumber: r.rn !== null,
    seasons: byCareer.get(r.id) ?? [],
  }));
}

/** 팀 선발 커리어의 업적 재료(마지막 구단 · A매치 · 영구결번). 11명 이하라 id 목록으로 읽는다. */
export async function teamCareerFacts(db: Db, ids: string[]) {
  if (ids.length === 0)
    return new Map<string, { lastClubId: string | null; caps: number; retiredNumber: boolean }>();
  const rows = await db
    .select({
      id: careers.id,
      lastClubId: careers.lastClubId,
      caps: careers.caps,
      rn: retiredNumbers.careerId,
    })
    .from(careers)
    .leftJoin(retiredNumbers, eq(retiredNumbers.careerId, careers.id))
    .where(inArray(careers.id, ids));
  return new Map(
    rows.map((r) => [
      r.id,
      { lastClubId: r.lastClubId, caps: r.caps ?? 0, retiredNumber: r.rn !== null },
    ]),
  );
}
