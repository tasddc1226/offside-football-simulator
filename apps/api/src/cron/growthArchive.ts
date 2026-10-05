// T-11-100 시즌 성장 기록(career_seasons.growth_json, T-11-048) 보관. 성장 기록은 시즌마다 약 0.5KB라 D1을 가장 빨리
// 채운다. KEEP_DAYS가 지난 시즌의 성장 기록을 R2에 줄마다 JSON(NDJSON, gzip)으로 옮기고 D1에서는 비운다. 시즌 행 자체는
// 그대로 둔다. 분석은 최근 KEEP_DAYS는 D1, 그 전은 R2 `growth/<env>/` 파일로 한다(docs/operations/season-growth-telemetry.md).
// 백업 정리(prune)는 `d1/` 아래만 지우므로 이 파일은 지워지지 않는다.
import { eq } from 'drizzle-orm';
import { createDb } from '../db/client.js';
import { setMeta } from '../db/repos/firsts.js';
import { appMeta } from '../db/schema.js';
import { gzipToR2 } from './backup.js';

/** 이만큼 지난 시즌의 성장 기록을 옮긴다. 조작 판정(growthTampered)은 올라오는 기록만 보므로 D1에 남길 필요가 없다. */
export const KEEP_DAYS = 30;
/** 다음 실행이 이어 갈 시각(이 시각보다 먼저 올라온 시즌은 옮겼다). */
export const ARCHIVE_UNTIL_KEY = 'growth_archive_until';
const PAGE = 2000;
/** 한 번에 옮기는 최대 행 수. 넘으면 다음 날 이어 간다(매일 작업의 시간·CPU 한도 안에 들게). */
const MAX_ROWS = 400_000;
/** 한 문장으로 비우는 행 수(D1 문장 시간 한도). */
const CLEAR_CHUNK = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type GrowthArchiveResult = {
  /** 올린 R2 객체. 옮길 행이 없으면 null. */
  key: string | null;
  rows: number;
  bytes: number;
  /** 다음 실행이 이어 갈 시각. */
  until: string;
};

type Row = {
  rowid: number;
  career_id: string;
  year: number;
  age: number;
  ovr: number;
  created_at: string;
  growth_json: string;
};

export const archiveKey = (env: string, now: number) =>
  `growth/${env}/${new Date(now).toISOString().slice(0, 10)}-${now}.ndjson.gz`;

export async function archiveGrowth(
  d1: D1Database,
  bucket: R2Bucket,
  env: string,
  now: number,
): Promise<GrowthArchiveResult> {
  const db = createDb(d1);
  const [last] = await db
    .select({ value: appMeta.value })
    .from(appMeta)
    .where(eq(appMeta.key, ARCHIVE_UNTIL_KEY));
  const from = last?.value ?? '';
  const cutoff = new Date(now - KEEP_DAYS * DAY_MS).toISOString();
  // created_at 인덱스로 [from, cutoff) 구간만 읽는다. 같은 시각 행이 페이지 경계에 걸려도 놓치지 않게 (created_at, rowid)로 이어 읽는다.
  const page = (at: string, rowid: number) =>
    d1
      .prepare(
        `SELECT rowid, career_id, year, age, ovr, created_at, growth_json FROM career_seasons
         WHERE created_at < ?1 AND (created_at > ?2 OR (created_at = ?2 AND rowid > ?3)) AND growth_json IS NOT NULL
         ORDER BY created_at, rowid LIMIT ${PAGE}`,
      )
      .bind(cutoff, at, rowid)
      .all<Row>();

  const first = await page(from, 0);
  if (!first.results.length) {
    await setMeta(db, ARCHIVE_UNTIL_KEY, cutoff);
    return { key: null, rows: 0, bytes: 0, until: cutoff };
  }

  const key = archiveKey(env, now);
  let rows = 0;
  let until = cutoff;
  const bytes = await gzipToR2(bucket, key, 'application/x-ndjson', async (write) => {
    for (let data = first.results; data.length;) {
      // growth_json은 이미 JSON이라 다시 파싱하지 않고 그대로 붙인다.
      await write(
        data
          .map(
            (r) =>
              `{"careerId":${JSON.stringify(r.career_id)},"year":${r.year},"age":${r.age},"ovr":${r.ovr},"createdAt":"${r.created_at}","growth":${r.growth_json}}\n`,
          )
          .join(''),
      );
      rows += data.length;
      const tail = data[data.length - 1]!;
      if (data.length < PAGE) break;
      if (rows >= MAX_ROWS) {
        // 다음 실행은 이 시각부터 다시 읽는다(같은 시각의 남은 행은 거기서 옮긴다).
        until = tail.created_at;
        break;
      }
      data = (await page(tail.created_at, tail.rowid)).results;
    }
  });

  // R2에 다 올린 뒤에만 비운다. 구간은 옮긴 행과 같다([from, until)) — 한도로 끊긴 경계 시각의 행은 다음 실행이 옮긴다.
  for (;;) {
    const r = await d1
      .prepare(
        `UPDATE career_seasons SET growth_json = NULL WHERE rowid IN (
           SELECT rowid FROM career_seasons
           WHERE created_at >= ?1 AND created_at < ?2 AND growth_json IS NOT NULL LIMIT ${CLEAR_CHUNK})`,
      )
      .bind(from, until)
      .run();
    if (!r.meta.changes) break;
  }
  await setMeta(db, ARCHIVE_UNTIL_KEY, until);
  return { key, rows, bytes, until };
}
