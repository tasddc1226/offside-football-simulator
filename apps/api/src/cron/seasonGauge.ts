// 시즌 진행 게이지(contracts season-gauge.ts). 5분 cron마다 부르지만 COUNT_EVERY마다 한 번만 센다 — 시즌 커리어 전체를
// 훑는 집계라 자주 돌 필요가 없다. 센 값으로 상태를 앞으로 밀어 app_meta에 굳힌다(마감을 확정하면 그 뒤로는 바꾸지 않는다).
import {
  SEASON_GAUGE,
  stepSeasonGauge,
  type SeasonGaugeState,
} from '@offside/contracts/season-gauge';
import { activeSeason } from '@offside/contracts/service-seasons';

const COUNT_EVERY_MS = 30 * 60_000;
export const gaugeMetaKey = (season: number) => `season_gauge:${season}`;

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

/** 진행 중인 시즌의 게이지를 센다. 마지막으로 센 지 COUNT_EVERY가 안 됐으면 건너뛴다. 세었으면 새 상태를 돌려준다. */
export async function runSeasonGauge(
  db: D1Database,
  now: string,
): Promise<SeasonGaugeState | null> {
  const season = activeSeason(now);
  if (!season) return null;
  const prev = await readSeasonGauge(db, season.id);
  if (prev && Date.parse(now) - Date.parse(prev.updatedAt) < COUNT_EVERY_MS - 60_000) return null;
  const counted = await countSeasonGauge(db, season.id, season.startsAt);
  const next = stepSeasonGauge(prev, season, counted, now);
  await db
    .prepare(
      'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    )
    .bind(gaugeMetaKey(season.id), JSON.stringify(next))
    .run();
  return next;
}
