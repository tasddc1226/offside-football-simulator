import { PeakProfileSchema, TeamLayoutSchema, TeamLogoSchema } from '@offside/contracts';
import type { TeamRankItem, TeamRankSort } from '@offside/contracts';
import { TEAM_RANK_PER_PAGE, type FormationId } from '@offside/contracts/owner-team';
import { DEFAULT_NATION } from '@offside/contracts/nations';
import { CARD_VALUE_FLOOR } from '@offside/contracts/market-value';
import { teamSeasonClosed } from '@offside/contracts/service-seasons';
import {
  DETAIL_POSITIONS,
  FACE_ATTRS,
  dposFor,
  type PeakProfile,
  type PosGroup,
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
  lte,
  ne,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import type { Db } from '../client.js';
import { runBatch } from './batch.js';
import { honorsOf } from './firsts.js';
import {
  cards,
  careerSeasons,
  marketListings,
  careers,
  ownerTeams,
  profiles,
  retiredNumbers,
  teamLikes,
  teamMatches,
} from '../schema.js';
import { accountLinkedSql } from './profiles.js';
import type { AchievementSeason } from '../../team/achievements.js';
import type { LineupCareer, PlayerRef } from '../../team/sim.js';

// T-10-092 구단주 팀(시즌마다 한 팀)·팀 경기·라이브 랭킹.

export type OwnerTeamRow = typeof ownerTeams.$inferSelect;
export type TeamMatchRow = typeof teamMatches.$inferSelect;

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

/** 백필한 수치는 카드에서만 읽는다. 원본 능력치가 있으면 호출하지 않는다. */
export function estimatedAttrsOf(json: string | null): PeakProfile['attrs'] | null {
  if (!json) return null;
  try {
    const p = JSON.parse(json) as { v?: unknown; source?: unknown; attrs?: unknown };
    if (p?.v !== 1 || p.source !== 'estimated') return null;
    const attrs = PeakProfileSchema.shape.attrs.safeParse(p.attrs);
    return attrs.success ? attrs.data : null;
  } catch {
    return null;
  }
}

/** 팀 행의 선발 11자리(커리어 id, 빈 자리 null). */
export const slotIdsOf = (row: Pick<OwnerTeamRow, 'slotsJson'>): (string | null)[] =>
  JSON.parse(row.slotsJson) as (string | null)[];

/** 기존 팀(null)은 포메이션 그대로 읽고, 새 팀의 자유 배치만 덧붙인다. */
export function layoutOf(row: Pick<OwnerTeamRow, 'layoutJson'>) {
  if (!row.layoutJson) return null;
  try {
    const result = TeamLayoutSchema.safeParse(JSON.parse(row.layoutJson));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function logoOf(row: Pick<OwnerTeamRow, 'logoJson'>) {
  if (!row.logoJson) return null;
  try {
    const result = TeamLogoSchema.safeParse(JSON.parse(row.logoJson));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** 경기 목록에 필요한 현재 로고만 한 번에 읽는다. 옛 경기 JSON은 바꾸지 않는다. */
export async function teamLogosByIds(db: Db, ids: readonly string[]) {
  if (ids.length === 0) return new Map<string, ReturnType<typeof logoOf>>();
  const rows = await db
    .select({ id: ownerTeams.id, logoJson: ownerTeams.logoJson })
    .from(ownerTeams)
    .where(inArray(ownerTeams.id, [...new Set(ids)]));
  return new Map(rows.map((row) => [row.id, logoOf(row)]));
}

/** 선발 맵에 넣는 커리어 모양(careers 행 → 팀 선수). */
type LineupRow = {
  id: string;
  pos: PosGroup;
  nation?: string | null;
  dpos: string | null;
  peak: number | null;
  peakProfile: string | null;
  number: number | null;
  publicName: string | null;
  type?: string | null;
  foot?: string | null;
  /** T-11-105 이 팀 구단주가 직접 키운 선수인지(SQL 비교라 0/1일 수 있다). */
  raised?: boolean | number | null;
  serviceSeason?: number | null;
};
export const toLineupCareer = (
  r: LineupRow,
  profile: PeakProfile | null = peakOf(r.peakProfile),
): LineupCareer & { nation: string } => ({
  id: r.id,
  pos: r.pos,
  // 대한민국·국적 기능 이전 커리어는 DB에서 NULL로 저장한다.
  nation: r.nation ?? DEFAULT_NATION,
  dpos: dposFor(r.pos, r.dpos),
  peak: r.peak ?? 0,
  roles: profile?.roles ?? null,
  number: r.number,
  publicName: r.publicName,
  type: r.type ?? null,
  foot: r.foot ?? null,
  raised: !!r.raised,
  season: r.serviceSeason ?? 0,
});

/** 내 팀들(시즌 순). 시즌마다 한 팀이라 몇 개 되지 않는다. */
export function listMyTeams(db: Db, profileId: string) {
  return db
    .select()
    .from(ownerTeams)
    .where(eq(ownerTeams.profileId, profileId))
    .orderBy(asc(ownerTeams.season));
}

/** 그 시즌 내 팀(없으면 빈 배열) — (구단주, 시즌) 유니크 인덱스로 한 행만 읽는다. batch에 넣을 수 있게 쿼리로 돌려준다. */
export const myTeamIn = (db: Db, profileId: string, season: number) =>
  db
    .select()
    .from(ownerTeams)
    .where(and(eq(ownerTeams.profileId, profileId), eq(ownerTeams.season, season)));

/**
 * 그 시즌에 넣을 수 있는 내 선수 카드(그 시즌까지 올라온 선수, 최고 OVR 순). T-11-114 지난 시즌 선수는 와일드카드로
 * 선발에 TEAM_WILDCARD_MAX명까지만 넣는다(PUT이 센다). T-11-080부터 직접 키운 선수 + 영입한
 * 선수 — 소유는 cards.owner_id다. 공개 이름·숨김·옛 추정 능력치·키운 사람은 careers에서 붙인다(기록이 지워졌으면 익명).
 */
export function listEligibleCareers(db: Db, profileId: string, season: number, limit = 300) {
  return db
    .select({
      id: cards.careerId,
      pos: cards.pos,
      nation: cards.nation,
      dpos: cards.dpos,
      peak: cards.peak,
      peakProfile: cards.peakProfile,
      cardAttrsJson: careers.cardAttrsJson,
      number: cards.number,
      publicName: careers.publicName,
      type: careers.type,
      foot: careers.foot,
      serviceSeason: cards.serviceSeason,
      legendScore: cards.legendScore,
      cardValue: cards.cardValue,
      raised: sql<number>`${careers.profileId} = ${profileId}`,
      listingId: marketListings.id,
      listPrice: marketListings.price,
    })
    .from(cards)
    .leftJoin(careers, eq(careers.id, cards.careerId))
    .leftJoin(
      marketListings,
      and(eq(marketListings.careerId, cards.careerId), eq(marketListings.status, 'open')),
    )
    .where(
      and(
        eq(cards.ownerId, profileId),
        lte(cards.serviceSeason, season),
        sql`coalesce(${careers.hidden}, 0) = 0`,
      ),
    )
    .orderBy(desc(cards.peak))
    .limit(limit);
}

/** 오늘(한국 시각) 이 구단주가 건 경기 수. sinceIso는 한국 시각 자정의 UTC ISO. */
export function countMatchesSince(db: Db, profileId: string, sinceIso: string) {
  return db
    .select({ n: sql<number>`count(*)` })
    .from(teamMatches)
    .where(and(eq(teamMatches.profileId, profileId), gte(teamMatches.createdAt, sinceIso)));
}

/**
 * T-10-095 두 팀이 sinceIso 이후 치른 경기(누가 걸었든). 오늘 같은 상대에게 이미 걸었는지와 최근 재대결 횟수(레이팅 감쇠)를
 * 함께 센다. batch에 넣을 수 있게 쿼리로 돌려준다.
 */
export const meetingsSince = (db: Db, teamA: string, teamB: string, sinceIso: string) => {
  // 날짜 조건을 갈래마다 넣어야 두 갈래 모두 (away_team_id, created_at) 인덱스 범위로 찾는다.
  const leg = (home: string, away: string) =>
    and(
      eq(teamMatches.awayTeamId, away),
      gte(teamMatches.createdAt, sinceIso),
      eq(teamMatches.homeTeamId, home),
    );
  return db
    .select({ n: sql<number>`count(*)` })
    .from(teamMatches)
    .where(or(leg(teamA, teamB), leg(teamB, teamA)));
};

/**
 * 이 구단주가 sinceIso 이후 건 경기의 상대 팀(경기마다 한 줄). 오늘 경기 수·오늘 이미 건 상대(T-10-095)를 한 번에 센다 —
 * 상대 후보에서 빼는 하위 쿼리로도 쓴다.
 */
export const challengedSince = (db: Db, profileId: string, sinceIso: string) =>
  db
    .select({ teamId: teamMatches.awayTeamId })
    .from(teamMatches)
    .where(and(eq(teamMatches.profileId, profileId), gte(teamMatches.createdAt, sinceIso)));

/**
 * 여러 팀 선발의 카드를 한 번에 읽는다. 소유자는 부르는 쪽이 팀마다 확인한다(eligibleMap). 팀 업적이 보는 기록(마지막
 * 구단·A매치·영구결번)도 함께 읽어 업적 판정이 화면과 같은 선발을 쓴다(T-11-103).
 */
export async function careersByIds(db: Db, ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select({
      id: cards.careerId,
      ownerId: cards.ownerId,
      pos: cards.pos,
      nation: cards.nation,
      dpos: cards.dpos,
      peak: cards.peak,
      peakProfile: cards.peakProfile,
      number: cards.number,
      publicName: careers.publicName,
      type: careers.type,
      foot: careers.foot,
      raiserId: careers.profileId,
      serviceSeason: cards.serviceSeason,
      hidden: sql<number>`coalesce(${careers.hidden}, 0)`,
      lastClubId: careers.lastClubId,
      caps: careers.caps,
      rn: retiredNumbers.careerId,
    })
    .from(cards)
    .leftJoin(careers, eq(careers.id, cards.careerId))
    .leftJoin(retiredNumbers, eq(retiredNumbers.careerId, cards.careerId))
    .where(inArray(cards.careerId, ids));
}
export type CareerLite = Awaited<ReturnType<typeof careersByIds>>[number];

/**
 * 그 구단주의 그 시즌 팀에 넣을 수 있는 카드만 골라 선발 맵으로(그 시즌까지의 선수 · 숨김 아님, T-11-114). T-11-080 소유 규칙: 지금
 * 시즌 팀(open)은 지금 주인인지 확인하고, 닫힌 시즌 팀은 그 뒤 방출·이적과 상관없이 id로 읽기만 한다.
 */
export function eligibleMap(
  rows: readonly CareerLite[],
  ownerId: string,
  season: number,
  open: boolean,
) {
  const map = new Map<string, ReturnType<typeof toLineupCareer>>();
  for (const r of rows) {
    if (open && r.ownerId !== ownerId) continue;
    if (r.serviceSeason > season || r.hidden) continue;
    map.set(r.id, toLineupCareer({ ...r, raised: r.raiserId === ownerId }));
  }
  return map;
}

/** 팀 한 개(없으면 빈 배열). 구글 연결이 끊겼거나 삭제된 구단주의 팀은 없는 것으로 본다. batch에 넣을 수 있게 쿼리로 돌려준다. */
export const liveTeam = (db: Db, teamId: string) =>
  db
    .select({ team: ownerTeams })
    .from(ownerTeams)
    .innerJoin(profiles, eq(profiles.id, ownerTeams.profileId))
    .where(and(eq(ownerTeams.id, teamId), accountLinkedSql(), isNull(profiles.deletedAt)));

/** 랭킹·상대에 오르는 팀: 그 시즌 · 선수가 한 명 이상 · 구글 연결이 살아 있는(삭제되지 않은) 구단주. */
const rankedIn = (season: number) =>
  and(
    eq(ownerTeams.season, season),
    gt(ownerTeams.filled, 0),
    accountLinkedSql(),
    isNull(profiles.deletedAt),
  );

/** T-11-113 친선전용 편성(friendly_json)에 담는 칸. */
export type FriendlyLineup = Pick<
  OwnerTeamRow,
  'name' | 'manager' | 'formation' | 'slotsJson' | 'layoutJson' | 'logoJson' | 'filled' | 'ovr'
>;

/**
 * T-11-113 친선전·내 팀 화면에서 쓰는 팀: 끝난 시즌 팀을 친선전용으로 고쳤으면 그 편성을 덮어 쓴다. 랭킹·팀 프로필·업적은
 * 원래 행(최종 기록)을 그대로 읽는다.
 */
export function friendlyTeamOf(row: OwnerTeamRow): OwnerTeamRow {
  if (!row.friendlyJson) return row;
  try {
    return { ...row, ...(JSON.parse(row.friendlyJson) as FriendlyLineup) };
  } catch {
    return row;
  }
}

/**
 * T-11-113 창단 멤버: 프리시즌(service_season 0)에 숨김 아닌 은퇴 선수를 남긴 구단주만 골라 돌려준다(커리어 프로필·상태·시즌
 * 인덱스). batch에 넣을 수 있게 쿼리로 돌려준다.
 */
export const foundersOf = (db: Db, profileIds: readonly string[]) =>
  db
    .selectDistinct({ profileId: careers.profileId })
    .from(careers)
    .where(
      and(
        inArray(careers.profileId, [...profileIds]),
        eq(careers.status, 'retired'),
        eq(careers.serviceSeason, 0),
        eq(careers.hidden, 0),
      ),
    );

/**
 * 상대 후보: 같은 시즌 다른 구단주의 팀 중 내 팀 OVR 위·아래로 가까운 팀을 perSide개씩(시즌·OVR 인덱스). 오늘(todayStart
 * 이후) 이미 건 팀은 뺀다(T-10-095).
 */
export async function listOpponentCandidates(
  db: Db,
  profileId: string,
  season: number,
  mine: { rating: number; ovr: number },
  todayStart: string,
  perSide = 8,
) {
  const cols = { team: ownerTeams };
  const base = and(
    rankedIn(season),
    ne(ownerTeams.profileId, profileId),
    notInArray(ownerTeams.id, challengedSince(db, profileId, todayStart)),
  );
  // 레이팅이 같으면(시즌 초에는 거의 다 1000) OVR이 가까운 팀부터.
  const ovrGap = sql`abs(${ownerTeams.ovr} - ${mine.ovr})`;
  const [up, down] = await db.batch([
    db
      .select(cols)
      .from(ownerTeams)
      .innerJoin(profiles, eq(profiles.id, ownerTeams.profileId))
      .where(and(base, gte(ownerTeams.rating, mine.rating)))
      .orderBy(asc(ownerTeams.rating), ovrGap)
      .limit(perSide),
    db
      .select(cols)
      .from(ownerTeams)
      .innerJoin(profiles, eq(profiles.id, ownerTeams.profileId))
      .where(and(base, lt(ownerTeams.rating, mine.rating)))
      .orderBy(desc(ownerTeams.rating), ovrGap)
      .limit(perSide),
  ]);
  return [...up, ...down].map((r) => r.team);
}

/**
 * T-11-129 구단 가치 = 선발 11명 카드 기준가 합(만 원). 선발로 실제 뛰는 카드만 센다(eligibleMap과 같은 규칙): 그 시즌까지의
 * 숨기지 않은 카드, 진행 중 시즌이면 지금 그 구단주가 가진 카드. 기준가가 아직 없는 카드는 하한(CARD_VALUE_FLOOR)으로.
 * cross join으로 슬롯 11칸에서 카드 기본키로 찾게 순서를 고정한다 — 그냥 join이면 플래너가 구단주의 카드 전체
 * (cards_owner_season_idx)부터 훑어 운영에서 읽는 행이 10배 늘었다(49,186 → 4,722, 2026-10-06 측정).
 */
const lineupValueSql = (open: boolean) => sql<number>`(
  select coalesce(sum(coalesce(${cards.cardValue}, ${CARD_VALUE_FLOOR})), 0)
  from json_each(${ownerTeams.slotsJson}) as slot
  cross join ${cards} on ${cards.careerId} = slot.value
  left join ${careers} on ${careers.id} = ${cards.careerId}
  where ${cards.serviceSeason} <= ${ownerTeams.season} and coalesce(${careers.hidden}, 0) = 0
  ${open ? sql`and ${cards.ownerId} = ${ownerTeams.profileId}` : sql``}
)`;

const rankOrder = (sort: TeamRankSort, value: ReturnType<typeof lineupValueSql>) =>
  ({
    rating: [desc(ownerTeams.rating), desc(ownerTeams.ovr), asc(ownerTeams.createdAt)],
    ovr: [desc(ownerTeams.ovr), desc(ownerTeams.rating), asc(ownerTeams.createdAt)],
    value: [desc(value), desc(ownerTeams.rating), asc(ownerTeams.createdAt)],
  })[sort];

/** 라이브 랭킹 한 페이지 + 랭킹에 오른 팀 수. 팀마다 구단 가치(value)를 함께 센다. */
export async function listTeamRanking(
  db: Db,
  season: number,
  sort: TeamRankSort,
  page: number,
  now: string,
) {
  const value = lineupValueSql(!teamSeasonClosed(season, now));
  const [rows, [total]] = await db.batch([
    db
      .select({ team: ownerTeams, value })
      .from(ownerTeams)
      .innerJoin(profiles, eq(profiles.id, ownerTeams.profileId))
      .where(rankedIn(season))
      .orderBy(...rankOrder(sort, value), asc(ownerTeams.id))
      .limit(TEAM_RANK_PER_PAGE)
      .offset((page - 1) * TEAM_RANK_PER_PAGE),
    db
      .select({ n: sql<number>`count(*)` })
      .from(ownerTeams)
      .innerJoin(profiles, eq(profiles.id, ownerTeams.profileId))
      .where(rankedIn(season)),
  ]);
  return {
    rows: rows.map((r) => ({ ...r.team, value: Number(r.value) })),
    total: Number(total?.n ?? 0),
  };
}

/** 한 페이지의 최근 전적을 한 쿼리로 읽는다. 인덱스로 팀마다 홈·원정 각 5개만 읽고 합친다. */
export async function listTeamRecentForm(db: Db, teamIds: readonly string[]) {
  const forms = new Map<string, TeamRankItem['recentForm']>();
  if (teamIds.length === 0) return forms;
  const matches = await db.all<{ teamId: string; result: TeamRankItem['recentForm'][number] }>(sql`
    WITH requested AS (SELECT value AS teamId FROM json_each(${JSON.stringify(teamIds)}))
    SELECT teamId, result FROM (
      SELECT t.teamId, m.id, m.created_at AS createdAt,
        CASE WHEN m.home_goals > m.away_goals THEN 'W' WHEN m.home_goals = m.away_goals THEN 'D' ELSE 'L' END AS result
      FROM requested t JOIN team_matches m ON m.id IN (
        SELECT id FROM team_matches WHERE home_team_id = t.teamId
        ORDER BY created_at DESC, id DESC LIMIT 5
      )
      UNION ALL
      SELECT t.teamId, m.id, m.created_at AS createdAt,
        CASE WHEN m.away_goals > m.home_goals THEN 'W' WHEN m.away_goals = m.home_goals THEN 'D' ELSE 'L' END AS result
      FROM requested t JOIN team_matches m ON m.id IN (
        SELECT id FROM team_matches WHERE away_team_id = t.teamId
        ORDER BY created_at DESC, id DESC LIMIT 5
      )
    )
    ORDER BY createdAt DESC, id DESC
  `);
  for (const match of matches) {
    const form = forms.get(match.teamId) ?? [];
    if (form.length < 5) form.push(match.result);
    forms.set(match.teamId, form);
  }
  return forms;
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
  /** 이 경기로 바뀐 레이팅(T-10-095부터 남긴다). */
  ratingChange?: number;
  /** 이 경기에 반영된 시너지 id(T-11-105, 반영 시즌 경기만). */
  synergy?: string[];
};
export type StoredEvent = {
  minute: number;
  side: 'home' | 'away';
  scorer: PlayerRef;
  assist: PlayerRef | null;
};
/** team_matches.detail_json. 시너지 반영 시즌 경기는 TeamSnapshot.synergy에 켜진 시너지 id를 남긴다(T-11-105). */
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

/**
 * 그 시즌에 처음 올라와(service_season, 0 = 프리시즌) 은퇴한 내 선수(직접 키운 선수) + 영구결번 여부 + 받아 둔 시즌(리그·영예).
 * 팀 선발은 영입한 선수도 들어가므로 여기서 만들지 않고 careersByIds로 읽는다(T-11-103).
 */
export async function seasonCareersOf(db: Db, profileId: string, season: number) {
  const mine = and(
    eq(careers.profileId, profileId),
    eq(careers.status, 'retired'),
    isNotNull(careers.peak),
    eq(careers.serviceSeason, season),
    // T-11-028 업적 점수가 공개 랭킹이 되므로 공개 순위에서 뺀 기록(자동 플레이)은 세지 않는다.
    eq(careers.hidden, 0),
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
        nation: careers.nation,
        retireAge: careers.retireAge,
        retiredAt: careers.retiredAt,
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
        club: careerSeasons.club,
        clubId: careerSeasons.clubId,
        goals: careerSeasons.goals,
        cs: careerSeasons.cs,
      })
      .from(careerSeasons)
      .where(
        inArray(careerSeasons.careerId, db.select({ id: careers.id }).from(careers).where(mine)),
      ),
  ]);
  const byCareer = new Map<string, AchievementSeason[]>();
  for (const r of seasons) {
    const list = byCareer.get(r.careerId) ?? [];
    list.push({
      league: r.league,
      honors: honorsOf(r.honorsJson),
      club: r.club,
      clubId: r.clubId,
      goals: r.goals,
      cs: r.cs,
    });
    byCareer.set(r.careerId, list);
  }
  return rows.map((r) => ({
    id: r.id,
    pos: r.pos,
    dpos: dposFor(r.pos, r.dpos),
    caps: r.caps ?? 0,
    ballon: r.ballon ?? 0,
    trophies: r.trophies ?? 0,
    awards: r.awards ?? 0,
    apps: r.apps ?? 0,
    goals: r.goals ?? 0,
    assists: r.assists ?? 0,
    legendScore: r.legendScore ?? 0,
    retiredNumber: r.rn !== null,
    nation: r.nation,
    retireAge: r.retireAge ?? 0,
    retiredAt: r.retiredAt,
    seasons: byCareer.get(r.id) ?? [],
  }));
}
