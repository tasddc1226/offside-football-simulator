// 시즌 진행 게이지(contracts season-gauge.ts). 5분 cron마다 부르지만 COUNT_EVERY마다 한 번만 센다 — 시즌 커리어 전체를
// 훑는 집계라 자주 돌 필요가 없다. 센 값으로 상태를 앞으로 밀어 app_meta에 굳힌다(마감을 확정하면 그 뒤로는 바꾸지 않는다).
// 확정한 마감은 시즌 일정(seasonSchedule.ts)에 다음 시즌과 함께 적는다.
import {
  SEASON_GAUGE,
  stepSeasonGauge,
  type SeasonGaugeState,
} from '@offside/contracts/season-gauge';
import {
  activeSeason,
  closeSeasonSchedule,
  sameSchedule,
  seasonSchedule,
} from '@offside/contracts/service-seasons';
import { RETIRE_CAP_FIRST } from '../firsts.js';
import { saveSeasonSchedule } from '../seasonSchedule.js';

const COUNT_EVERY_MS = 30 * 60_000;
const gaugeMetaKey = (season: number) => `season_gauge:${season}`;

export async function readSeasonGauge(
  db: D1Database,
  season: number,
): Promise<SeasonGaugeState | null> {
  const row = await db
    .prepare('SELECT value FROM app_meta WHERE key = ?')
    .bind(gaugeMetaKey(season))
    .first<{ value: string }>();
  if (!row) return null;
  try {
    return JSON.parse(row.value) as SeasonGaugeState;
  } catch {
    return null;
  }
}

/**
 * 게이지에 들어가는 값: 그 시즌 선수가 fullAge 이상에 은퇴한 커리어를 (프로필, KST 날짜)마다 dailyCap까지 더한 수와,
 * 그런 커리어가 하나라도 있는 프로필 수. 숨긴 기록도 센다(게이지는 이름이 아니라 플레이 양이다).
 */
export async function countSeasonGauge(
  db: D1Database,
  season: number,
  startsAt: string,
): Promise<{ contributed: number; participants: number }> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(MIN(n, ?)), 0) AS contributed, COUNT(DISTINCT profile_id) AS participants
       FROM (
         SELECT profile_id, date(retired_at, '+9 hours') AS d, COUNT(*) AS n
         FROM careers
         WHERE status = 'retired' AND service_season = ? AND retire_age >= ? AND retired_at >= ?
         GROUP BY profile_id, d
       )`,
    )
    .bind(SEASON_GAUGE.dailyCap, season, SEASON_GAUGE.fullAge, startsAt)
    .first<{ contributed: number; participants: number }>();
  return { contributed: row?.contributed ?? 0, participants: row?.participants ?? 0 };
}

/** 그 시즌의 끝나지 않은 컵(추첨 전이거나 진행 중) 가운데 가장 늦은 마지막 경기 시각. 없으면 null. */
export async function openCupEndsAt(db: D1Database, season: number): Promise<string | null> {
  const { results } = await db
    .prepare(
      `SELECT c.rounds_json AS rounds FROM cups c LEFT JOIN cup_state s ON s.cup_id = c.id
       WHERE c.season = ? AND s.done_at IS NULL`,
    )
    .bind(season)
    .all<{ rounds: string }>();
  let last: string | null = null;
  for (const r of results) {
    try {
      const end = (JSON.parse(r.rounds) as string[]).at(-1);
      if (end && (!last || end > last)) last = end;
    } catch {
      // 일정이 깨진 회차는 건너뛴다.
    }
  }
  return last;
}

/** 그 시즌 선수가 은퇴 나이까지 뛰고 은퇴했는가(서버 최초 기록 retirecap) — 다음 시즌 은퇴 나이 +1. */
async function reachedRetireCap(db: D1Database, season: number): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 AS hit FROM server_firsts WHERE season = ? AND id = ?')
    .bind(season, RETIRE_CAP_FIRST)
    .first<{ hit: number }>();
  return !!row;
}

/**
 * 마감이 확정된 시즌을 시즌 일정에 잇는다: 그 시즌의 마감과 마감 시각에 바로 여는 다음 시즌. 마감 전까지 셀 때마다
 * 은퇴 나이 해금을 다시 보고(오르기만 한다) 일정이 달라졌을 때만 쓴다. 썼으면 true.
 */
async function scheduleNextSeason(
  db: D1Database,
  season: number,
  endsAt: string,
): Promise<boolean> {
  const next = closeSeasonSchedule(season, endsAt, await reachedRetireCap(db, season));
  if (sameSchedule(next, seasonSchedule())) return false;
  await saveSeasonSchedule(db, next);
  return true;
}

/**
 * 진행 중인 시즌의 게이지를 센다(마지막으로 센 지 COUNT_EVERY가 안 됐으면 건너뛴다). 마감이 확정됐으면 시즌 일정에
 * 마감·다음 시즌을 잇는다 — 마감 시각이 되면 시즌 결산(team/seasonClose.ts)과 다음 시즌 개막이 저절로 이어진다.
 * 세었거나 일정을 고쳤으면 새 상태를 돌려준다.
 */
export async function runSeasonGauge(
  db: D1Database,
  now: string,
): Promise<(SeasonGaugeState & { scheduled: boolean }) | null> {
  const season = activeSeason(now);
  if (!season) return null;
  let state = await readSeasonGauge(db, season.id);
  let counted = false;
  if (!state || Date.parse(now) - Date.parse(state.updatedAt) >= COUNT_EVERY_MS - 60_000) {
    const [tally, cupEndsAt] = await Promise.all([
      countSeasonGauge(db, season.id, season.startsAt),
      openCupEndsAt(db, season.id),
    ]);
    state = stepSeasonGauge(state, season, tally, now, cupEndsAt);
    await db
      .prepare(
        'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .bind(gaugeMetaKey(season.id), JSON.stringify(state))
      .run();
    counted = true;
  }
  // 은퇴 나이 해금은 센 때(COUNT_EVERY)만 다시 본다 — 마감 확정 뒤 5분마다 server_firsts를 묻지 않는다.
  const scheduled =
    counted && state.endsAt ? await scheduleNextSeason(db, season.id, state.endsAt) : false;
  return counted || scheduled ? { ...state, scheduled } : null;
}
