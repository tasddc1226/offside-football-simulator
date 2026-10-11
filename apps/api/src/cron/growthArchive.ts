// T-11-100 시즌 성장 기록(career_seasons.growth_json, T-11-048) 보관. 성장 기록은 시즌마다 약 0.5KB라 D1을 가장 빨리
// 채운다. KEEP_DAYS가 지난 시즌의 성장 기록을 R2에 줄마다 JSON(NDJSON, gzip)으로 옮기고 D1에서는 비운다. 시즌 행 자체는
// 그대로 둔다. 분석은 최근 KEEP_DAYS는 D1, 그 전은 R2 `growth/<env>/` 파일로 한다(docs/operations/season-growth-telemetry.md).
// 백업 정리(prune)는 `d1/` 아래만 지우므로 이 파일은 지워지지 않는다.
import { DAY_MS } from '../time.js';
import { gzipToR2 } from './backup.js';

/** 이만큼 지난 시즌의 성장 기록을 옮긴다. 조작 판정(growthTampered)은 올라오는 기록만 보므로 D1에 남길 필요가 없다.
 * T-11-203 30일 → 7일: 하루 약 19만 시즌이 올라와 30일을 기다리면 D1이 10GB 한도에 먼저 닿는다. */
export const KEEP_DAYS = 7;
const PAGE = 2000;
/** 한 번에 옮기는 최대 행 수. 넘으면 남은 행은 다음 날 옮긴다(매일 작업의 시간·CPU 한도 안에 들게). */
const MAX_ROWS = 400_000;
/** 비우기 문장을 한 D1 batch에 담는 수. */
const CLEAR_BATCH = 20;

export type GrowthArchiveResult = {
  /** 올린 R2 객체. 옮길 행이 없으면 null. */
  key: string | null;
  rows: number;
  bytes: number;
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

const archiveKey = (env: string, now: number) =>
  `growth/${env}/${new Date(now).toISOString().slice(0, 10)}-${now}.ndjson.gz`;

export async function archiveGrowth(
  d1: D1Database,
  bucket: R2Bucket,
  env: string,
  now: number,
): Promise<GrowthArchiveResult> {
  const cutoff = new Date(now - KEEP_DAYS * DAY_MS).toISOString();
  // 비운 행은 부분 인덱스(career_seasons_growth_created_idx)에서 빠지므로 매번 남은 것만 읽는다 — 옮긴 뒤 다시 채워진
  // 옛 시즌(진행 중 커리어의 재전송)도 다음 실행이 다시 옮긴다. 같은 시각 행이 페이지 경계에 걸려도 (created_at, rowid)로 이어 읽는다.
  const page = (at: string, rowid: number) =>
    d1
      .prepare(
        `SELECT rowid, career_id, year, age, ovr, created_at, growth_json FROM career_seasons
         WHERE growth_json IS NOT NULL AND created_at < ?1 AND (created_at > ?2 OR (created_at = ?2 AND rowid > ?3))
         ORDER BY created_at, rowid LIMIT ${PAGE}`,
      )
      .bind(cutoff, at, rowid)
      .all<Row>();

  let data = (await page('', 0)).results;
  if (!data.length) return { key: null, rows: 0, bytes: 0 };

  const key = archiveKey(env, now);
  /** 페이지마다 옮긴 행의 rowid(JSON 배열) — 올린 행만 정확히 비운다. */
  const pages: string[] = [];
  let rows = 0;
  const bytes = await gzipToR2(bucket, key, 'application/x-ndjson', async (write) => {
    for (;;) {
      // growth_json은 이미 JSON이라 다시 파싱하지 않고 그대로 붙인다.
      await write(
        data
          .map(
            (r) =>
              `{"careerId":${JSON.stringify(r.career_id)},"year":${r.year},"age":${r.age},"ovr":${r.ovr},"createdAt":"${r.created_at}","growth":${r.growth_json}}\n`,
          )
          .join(''),
      );
      pages.push(JSON.stringify(data.map((r) => r.rowid)));
      rows += data.length;
      const tail = data[data.length - 1]!;
      if (data.length < PAGE || rows >= MAX_ROWS) return;
      data = (await page(tail.created_at, tail.rowid)).results;
      if (!data.length) return;
    }
  });

  // R2에 다 올린 뒤에만 비운다. 페이지마다 rowid 목록 하나를 넘겨(D1 바인딩 수 한도) 그 행만 비운다.
  const clear = d1.prepare(
    `UPDATE career_seasons SET growth_json = NULL WHERE rowid IN (SELECT value FROM json_each(?1))`,
  );
  for (let i = 0; i < pages.length; i += CLEAR_BATCH)
    await d1.batch(pages.slice(i, i + CLEAR_BATCH).map((ids) => clear.bind(ids)));
  return { key, rows, bytes };
}
