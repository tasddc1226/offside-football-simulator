import type { LegendSnapshot } from '@offside/contracts';
import { cardValue, retireValue } from '@offside/contracts/market-value';
import { and, asc, eq, gt, inArray, isNull } from 'drizzle-orm';
import type { Db } from '../client.js';
import { runBatch } from './batch.js';
import { setMeta } from './firsts.js';
import { appMeta, cards, careers } from '../schema.js';

// T-11-080 마이그레이션 0056이 만든 기존 은퇴 카드의 기준가(card_value)와 은퇴 가치(retire_value)를 스냅샷으로 매긴다.
// 스냅샷이 없는 옛 기록은 기준가를 비워 둔다(거래하지 않는다). 그래서 채운 행과 못 채운 행을 값으로 가를 수 없어
// 진행 위치(career_id 커서)를 app_meta에 둔다. 공개 명예의 전당 목록 조회마다 CHUNK장씩 나아간다(careerValues.ts와 같은 방식).
// 운영에서 끝나면(app_meta card_values_backfill = VERSION) 이 파일과 routes/hof.ts의 호출을 지운다.
const VERSION = '1';
const META_KEY = 'card_values_backfill';
/** 진행 중이면 마지막으로 본 career_id. */
const CURSOR_KEY = 'card_values_backfill_cursor';
/** 스냅샷 JSON을 읽으므로 Workers CPU 안에 들도록 작게. D1 바인딩 한도(100)보다도 작다. */
const CHUNK = 60;

/** 채우는 중이면 다음 한 조각을 처리한다. 무언가 했으면 true. */
export async function ensureCardValuesBackfilled(db: Db, chunk = CHUNK): Promise<boolean> {
  const meta = await db
    .select({ key: appMeta.key, value: appMeta.value })
    .from(appMeta)
    .where(inArray(appMeta.key, [META_KEY, CURSOR_KEY]));
  const m = new Map(meta.map((r) => [r.key, r.value]));
  if (m.get(META_KEY) === VERSION) return false;
  const cursor = m.get(CURSOR_KEY) ?? '';
  const rows = await db
    .select({
      id: cards.careerId,
      peak: cards.peak,
      legendScore: cards.legendScore,
      snapshotJson: careers.snapshotJson,
    })
    .from(cards)
    .leftJoin(careers, eq(careers.id, cards.careerId))
    .where(and(isNull(cards.cardValue), gt(cards.careerId, cursor)))
    .orderBy(asc(cards.careerId))
    .limit(chunk);
  const statements = rows.flatMap((r) => {
    const snap = r.snapshotJson ? (JSON.parse(r.snapshotJson) as LegendSnapshot) : null;
    if (!snap) return [];
    return [
      db
        .update(cards)
        .set({
          cardValue: cardValue(snap.career, r.peak),
          retireValue: retireValue(snap.career, r.legendScore),
        })
        .where(eq(cards.careerId, r.id)),
    ];
  });
  await runBatch(db, [
    ...statements,
    ...(rows.length < chunk
      ? [setMeta(db, META_KEY, VERSION), db.delete(appMeta).where(eq(appMeta.key, CURSOR_KEY))]
      : [setMeta(db, CURSOR_KEY, rows[rows.length - 1]!.id)]),
  ]);
  return true;
}
