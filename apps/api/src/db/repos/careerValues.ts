import type { LegendSnapshot } from '@offside/contracts';
import { retireValue } from '@offside/contracts/market-value';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { runBatch } from './batch.js';
import { setMeta } from './firsts.js';
import { appMeta, careers } from '../schema.js';

// T-10-100 이 기능 전에 은퇴한 기록의 은퇴 가치(careers.value)를 스냅샷으로 매긴다. 구단 id가 없는 옛 시즌 기록도
// 리그 이름으로 몸값을 매긴다(market-value rowLeague). 스냅샷이 없는 기록은 0(가치 순에서 빠진다).
// 한 번뿐인 소급 — 공개 명예의 전당 목록 조회마다 CHUNK명씩 나아간다(clubIds.ts와 같은 방식, 진행 위치는 app_meta).
// 운영에서 끝나면(app_meta career_values_backfill = VERSION) 이 파일과 routes/hof.ts의 호출을 지운다.
const VERSION = '1';
const META_KEY = 'career_values_backfill';
/** 진행 중이면 마지막으로 본 careers rowid. */
const CURSOR_KEY = 'career_values_backfill_cursor';
/** 스냅샷 JSON을 읽으므로 Workers CPU 안에 들도록 작게. D1 바인딩 한도(100)보다도 작다. */
const CHUNK = 60;

/** 채우는 중이면 다음 한 조각을 처리한다. 무언가 했으면 true. */
export async function ensureCareerValuesBackfilled(db: Db, chunk = CHUNK): Promise<boolean> {
  const meta = await db
    .select({ key: appMeta.key, value: appMeta.value })
    .from(appMeta)
    .where(inArray(appMeta.key, [META_KEY, CURSOR_KEY]));
  const m = new Map(meta.map((r) => [r.key, r.value]));
  if (m.get(META_KEY) === VERSION) return false;
  const cursor = Number(m.get(CURSOR_KEY) ?? 0);
  const rows = await db
    .select({
      rowid: sql<number>`rowid`,
      id: careers.id,
      legendScore: careers.legendScore,
      snapshotJson: careers.snapshotJson,
    })
    .from(careers)
    .where(and(sql`rowid > ${cursor}`, eq(careers.status, 'retired'), isNull(careers.value)))
    .orderBy(sql`rowid`)
    .limit(chunk);
  const statements = rows.map((r) => {
    const snap = r.snapshotJson ? (JSON.parse(r.snapshotJson) as LegendSnapshot) : null;
    const value = snap ? retireValue(snap.career, r.legendScore ?? 0) : 0;
    return db.update(careers).set({ value }).where(eq(careers.id, r.id));
  });
  const done = rows.length < chunk;
  await runBatch(db, [
    ...statements,
    ...(done
      ? [setMeta(db, META_KEY, VERSION), db.delete(appMeta).where(eq(appMeta.key, CURSOR_KEY))]
      : [setMeta(db, CURSOR_KEY, String(rows[rows.length - 1]!.rowid))]),
  ]);
  return true;
}
