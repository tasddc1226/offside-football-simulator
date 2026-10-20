import type { LegendSnapshot } from '@offside/contracts';
import {
  cardValue,
  retireValue,
  seasonValue,
  type ValueRow,
} from '@offside/contracts/market-value';
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

// T-11-422 카드 기준가를 '최고 OVR 마지막 시즌'에서 '최고 OVR 시즌 중 가장 비싼 시즌'으로 바꾼 뒤 이미 생긴 카드를 다시
// 매긴다. 은퇴 상세는 R2로 옮겨졌으니 career_seasons(나이 · 리그 · OVR · 복무)로 센다. 최고 OVR 시즌이 둘 이상인 카드만
// 값이 바뀔 수 있고, 새 값이 더 클 때만 올린다(시즌 업로드가 빠진 기록이 내려가지 않게). 5분 cron이 cards rowid 커서로
// 한 번만 훑고 끝까지 가면 멈춘다. 운영에서 끝나면(app_meta CARD_VALUE_RESCAN_KEY의 done) 이 함수와 cron 호출을 지운다.
export const CARD_VALUE_RESCAN_KEY = 'cron:card-value-peak:state';
export const CARD_VALUE_RESCAN_PAGE = 500;

export async function runCardValueRescan(
  d1: D1Database,
  page = CARD_VALUE_RESCAN_PAGE,
): Promise<{ scanned: number; raised: number; done: boolean } | null> {
  const raw = await d1
    .prepare('SELECT value FROM app_meta WHERE key = ?')
    .bind(CARD_VALUE_RESCAN_KEY)
    .first<{ value: string }>();
  const state = raw ? (JSON.parse(raw.value) as { cursor: number; done?: boolean }) : { cursor: 0 };
  if (state.done) return null;
  const pageSql = `SELECT rowid AS rid, career_id, card_value, peak FROM cards
    WHERE rowid > ?1 AND card_value IS NOT NULL ORDER BY rowid LIMIT ?2`;
  const [ids, seasons] = await d1.batch([
    d1.prepare(`SELECT max(rid) AS last, count(*) AS n FROM (${pageSql})`).bind(state.cursor, page),
    d1
      .prepare(
        `SELECT c.career_id AS id, c.card_value AS value, s.age, s.league, s.club_id AS clubId, s.mil, s.ovr
        FROM (${pageSql}) c JOIN career_seasons s ON s.career_id = c.career_id AND s.ovr = c.peak`,
      )
      .bind(state.cursor, page),
  ]);
  const head = ids!.results[0] as { last: number | null; n: number };
  const byCard = new Map<string, { value: number; rows: ValueRow[] }>();
  for (const r of seasons!.results as {
    id: string;
    value: number;
    age: number;
    league: string;
    clubId: string | null;
    mil: number;
    ovr: number;
  }[]) {
    const card = byCard.get(r.id) ?? { value: r.value, rows: [] };
    card.rows.push({
      league: r.league,
      clubId: r.clubId ?? undefined,
      mil: !!r.mil,
      ovr: r.ovr,
      age: r.age,
    });
    byCard.set(r.id, card);
  }
  const updates: D1PreparedStatement[] = [];
  for (const [id, card] of byCard) {
    if (card.rows.length < 2) continue;
    const next = Math.max(0, ...card.rows.map(seasonValue));
    if (next > card.value)
      updates.push(
        d1
          .prepare('UPDATE cards SET card_value = ?1 WHERE career_id = ?2 AND card_value < ?1')
          .bind(next, id),
      );
  }
  const done = head.n < page;
  updates.push(
    d1
      .prepare(
        'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .bind(
        CARD_VALUE_RESCAN_KEY,
        JSON.stringify({ cursor: head.last ?? state.cursor, ...(done ? { done: true } : {}) }),
      ),
  );
  await d1.batch(updates);
  return { scanned: head.n, raised: updates.length - 1, done };
}
