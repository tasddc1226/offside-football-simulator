// T-11-028 구단주 시즌 업적 점수(업적 랭킹). 업적 자체는 그때그때 계산하고(team/achievements.ts) 점수만 적어 둔다.
import { ACH_RANK_PER_PAGE } from '@offside/contracts/owner-team';
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gt,
  isNull,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import type { Db } from '../client.js';
import { ownerAchievements, ownerTeams, profiles, teamLikes, teamMatches } from '../schema.js';
import { accountLinkedSql } from './profiles.js';

export type AchievementRow = typeof ownerAchievements.$inferSelect;
export type AchievementScore = Pick<AchievementRow, 'score' | 'done' | 'players' | 'teamKept'>;

/** 랭킹에 오르는 행: 점수가 있고, 로그인 수단이 연결된 삭제되지 않은 구단주. */
const rankedIn = (season: number) =>
  and(
    eq(ownerAchievements.season, season),
    gt(ownerAchievements.score, 0),
    accountLinkedSql(),
    isNull(profiles.deletedAt),
  );

export async function achievementRowOf(db: Db, profileId: string, season: number) {
  const [row] = await db
    .select()
    .from(ownerAchievements)
    .where(and(eq(ownerAchievements.profileId, profileId), eq(ownerAchievements.season, season)));
  return row;
}

/**
 * 점수를 적는다. 그대로면 쓰지 않는다 — touch(은퇴·팀 저장·경기 뒤와 cron)면 updated_at만이라도 고쳐 cron이 같은
 * 구단주를 다시 세지 않게 한다. reached_at은 점수가 바뀔 때만 옮긴다 — 같은 점수면 먼저 닿은 구단주가 앞선다.
 */
export async function saveAchievementScore(
  db: Db,
  prev: AchievementRow | undefined,
  key: { profileId: string; season: number },
  next: AchievementScore,
  now: string,
  touch: boolean,
): Promise<AchievementRow> {
  const same =
    !!prev &&
    prev.score === next.score &&
    prev.done === next.done &&
    prev.players === next.players &&
    prev.teamKept === next.teamKept;
  if (same && !touch) return prev;
  const reachedAt = prev && prev.score === next.score ? prev.reachedAt : now;
  const row = { ...key, ...next, reachedAt, updatedAt: now };
  await db
    .insert(ownerAchievements)
    .values(row)
    .onConflictDoUpdate({
      target: [ownerAchievements.profileId, ownerAchievements.season],
      set: {
        score: next.score,
        done: next.done,
        players: next.players,
        teamKept: next.teamKept,
        reachedAt,
        updatedAt: now,
      },
    });
  return row;
}

/** 랭킹 순위(점수 · 먼저 닿은 순)와 랭킹에 오른 구단주 수. 점수가 0이면 순위는 null. */
export async function achievementRankOf(db: Db, row: AchievementRow) {
  const ahead = and(
    rankedIn(row.season),
    or(
      gt(ownerAchievements.score, row.score),
      and(
        eq(ownerAchievements.score, row.score),
        or(
          lt(ownerAchievements.reachedAt, row.reachedAt),
          and(
            eq(ownerAchievements.reachedAt, row.reachedAt),
            lt(ownerAchievements.profileId, row.profileId),
          ),
        ),
      ),
    ),
  );
  const counted = (where: ReturnType<typeof rankedIn>) =>
    db
      .select({ n: count() })
      .from(ownerAchievements)
      .innerJoin(profiles, eq(profiles.id, ownerAchievements.profileId))
      .where(where);
  const [[a], [t]] = await db.batch([counted(ahead), counted(rankedIn(row.season))]);
  return {
    rank: row.score > 0 ? Number(a?.n ?? 0) + 1 : null,
    ranked: Number(t?.n ?? 0),
  };
}

