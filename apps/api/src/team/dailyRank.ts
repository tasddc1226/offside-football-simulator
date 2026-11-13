// T-11-723 오늘의 랭킹 — 오늘(한국 시각) 은퇴해 명예의 전당에 오른 선수의 레전드 점수 순위. 로그인한 구단주의 선수만,
// 구단주마다 가장 높은 선수 한 명만 오른다. 자정이 지나면 5분 cron이 전날 1 · 2 · 3위를 한 번 굳혀 결과 줄(= 카드 표식) · 아이템 · 알림을 남긴다.
import {
  DAILY_RANK_LIMIT,
  DAILY_RANK_REWARDS,
  DAILY_RANK_WINNERS,
  dailyRankDays,
  dailyRankOpen,
  dailyRankShift,
  dailyRankStart,
  dailyRankWeekStart,
} from '@offside/contracts/daily-rank';
import { HOF_MIN_RETIRE_AGE } from '@offside/contracts/hof-rules';
import type { DailyRankResponse } from '@offside/contracts';
import { and, asc, eq, gt, gte, inArray, lt, or } from 'drizzle-orm';
import { cupKo } from '../cupText.js';
import type { Db } from '../db/client.js';
import { listPublicHofByIds } from '../db/repos/careers.js';
import { grantItemStatement } from '../db/repos/itemShop.js';
import { retryTransientRead, retryTransientWrite } from '../db/retry.js';
import { appMeta, dailyRankWinners } from '../db/schema.js';
import { eventNotificationStatements } from '../push/events.js';

/** 로그인 수단이 있는 삭제되지 않은 구단주(profiles 별칭 p). 시즌 결산(seasonClose.ts)의 기준과 같다. */
const LINKED_SQL = '(p.google_sub is not null or p.apple_sub is not null) and p.deleted_at is null';

type Ranked = { id: string; profileId: string; season: number; score: number };

/**
 * 그 날짜에 은퇴한 선수의 순위(1위부터). 은퇴 시각 인덱스로 그날 은퇴분만 읽고, 구단주마다 가장 높은 한 명만 남긴다.
 * 동점은 먼저 은퇴한 선수가 앞이다. 첫 날(DAILY_RANK_FIRST_DAY) 전의 날짜는 비어 있다.
 */
export async function rankDay(db: Db, day: string, limit: number): Promise<Ranked[]> {
  if (!dailyRankOpen(day)) return [];
  const { results } = await retryTransientRead(() =>
    db.$client
      .prepare(
        `SELECT id, profile_id AS profileId, season, ls AS score FROM (
           SELECT c.id AS id, c.profile_id AS profile_id, c.service_season AS season,
             c.legend_score AS ls, c.retired_at AS ra,
             row_number() OVER (PARTITION BY c.profile_id ORDER BY c.legend_score DESC, c.retired_at, c.id) AS rn
           FROM careers c INDEXED BY careers_status_retired_idx
           JOIN profiles p ON p.id = c.profile_id
           WHERE c.status = 'retired' AND c.retired_at >= ?1 AND c.retired_at < ?2
             AND c.hidden = 0 AND c.legend_score IS NOT NULL AND c.retire_age >= ?3
             AND c.service_season >= 1 AND ${LINKED_SQL}
         ) WHERE rn = 1 ORDER BY ls DESC, ra, id LIMIT ?4`,
      )
      .bind(dailyRankStart(day), dailyRankStart(dailyRankShift(day, 1)), HOF_MIN_RETIRE_AGE, limit)
      .all<Ranked>(),
  );
  return results;
}

/** 오늘의 랭킹 화면 응답(모두에게 같다 — 라우트가 엣지 캐시에 담는다). */
export async function readDailyRank(db: Db, now: string): Promise<DailyRankResponse> {
  const { today, yesterday, resetAt } = dailyRankDays(now);
  const ranked = await rankDay(db, today, DAILY_RANK_LIMIT);
  const entries = await listPublicHofByIds(
    db,
    ranked.map((r) => r.id),
  );
  const won = await db
    .select({ rank: dailyRankWinners.rank, careerId: dailyRankWinners.careerId })
    .from(dailyRankWinners)
    .where(eq(dailyRankWinners.day, yesterday))
    .orderBy(asc(dailyRankWinners.rank));
  const byId = new Map(
    (
      await listPublicHofByIds(
        db,
        won.map((w) => w.careerId),
      )
    ).map((e) => [e.id, e]),
  );
  const winners = won.flatMap((w) => {
    const entry = byId.get(w.careerId);
    return entry ? [{ rank: w.rank, entry }] : [];
  });
  return {
    day: today,
    resetAt,
    entries,
    yesterday: winners.length ? { day: yesterday, winners } : null,
  };
}

