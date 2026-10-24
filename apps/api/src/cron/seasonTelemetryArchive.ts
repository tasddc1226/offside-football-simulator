// T-11-207 시즌 측정 기록(season_telemetry) 보관. TELEMETRY_KEEP_DAYS 지난 행을 올라온 순서(id)대로 R2 NDJSON(gzip)으로 올리고
// D1에서는 행을 통째로 지운다. 오래된 행부터 지우므로 빈 페이지는 새 행이 다시 쓴다(D1 파일이 더 커지지 않는다).
// 행은 덧붙이기만 하고 고치지 않으므로, 올린 id 구간을 그대로 지우면 된다. 파일 이름이 id 구간이라 겹쳐 돈 실행은
// 같은 파일을 같은 내용으로 덮어쓴다.
import type { Bindings } from '../env.js';
import { DAY_MS } from '../time.js';
import { gzipToR2 } from './backup.js';

/** T-11-252 7일 → 2일: D1이 하루 350~450MB씩 커져 10GB 한도가 2주 남았다. 이 표는 분석 때만 읽고, 그 분석은 R2 파일로도 한다. */
export const TELEMETRY_KEEP_DAYS = 2;
export const TELEMETRY_ARCHIVE_META_KEY = 'cron:season-telemetry:last';
const PAGE = 1000;
/** 5분마다 돈다. 하루 약 19만 행이 올라오므로 한 번에 최대 1만 행이면 밀린 것도 따라잡는다. */
const MAX_PAGES = 10;
const WALL_MS = 30_000;

type Row = {
  id: number;
  career_id: string;
  year: number;
  age: number;
  ovr: number;
  events_json: string | null;
  growth_json: string | null;
  created_at: string;
  ads_json: string | null;
};
export type TelemetryArchiveResult = { at: number; objects: number; rows: number; bytes: number };

export async function runSeasonTelemetryArchive(
  env: Bindings,
  now: number,
): Promise<TelemetryArchiveResult | null> {
  if (
    env.ENVIRONMENT !== 'production' ||
    !env.BACKUP ||
    env.SEASON_TELEMETRY_ARCHIVE_DISABLED === '1'
  )
    return null;
  return archiveSeasonTelemetry(env.DB, env.BACKUP, env.ENVIRONMENT, now);
}

export async function archiveSeasonTelemetry(
  db: D1Database,
  bucket: R2Bucket,
  env: string,
  now: number,
): Promise<TelemetryArchiveResult | null> {
  const cutoff = new Date(now - TELEMETRY_KEEP_DAYS * DAY_MS).toISOString();
  // 가장 오래된 한 행만 보고 할 일이 없으면 끝낸다(5분마다 도는 비용을 한 행 읽기로).
  const head = await db
    .prepare('SELECT created_at FROM season_telemetry ORDER BY id LIMIT 1')
    .first<{ created_at: string }>();
  if (!head || head.created_at >= cutoff) return null;

  const result: TelemetryArchiveResult = { at: now, objects: 0, rows: 0, bytes: 0 };
  const wall = Date.now();
  for (let page = 0; page < MAX_PAGES && Date.now() - wall < WALL_MS; page++) {
    const { results } = await db
      .prepare(
        `SELECT id, career_id, year, age, ovr, events_json, growth_json, created_at, ads_json
         FROM season_telemetry ORDER BY id LIMIT ${PAGE}`,
      )
      .all<Row>();
    // id는 올라온 순서라 created_at도 거의 그 순서다 — 기간 안의 첫 행에서 멈춘다.
    const end = results.findIndex((r) => r.created_at >= cutoff);
    const rows = end === -1 ? results : results.slice(0, end);
    if (!rows.length) break;
    const first = rows[0]!.id;
    const last = rows.at(-1)!.id;
    const key = `season-telemetry/${env}/${rows[0]!.created_at.slice(0, 10)}/${first}-${last}.ndjson.gz`;
    result.bytes += await gzipToR2(bucket, key, 'application/x-ndjson', async (write) => {
      // 세 JSON 값은 이미 JSON이라 다시 파싱하지 않고 그대로 붙인다.
      await write(
        rows
          .map(
            (r) =>
              `{"id":${r.id},"careerId":${JSON.stringify(r.career_id)},"year":${r.year},"age":${r.age},"ovr":${r.ovr},"createdAt":"${r.created_at}","events":${r.events_json ?? 'null'},"growth":${r.growth_json ?? 'null'},"ads":${r.ads_json ?? 'null'}}\n`,
          )
          .join(''),
      );
    });
    // R2에 다 올린 뒤에만 지운다.
    await db
      .prepare('DELETE FROM season_telemetry WHERE id BETWEEN ?1 AND ?2')
      .bind(first, last)
      .run();
    result.objects++;
    result.rows += rows.length;
    if (rows.length < PAGE) break;
  }
  await db
    .prepare(
      'INSERT INTO app_meta(key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    )
    .bind(TELEMETRY_ARCHIVE_META_KEY, JSON.stringify(result))
    .run();
  return result;
}
