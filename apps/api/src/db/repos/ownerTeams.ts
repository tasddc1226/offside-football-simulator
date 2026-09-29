import type { FormationId } from '@offside/contracts/owner-team';
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
  type SQL,
} from 'drizzle-orm';
import type { Db } from '../client.js';
import { honorsOf } from './firsts.js';
import {
  careerSeasons,
  careers,
  ownerTeams,
  profiles,
  retiredNumbers,
  teamMatches,
} from '../schema.js';
import type { LineupCareer, PlayerRef } from '../../team/sim.js';

// T-10-092 구단주 팀·팀 경기.

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

/** 내 팀들(만든 순서). */
export function listMyTeams(db: Db, profileId: string) {
  return db
    .select()
    .from(ownerTeams)
    .where(eq(ownerTeams.profileId, profileId))
    .orderBy(asc(ownerTeams.createdAt));
}

/** 팀에 넣을 수 있는 내 은퇴 선수(최고 OVR 순). 은퇴 요약이 없는 기록(peak null)은 뺀다. */
export function listEligibleCareers(db: Db, profileId: string, limit = 300) {
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
      and(eq(careers.profileId, profileId), eq(careers.status, 'retired'), isNotNull(careers.peak)),
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
    })
    .from(careers)
    .where(inArray(careers.id, ids));
}
export type CareerLite = Awaited<ReturnType<typeof careersByIds>>[number];

/** 이 구단주의 팀에 넣을 수 있는 커리어만 골라 선발 맵으로(본인 소유 · 은퇴 · 은퇴 요약 있음). */
export function eligibleMap(rows: readonly CareerLite[], ownerId: string) {
  const map = new Map<string, LineupCareer>();
  for (const r of rows) {
    if (r.profileId !== ownerId || r.status !== 'retired' || r.peak === null) continue;
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

/**
 * 상대 후보: 선수가 한 명 이상 있는 다른 구단주의 팀 중 내 팀 OVR 위·아래로 가까운 팀을 perSide개씩(OVR 인덱스).
 * 구글 연결이 끊겼거나 삭제된 구단주의 팀은 뺀다.
 */
export async function listOpponentCandidates(db: Db, profileId: string, ovr: number, perSide = 8) {
  const cols = { team: ownerTeams, nickname: profiles.nickname, email: profiles.email };
  const base = and(
    ne(ownerTeams.profileId, profileId),
    gt(ownerTeams.filled, 0),
    isNotNull(profiles.googleSub),
    isNull(profiles.deletedAt),
  );
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

type ResultDelta = { w: number; d: number; l: number };
const deltaOf = (forGoals: number, againstGoals: number): ResultDelta =>
  forGoals > againstGoals
    ? { w: 1, d: 0, l: 0 }
    : forGoals < againstGoals
      ? { w: 0, d: 0, l: 1 }
      : { w: 0, d: 1, l: 0 };

/** 경기 한 판을 남기고 두 팀 전적(+ 다시 계산한 선발 수·OVR)을 한 batch로 고친다. 행 쓰기 3번. */
export function recordMatchStatements(
  db: Db,
  input: {
    id: string;
    profileId: string;
    home: { teamId: string; filled: number; ovr: number };
    away: { teamId: string; filled: number; ovr: number };
    homeGoals: number;
    awayGoals: number;
    detail: MatchDetail;
    now: string;
  },
) {
  const bump = (side: { teamId: string; filled: number; ovr: number }, d: ResultDelta) =>
    db
      .update(ownerTeams)
      .set({
        wins: sql`${ownerTeams.wins} + ${d.w}`,
        draws: sql`${ownerTeams.draws} + ${d.d}`,
        losses: sql`${ownerTeams.losses} + ${d.l}`,
        filled: side.filled,
        ovr: side.ovr,
      })
      .where(eq(ownerTeams.id, side.teamId));
  return [
    db.insert(teamMatches).values({
      id: input.id,
      profileId: input.profileId,
      homeTeamId: input.home.teamId,
      awayTeamId: input.away.teamId,
      homeGoals: input.homeGoals,
      awayGoals: input.awayGoals,
      detailJson: JSON.stringify(input.detail),
      createdAt: input.now,
    }),
    bump(input.home, deltaOf(input.homeGoals, input.awayGoals)),
    bump(input.away, deltaOf(input.awayGoals, input.homeGoals)),
  ] as const;
}

/** 내가 건 경기 + 내 팀이 상대였던 경기, 최근 limit개. */
export async function listRecentMatches(
  db: Db,
  profileId: string,
  teamIds: string[],
  limit = 10,
): Promise<TeamMatchRow[]> {
  const mine = db
    .select()
    .from(teamMatches)
    .where(eq(teamMatches.profileId, profileId))
    .orderBy(desc(teamMatches.createdAt))
    .limit(limit);
  if (teamIds.length === 0) return mine;
  const [home, away] = await db.batch([
    mine,
    db
      .select()
      .from(teamMatches)
      .where(inArray(teamMatches.awayTeamId, teamIds))
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

/** 프로필 삭제 batch용(프로필은 소프트 삭제라 FK CASCADE가 돌지 않는다). 팀 경기는 팀 FK CASCADE로 함께 지워진다. */
export const deleteOwnerTeamsStatement = (db: Db, profileId: string) =>
  db.delete(ownerTeams).where(eq(ownerTeams.profileId, profileId));

// ───────── 구단 시즌 업적 ─────────

/** 시각 범위 [from, to) — 구단 업적의 시즌 기간(null이면 그쪽 끝이 열려 있다). */
export type Window = { from: string | null; to: string | null };
const inWindow = (w: Window): SQL | undefined =>
  and(
    w.from ? gte(teamMatches.createdAt, w.from) : undefined,
    w.to ? lt(teamMatches.createdAt, w.to) : undefined,
  );

/** 그 시즌에 처음 올라와(service_season, null = 프리시즌) 은퇴한 내 선수 + 영구결번 여부 + 받아 둔 시즌(리그·영예). */
export async function seasonCareersOf(db: Db, profileId: string, season: number | null) {
  const mine = and(
    eq(careers.profileId, profileId),
    eq(careers.status, 'retired'),
    isNotNull(careers.peak),
    season === null ? isNull(careers.serviceSeason) : eq(careers.serviceSeason, season),
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

/** 기간 안에 내 팀이 이긴 경기 수(건 경기·받은 경기 모두). */
export async function countTeamWins(db: Db, teamIds: string[], w: Window): Promise<number> {
  if (teamIds.length === 0) return 0;
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(teamMatches)
    .where(
      and(
        inWindow(w),
        or(
          and(
            inArray(teamMatches.homeTeamId, teamIds),
            sql`${teamMatches.homeGoals} > ${teamMatches.awayGoals}`,
          ),
          and(
            inArray(teamMatches.awayTeamId, teamIds),
            sql`${teamMatches.awayGoals} > ${teamMatches.homeGoals}`,
          ),
        ),
      ),
    );
  return Number(row?.n ?? 0);
}