export const dailyRankMetaKey = (day: string) => `daily-rank:${day}`;

/**
 * 그 날짜의 1 · 2 · 3위를 굳힌다. 이미 굳혔으면 null. 순위마다 결과 줄(카드 표식)을 넣고, 그 줄이 새로 들어갔을 때만 아이템 ·
 * 알림이 이어서 들어간다(changes() 사슬) — 같은 날짜를 두 번 돌려도 다시 주지 않는다. 아이템은 그 주(월~일)에 아직 받지 않은
 * 구단주만 받는다. 오른 선수가 없는 날도 표시를 남겨 다시 세지 않는다.
 */
export async function closeDailyRank(db: Db, day: string, now: string): Promise<number | null> {
  const key = dailyRankMetaKey(day);
  const [done] = await db.select({ key: appMeta.key }).from(appMeta).where(eq(appMeta.key, key));
  if (done) return null;
  const top = await rankDay(db, day, DAILY_RANK_WINNERS);
  const paid = top.length
    ? await db
        .select({ profileId: dailyRankWinners.profileId })
        .from(dailyRankWinners)
        .where(
          and(
            inArray(
              dailyRankWinners.profileId,
              top.map((t) => t.profileId),
            ),
            gte(dailyRankWinners.day, dailyRankWeekStart(day)),
            lt(dailyRankWinners.day, day),
            or(gt(dailyRankWinners.reroll, 0), gt(dailyRankWinners.scout, 0)),
          ),
        )
    : [];
  const paidThisWeek = new Set(paid.map((p) => p.profileId));
  const d1 = db.$client;
  const chained = { sql: 'changes() = 1' };
  const stmts: D1PreparedStatement[] = [];
  top.forEach((t, i) => {
    const rank = i + 1;
    const reward = paidThisWeek.has(t.profileId)
      ? { scout: 0, reroll: 0 }
      : (DAILY_RANK_REWARDS[i] ?? { scout: 0, reroll: 0 });
    stmts.push(
      d1
        .prepare(
          `INSERT OR IGNORE INTO daily_rank_winners
             (day, rank, career_id, profile_id, legend_score, reroll, scout, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(day, rank, t.id, t.profileId, t.score, reward.reroll, reward.scout, now),
    );
    if (reward.scout)
      stmts.push(grantItemStatement(d1, t.profileId, 'scout', reward.scout, now, chained));
    if (reward.reroll)
      stmts.push(grantItemStatement(d1, t.profileId, 'reroll', reward.reroll, now, chained));
    stmts.push(
      ...eventNotificationStatements(d1, {
        profileId: t.profileId,
        sourceKey: `daily-rank:${day}`,
        topic: 'reward',
        now,
        content: {
          kind: 'team',
          title: cupKo('dailyRankTitle', { rank }),
          body: reward.scout
            ? cupKo('dailyRankBodyBoth', { rank, s: reward.scout, n: reward.reroll })
            : reward.reroll
              ? cupKo('dailyRankBodyReroll', { rank, n: reward.reroll })
              : cupKo('dailyRankBodyMark', { rank }),
          target: { type: 'screen', screen: 'team' },
        },
      }),
    );
  });
  stmts.push(
    d1.prepare('INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)').bind(key, now),
  );
  await retryTransientWrite(() => d1.batch(stmts));
  return top.length;
}

/** 이 아이솔레이트가 마지막으로 굳힌 것을 확인한 날짜 — 5분마다 app_meta를 다시 읽지 않는다. */
let closedDay: string | null = null;

/** 5분 cron: 어제 순위를 아직 굳히지 않았으면 굳힌다. 한 일이 없으면 null. */
export async function runDailyRank(db: Db, now: string) {
  const { yesterday } = dailyRankDays(now);
  // 첫 날 전의 날짜는 굳히지 않는다(표시도 남기지 않는다).
  if (closedDay === yesterday || !dailyRankOpen(yesterday)) return null;
  const winners = await closeDailyRank(db, yesterday, now);
  closedDay = yesterday;
  return winners === null ? null : { day: yesterday, winners };
}

/** 테스트에서 아이솔레이트 기억을 지운다. */
export const resetDailyRankMemo = () => {
  closedDay = null;
};
