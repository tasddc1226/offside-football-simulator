// 시즌 일정. 시즌 진행 게이지가 마감을 확정하면(cron/seasonGauge.ts) 그 시즌의 마감과 다음 시즌을 app_meta에 굳히고,
// 요청·cron이 시작할 때 읽어 contracts의 시즌 목록에 입힌다(applySeasonSchedule) — 시즌 결산·순위·첫 업로드 시즌 등
// 시즌을 보는 코드는 고치지 않고 새 일정을 본다. 마감은 확정 뒤 48시간 이상 남으므로 아이솔레이트마다 1분 늦게 읽어도 된다.
import { applySeasonSchedule, type SeasonScheduleEntry } from '@offside/contracts/service-seasons';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from './env.js';

export const SCHEDULE_KEY = 'season_schedule';
const RELOAD_MS = 60_000;
let loadedAt = 0;

export async function readSeasonSchedule(db: D1Database): Promise<SeasonScheduleEntry[]> {
  const row = await db
    .prepare('SELECT value FROM app_meta WHERE key = ?')
    .bind(SCHEDULE_KEY)
    .first<{ value: string }>();
  if (!row) return [];
  try {
    const v = JSON.parse(row.value) as unknown;
    return Array.isArray(v) ? (v as SeasonScheduleEntry[]) : [];
  } catch {
    return [];
  }
}

/** 굳힌 일정을 입힌다. force가 아니면 아이솔레이트마다 RELOAD_MS에 한 번만 읽는다. */
export async function loadSeasonSchedule(db: D1Database, force = false): Promise<void> {
  if (!force && Date.now() - loadedAt < RELOAD_MS) return;
  applySeasonSchedule(await readSeasonSchedule(db));
  loadedAt = Date.now();
}

export async function saveSeasonSchedule(
  db: D1Database,
  entries: SeasonScheduleEntry[],
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    )
    .bind(SCHEDULE_KEY, JSON.stringify(entries))
    .run();
  applySeasonSchedule(entries);
  loadedAt = Date.now();
}

/** 테스트: 다음 요청이 일정을 다시 읽게 한다. */
export const forgetSeasonSchedule = () => {
  loadedAt = 0;
};

/**
 * 요청마다 시즌 일정을 맞춘다. DB가 없거나 읽기에 실패하면 알던 일정으로 그대로 간다. 배포 전용 경로(/v1/internal)는
 * 시즌을 보지 않고, 인증 전에는 DB를 읽지 않아야 하므로 건너뛴다.
 */
export const seasonSchedule: MiddlewareHandler<AppEnv> = async (c, next) => {
  const db = (c.env as Partial<AppEnv['Bindings']> | undefined)?.DB;
  if (db && !c.req.path.startsWith('/v1/internal/')) await loadSeasonSchedule(db).catch(() => {});
  await next();
};
