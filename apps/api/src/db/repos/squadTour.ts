import { TOUR_TRIES_PER_DAY } from '@offside/contracts/squad-tour';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { ownerTeams, tourMatches, tourProgress } from '../schema.js';

// T-11-825 원정 투어 저장. 도전 한 번(tour_matches 한 줄)에 도전권 차감 · 결과 · 첫 승리 대전료를 묶는다. 마감은 "아직 live인 그
// 경기"를 조건으로 한 batch(한 트랜잭션)라 같은 요청이 다시 와도, 자정을 넘겨도 한 번만 반영된다.

/** 대전료의 거래 기록 kind(owner_fund_ledger). ref는 '<주>:<경기 번호>'. */
export const TOUR_FEE_KIND = 'tour_fee';

export type TourProgressRow = typeof tourProgress.$inferSelect;
export type TourMatchRow = typeof tourMatches.$inferSelect;

export const starsOf = (row: Pick<TourProgressRow, 'starsJson'> | undefined) => {
  try {
    return (row ? JSON.parse(row.starsJson) : {}) as Record<string, number>;
  } catch {
    return {};
  }
};

/** 투어 홈에 필요한 내 값: 이번 주 진행 · 오늘 쓴 도전 수 · 진행 중인 경기. 쿼리 세 개를 한 번에 보낸다. */
export async function tourMine(db: Db, profileId: string, week: string, day: string) {
  const [progress, used, live] = await db.batch([
    db
      .select()
      .from(tourProgress)
      .where(and(eq(tourProgress.profileId, profileId), eq(tourProgress.week, week))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(tourMatches)
      .where(and(eq(tourMatches.profileId, profileId), eq(tourMatches.day, day))),
    db
      .select()
      .from(tourMatches)
      .where(and(eq(tourMatches.profileId, profileId), eq(tourMatches.status, 'live'))),
  ]);
  return {
    progress: progress[0],
    triesLeft: Math.max(0, TOUR_TRIES_PER_DAY - (used[0]?.n ?? 0)),
    live: live[0],
  };
}

/** 내 주간 순위(점수 → 그 점수까지 쓴 도전 수 → 먼저 이른 시각). 점수가 없으면 null. */
export async function tourRankOf(db: Db, me: TourProgressRow | undefined): Promise<number | null> {
  if (!me || me.score <= 0 || !me.reachedAt) return null;
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(tourProgress)
    .where(
      and(
        eq(tourProgress.week, me.week),
        sql`(${tourProgress.score} > ${me.score}
          OR (${tourProgress.score} = ${me.score} AND ${tourProgress.triesAtScore} < ${me.triesAtScore})
          OR (${tourProgress.score} = ${me.score} AND ${tourProgress.triesAtScore} = ${me.triesAtScore}
              AND ${tourProgress.reachedAt} < ${me.reachedAt}))`,
      ),
    );
  return (row?.n ?? 0) + 1;
}

export const tourMatchOf = (db: Db, profileId: string, id: string) =>
  db
    .select()
    .from(tourMatches)
    .where(and(eq(tourMatches.id, id), eq(tourMatches.profileId, profileId)));

/**
 * 도전을 시작한다(도전권 한 번). 오늘 쓴 판 수가 남아 있고 진행 중인 경기가 없을 때만 줄이 들어간다(진행 중 경기는 부분 유일
 * 인덱스가 한 번 더 막는다). 같은 batch에서 그 주 도전 수를 올린다. 들어가지 않았으면 false.
 */
export async function startTourMatch(
  db: Db,
  r: {
    id: string;
    profileId: string;
    week: string;
    day: string;
    stage: number;
    done: number;
    stateJson: string;
    now: string;
  },
): Promise<{ tryNo: number } | null> {
  const d1 = db.$client;
  const gate = `(SELECT count(*) FROM tour_matches WHERE profile_id = ?1 AND day = ?2) < ${TOUR_TRIES_PER_DAY}
            AND NOT EXISTS (SELECT 1 FROM tour_matches WHERE profile_id = ?1 AND status = 'live')`;
  let results;
  try {
    results = await d1.batch([
      // 그 주 도전 수(줄이 없으면 만든다). 아래 경기 줄과 같은 조건이라 함께 들어가거나 함께 빠진다.
      d1
        .prepare(
          `INSERT INTO tour_progress (profile_id, week, tries, updated_at)
           SELECT ?1, ?3, 1, ?4 WHERE ${gate}
           ON CONFLICT (profile_id, week) DO UPDATE SET tries = tries + 1, updated_at = excluded.updated_at`,
        )
        .bind(r.profileId, r.day, r.week, r.now),
      d1
        .prepare(
          `INSERT INTO tour_matches (id, profile_id, week, stage, day, try_no, status, done, state_json, created_at)
           SELECT ?3, ?1, ?4, ?5, ?2,
                  1 + (SELECT count(*) FROM tour_matches WHERE profile_id = ?1 AND week = ?4 AND stage = ?5),
                  'live', ?6, ?7, ?8
            WHERE ${gate}`,
        )
        .bind(r.profileId, r.day, r.id, r.week, r.stage, r.done, r.stateJson, r.now),
      d1.prepare(`SELECT try_no FROM tour_matches WHERE id = ?`).bind(r.id),
    ]);
  } catch (e) {
    // 동시에 두 번 시작해 진행 중 경기 유일 인덱스에 걸렸다.
    if (String(e).includes('UNIQUE constraint failed')) return null;
    throw e;
  }
  const row = results[2]!.results[0] as { try_no: number } | undefined;
  return row ? { tryNo: row.try_no } : null;
}

/** 작전 타임 뒤 다음 구간까지 치른 상태를 저장한다(화면이 본 구간 수가 그대로일 때만). */
export async function saveTourSegment(
  db: Db,
  r: { id: string; from: number; done: number; stateJson: string },
): Promise<boolean> {
  const res = await db.$client
    .prepare(
      `UPDATE tour_matches SET done = ?, state_json = ? WHERE id = ? AND status = 'live' AND done = ?`,
    )
    .bind(r.done, r.stateJson, r.id, r.from)
    .run();
  return res.meta.changes > 0;
}

/**
 * 경기를 마감한다. 이겼으면 진행(이긴 경기 수 · 점수 · 별 · 순위 값)과 대전료를 함께 반영한다. 모든 문장이 "그 경기가 아직 live이고
 * 구간 수가 from"일 때만 움직이고 마지막 문장이 경기를 닫으므로, 두 번 불려도 한 번만 반영된다. 대전료는 그 주 그 경기의 기록 줄이
 * 아직 없을 때만 준다(처음 이겼을 때 한 번). 닫지 못했으면(이미 마감) null.
 */
export async function finishTourMatch(
  db: Db,
  r: {
    id: string;
    profileId: string;
    week: string;
    stage: number;
    from: number;
    done: number;
    stateJson: string;
    win: boolean;
    score: number;
    stars: number;
    fee: number;
    now: string;
  },
): Promise<{ fee: number; balance: number | null } | null> {
  const d1 = db.$client;
  const live = `EXISTS (SELECT 1 FROM tour_matches WHERE id = ?1 AND status = 'live' AND done = ?2)`;
  const ref = `${r.week}:${r.stage}`;
  const unpaid = `NOT EXISTS (SELECT 1 FROM owner_fund_ledger WHERE profile_id = ?3 AND kind = '${TOUR_FEE_KIND}' AND ref = ?4)`;
  const win = r.win
    ? [
        ...(r.fee > 0
          ? [
              // 기록 줄을 먼저 넣고(잔액은 지금 값 + 대전료), 그 줄이 방금 들어갔을 때만 잔액을 올린다.
              d1
                .prepare(
                  `INSERT INTO owner_fund_ledger (profile_id, kind, delta, balance, ref, created_at)
                   SELECT ?3, '${TOUR_FEE_KIND}', ?5,
                          coalesce((SELECT balance FROM owner_funds WHERE profile_id = ?3), 0) + ?5, ?4, ?6
                    WHERE ${live} AND ${unpaid}`,
                )
                .bind(r.id, r.from, r.profileId, ref, r.fee, r.now),
              d1
                .prepare(
                  `INSERT INTO owner_funds (profile_id, balance, updated_at)
                   SELECT ?3, ?5, ?6
                    WHERE ${live} AND EXISTS (SELECT 1 FROM owner_fund_ledger
                           WHERE profile_id = ?3 AND kind = '${TOUR_FEE_KIND}' AND ref = ?4 AND created_at = ?6)
                   ON CONFLICT (profile_id) DO UPDATE SET balance = balance + excluded.balance,
                                                         updated_at = excluded.updated_at`,
                )
                .bind(r.id, r.from, r.profileId, ref, r.fee, r.now),
            ]
          : []),
        d1
          .prepare(
            `UPDATE tour_progress
                SET cleared = max(cleared, cast(?4 AS integer)), score = score + cast(?5 AS integer),
                    tries_at_score = tries, reached_at = ?6,
                    stars_json = json_set(stars_json, '$."' || cast(?4 AS integer) || '"', cast(?7 AS integer)),
                    updated_at = ?6
              WHERE profile_id = ?3 AND week = ?8 AND cleared < ?4 AND ${live}`,
          )
          .bind(r.id, r.from, r.profileId, r.stage, r.score, r.now, r.stars, r.week),
      ]
    : [];
  const results = await d1.batch([
    ...win,
    d1
      .prepare(
        `UPDATE tour_matches SET status = ?3, done = ?4, state_json = ?5, finished_at = ?6
          WHERE id = ?1 AND status = 'live' AND done = ?2`,
      )
      .bind(r.id, r.from, r.win ? 'won' : 'lost', r.done, r.stateJson, r.now),
    d1
      .prepare(
        `SELECT (SELECT delta FROM owner_fund_ledger WHERE profile_id = ?1 AND kind = '${TOUR_FEE_KIND}' AND ref = ?2
                    AND created_at = ?3) paid,
                (SELECT balance FROM owner_funds WHERE profile_id = ?1) balance`,
      )
      .bind(r.profileId, ref, r.now),
  ]);
  if (!results[results.length - 2]!.meta.changes) return null;
  const row = results[results.length - 1]!.results[0] as
    { paid: number | null; balance: number | null } | undefined;
  return { fee: row?.paid ?? 0, balance: row?.paid ? (row.balance ?? 0) : null };
}

export const TOUR_RANKING_LIMIT = 50;

/** 그 주 순위(위에서 TOUR_RANKING_LIMIT명). 이름은 그 시즌 구단 이름. */
export function tourRanking(db: Db, week: string, season: number) {
  return db
    .select({
      teamId: ownerTeams.id,
      name: ownerTeams.name,
      cleared: tourProgress.cleared,
      score: tourProgress.score,
      starsJson: tourProgress.starsJson,
    })
    .from(tourProgress)
    .leftJoin(
      ownerTeams,
      and(eq(ownerTeams.profileId, tourProgress.profileId), eq(ownerTeams.season, season)),
    )
    .where(and(eq(tourProgress.week, week), sql`${tourProgress.score} > 0`))
    .orderBy(desc(tourProgress.score), tourProgress.triesAtScore, tourProgress.reachedAt)
    .limit(TOUR_RANKING_LIMIT);
}
