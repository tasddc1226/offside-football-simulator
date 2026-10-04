import type { LegendSnapshot } from '@offside/contracts';
import { cardValue, retireValue } from '@offside/contracts/market-value';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import type { Db } from '../client.js';
import { runBatch } from './batch.js';
import { setMeta } from './firsts.js';
import { appMeta, cards, careers } from '../schema.js';

// T-11-080 마이그레이션 0056이 만든 기존 은퇴 카드의 기준가(card_value)와 은퇴 가치(retire_value)를 스냅샷으로 매긴다.
// 스냅샷이 있는 카드만 고르고, cardValue는 늘 0보다 크므로 채운 카드는 다음 조각에서 저절로 빠진다. 스냅샷이 없는
// 옛 기록은 기준가가 비어 있는 채로 남는다(거래하지 않는다). 공개 명예의 전당 목록 조회마다 CHUNK장씩 나아간다
// (careerValues.ts와 같은 방식). 운영에서 끝나면(app_meta card_values_backfill = VERSION) 이 파일과 routes/hof.ts의
// 호출을 지운다.
const VERSION = '1';
const META_KEY = 'card_values_backfill';
/** 스냅샷 JSON을 읽으므로 Workers CPU 안에 들도록 작게. D1 바인딩 한도(100)보다도 작다. */
const CHUNK = 60;

/** 채우는 중이면 다음 한 조각을 처리한다. 무언가 했으면 true. */
export async function ensureCardValuesBackfilled(db: Db, chunk = CHUNK): Promise<boolean> {
  const [meta] = await db
    .select({ value: appMeta.value })
    .from(appMeta)
    .where(eq(appMeta.key, META_KEY));
  if (meta?.value === VERSION) return false;
  const rows = await db
    .select({
      id: cards.careerId,
      peak: cards.peak,
      legendScore: cards.legendScore,
      snapshotJson: careers.snapshotJson,
    })
    .from(cards)
    .innerJoin(careers, eq(careers.id, cards.careerId))
    .where(and(isNull(cards.cardValue), isNotNull(careers.snapshotJson)))
    .limit(chunk);
  const statements = rows.map((r) => {
    const { career } = JSON.parse(r.snapshotJson!) as LegendSnapshot;
    return db
      .update(cards)
      .set({
        cardValue: cardValue(career, r.peak),
        retireValue: retireValue(career, r.legendScore),
      })
      .where(eq(cards.careerId, r.id));
  });
  await runBatch(db, [
    ...statements,
    ...(rows.length < chunk ? [setMeta(db, META_KEY, VERSION)] : []),
  ]);
  return true;
}