export async function listAchievementRanking(db: Db, season: number, page: number) {
  const [rows, [total]] = await db.batch([
    db
      .select({
        score: ownerAchievements.score,
        done: ownerAchievements.done,
        players: ownerAchievements.players,
        nickname: profiles.nickname,
        title: profiles.title,
        teamId: ownerTeams.id,
        teamName: ownerTeams.name,
        logoJson: ownerTeams.logoJson,
      })
      .from(ownerAchievements)
      .innerJoin(profiles, eq(profiles.id, ownerAchievements.profileId))
      .leftJoin(
        ownerTeams,
        and(
          eq(ownerTeams.profileId, ownerAchievements.profileId),
          eq(ownerTeams.season, ownerAchievements.season),
        ),
      )
      .where(rankedIn(season))
      .orderBy(
        desc(ownerAchievements.score),
        asc(ownerAchievements.reachedAt),
        asc(ownerAchievements.profileId),
      )
      .limit(ACH_RANK_PER_PAGE)
      .offset((page - 1) * ACH_RANK_PER_PAGE),
    db
      .select({ n: count() })
      .from(ownerAchievements)
      .innerJoin(profiles, eq(profiles.id, ownerAchievements.profileId))
      .where(rankedIn(season)),
  ]);
  return { rows, total: Number(total?.n ?? 0) };
}

/** 그 시즌 구단주 활동 — 팀 경기를 건 날 수(한국 시각)와 다른 팀에 누른 좋아요 수. T-11-128 asOf면 그 시각까지만. */
export async function ownerActivityIn(
  db: Db,
  profileId: string,
  season: number,
  teamId: string | null,
  asOf?: string,
) {
  const likes = db
    .select({ n: count() })
    .from(teamLikes)
    .innerJoin(ownerTeams, eq(ownerTeams.id, teamLikes.teamId))
    .where(
      and(
        eq(teamLikes.profileId, profileId),
        eq(ownerTeams.season, season),
        asOf ? lte(teamLikes.createdAt, asOf) : undefined,
      ),
    );
  // 팀이 없으면 건 경기도 없다 — 구단주의 지난 시즌 경기까지 읽지 않게 건너뛴다.
  if (teamId === null) {
    const [l] = await likes;
    return { matchDays: 0, likesGiven: Number(l?.n ?? 0) };
  }
  const [[m], [l]] = await db.batch([
    db
      .select({ n: countDistinct(sql`date(${teamMatches.createdAt}, '+9 hours')`) })
      .from(teamMatches)
      .where(
        and(
          eq(teamMatches.profileId, profileId),
          eq(teamMatches.homeTeamId, teamId),
          asOf ? lte(teamMatches.createdAt, asOf) : undefined,
        ),
      ),
    likes,
  ]);
  return { matchDays: Number(m?.n ?? 0), likesGiven: Number(l?.n ?? 0) };
}

/**
 * 매일 cron이 점수를 다시 셀 구단주 — 그 시즌 마지막 은퇴나 팀 기록이 적어 둔 점수보다 새롭다(또는 아직 없다).
 * 업적 화면·은퇴·팀 저장·경기 뒤에 바로 다시 세므로 대개는 비어 있고, 놓친 것(배포 전 기록 · 실패한 갱신)만 잡는다.
 */
export async function staleAchievementOwners(
  db: Db,
  season: number,
  limit: number,
): Promise<string[]> {
  const rows = await db.all<{ id: string }>(sql`
    select x.profile_id as id from (
      select profile_id, max(retired_at) as t from careers
        where service_season = ${season} and status = 'retired' and hidden = 0 and peak is not null
        group by profile_id
      union all
      select profile_id, updated_at as t from owner_teams where season = ${season}
    ) x
    join profiles p on p.id = x.profile_id
    left join owner_achievements a on a.profile_id = x.profile_id and a.season = ${season}
    where (p.google_sub is not null or p.apple_sub is not null) and p.deleted_at is null
      and (a.updated_at is null or x.t > a.updated_at)
    group by x.profile_id
    limit ${limit}`);
  return rows.map((r) => r.id);
}
