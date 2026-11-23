import { LiveMapSchema, type LiveMap } from '@offside/contracts';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { appMeta } from '../schema.js';

// T-11-815 홈 라이브 지도. 최근 24시간에 시즌을 올린 진행 중 커리어를 마지막 시즌의 리그 · 국적으로 센다.
// 하루 시즌 행이 만 단위라 요청마다 세지 않고, 5분 cron이 15분마다 한 번 세어 app_meta 한 행에 굳힌다.
// /v1/live는 그 행만 읽는다(키 조회 한 번).

export const LIVE_MAP_KEY = 'live:map';
/** 집계 간격. 5분 cron에서 이 분의 배수일 때만 센다. */
export const LIVE_MAP_EVERY_MIN = 15;
const WINDOW_MS = 24 * 60 * 60_000;

type Row = { league: string; nation: string; n: number };

/** 리그 · 국적별 인원 행을 지도 값으로 접는다. 국적이 빈(옛 커리어 · 대한민국) 행은 쿼리가 'KR'로 채워 온다. */
export function foldLiveMap(rows: Row[], at: string): LiveMap {
  const byLeague = new Map<string, number>();
  const nations = new Set<string>();
  let careers = 0;
  for (const r of rows) {
    const n = Number(r.n);
    if (!(n > 0)) continue;
    byLeague.set(r.league, (byLeague.get(r.league) ?? 0) + n);
    nations.add(r.nation);
    careers += n;
  }
  const leagues = [...byLeague]
    .map(([league, n]) => ({ league, n }))
    .sort((a, b) => b.n - a.n || a.league.localeCompare(b.league));
  return { at, careers, nations: nations.size, leagues };
}

/**
 * 최근 24시간 시즌 행(created_at 인덱스)에서 커리어마다 가장 늦은 시즌 하나를 골라 커리어(기본 키)에 붙인다.
 * 공개 순위에서 뺀 커리어(hidden)와 은퇴한 커리어는 세지 않는다.
 */
export async function computeLiveMap(db: Db, nowMs: number): Promise<LiveMap> {
  const since = new Date(nowMs - WINDOW_MS).toISOString();
  const rows = await db.all<Row>(sql`
    with recent as (
      select career_id, league,
        row_number() over (partition by career_id order by created_at desc) as rn
      from career_seasons
      where created_at >= ${since}
    )
    select r.league as league, coalesce(c.nation, 'KR') as nation, count(*) as n
    from recent r
    join careers c on c.id = r.career_id
    where r.rn = 1 and c.status = 'active' and c.hidden = 0
    group by r.league, coalesce(c.nation, 'KR')
  `);
  return foldLiveMap(rows, new Date(nowMs).toISOString());
}

export async function refreshLiveMap(db: Db, nowMs: number): Promise<LiveMap> {
  const map = await computeLiveMap(db, nowMs);
  const value = JSON.stringify(map);
  await db
    .insert(appMeta)
    .values({ key: LIVE_MAP_KEY, value })
    .onConflictDoUpdate({ target: appMeta.key, set: { value } });
  return map;
}

/** 굳혀 둔 지도. 아직 없거나 모양이 맞지 않으면 null(홈은 지도 없이 그린다). */
export async function readLiveMap(db: Db): Promise<LiveMap | null> {
  const [row] = await db
    .select({ value: appMeta.value })
    .from(appMeta)
    .where(eq(appMeta.key, LIVE_MAP_KEY));
  if (!row) return null;
  try {
    const parsed = LiveMapSchema.safeParse(JSON.parse(row.value));
    return parsed.success && parsed.data.careers > 0 ? parsed.data : null;
  } catch {
    return null;
  }
}

/** 5분 cron의 이번 실행이 지도를 셀 차례인지(15분 배수의 분). */
export const liveMapDue = (scheduledMs: number) =>
  new Date(scheduledMs).getUTCMinutes() % LIVE_MAP_EVERY_MIN === 0;
