// T-11-387 장면 경기(team_live_matches) 읽기 · 쓰기.
import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { ownerTeams, teamLiveMatches } from '../schema.js';

export type TeamLiveRow = typeof teamLiveMatches.$inferSelect;

export const insertLive = (db: Db, row: typeof teamLiveMatches.$inferInsert) =>
  db.insert(teamLiveMatches).values(row);

export const liveById = (db: Db, id: string) =>
  db.select().from(teamLiveMatches).where(eq(teamLiveMatches.id, id)).get();

/** 내가 오늘 시작해서 아직 끝나지 않은 장면 경기(하루 경기 수 · 같은 상대 하루 한 번에 센다). */
export const openLiveSince = (db: Db, profileId: string, sinceIso: string) =>
  db
    .select({ id: teamLiveMatches.id, teamId: teamLiveMatches.awayTeamId })
    .from(teamLiveMatches)
    .where(
      and(
        eq(teamLiveMatches.profileId, profileId),
        gte(teamLiveMatches.createdAt, sinceIso),
        isNull(teamLiveMatches.doneAt),
      ),
    );

/** 장면을 고른 상태를 적는다. 읽은 rev가 그대로일 때만 바뀐다(동시 요청이 서로 덮어쓰지 않게). */
export const saveLiveState = (db: Db, id: string, rev: number, stateJson: string) =>
  db
    .update(teamLiveMatches)
    .set({ stateJson, rev: rev + 1 })
    .where(
      and(eq(teamLiveMatches.id, id), eq(teamLiveMatches.rev, rev), isNull(teamLiveMatches.doneAt)),
    );

/** 마감 표시(경기 기록과 같은 batch에 넣는다). */
export const markLiveDone = (
  db: Db,
  id: string,
  stateJson: string,
  resultJson: string,
  now: string,
) =>
  db
    .update(teamLiveMatches)
    .set({ stateJson, resultJson, doneAt: now, rev: sql`${teamLiveMatches.rev} + 1` })
    .where(and(eq(teamLiveMatches.id, id), isNull(teamLiveMatches.doneAt)));

/** 고르지 않고 떠난 지 오래된 경기(cron이 마감한다). */
export const staleLive = (db: Db, beforeIso: string, limit: number) =>
  db
    .select()
    .from(teamLiveMatches)
    .where(and(isNull(teamLiveMatches.doneAt), lt(teamLiveMatches.createdAt, beforeIso)))
    .orderBy(teamLiveMatches.createdAt)
    .limit(limit);

/** 마감한 지 오래된 줄을 지운다. */
export const purgeDoneLive = (db: Db, beforeIso: string) =>
  db.delete(teamLiveMatches).where(lt(teamLiveMatches.doneAt, beforeIso));

/** 마감할 때 두 팀의 지금 행(레이팅 · 전적). */
export const teamsForLive = (db: Db, homeId: string, awayId: string) =>
  db.batch([
    db.select().from(ownerTeams).where(eq(ownerTeams.id, homeId)),
    db.select().from(ownerTeams).where(eq(ownerTeams.id, awayId)),
  ]);
