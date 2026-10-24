import type {
  ExchangeCard,
  ExchangeDef,
  ExchangeReward,
} from '@offside/contracts/card-exchange-rules';
import type { Db } from '../client.js';
import { grantItemStatement } from './itemShop.js';

// T-11-374 카드 바치기 과제. 과제 정의는 코드(contracts card-exchange-rules)에 있고 여기서는 낸 기록과 카드 비우기만 한다.

/** 오늘 과제마다 내가 낸 횟수. card_exchange_claims_profile_idx가 받친다. */
export async function myClaimCounts(
  db: Db,
  profileId: string,
  exchangeIds: readonly string[],
): Promise<Record<string, number>> {
  const { results } = await db.$client
    .prepare(
      `SELECT exchange_id AS id, count(*) AS n FROM card_exchange_claims
       WHERE profile_id = ? AND exchange_id IN (SELECT value FROM json_each(?)) GROUP BY exchange_id`,
    )
    .bind(profileId, JSON.stringify(exchangeIds))
    .all<{ id: string; n: number }>();
  return Object.fromEntries(results.map((r) => [r.id, r.n]));
}

/**
 * 낼 카드 후보: 요청한 카드 중 지금 내 카드(기본키로만 읽는다). raised는 내가 직접 키운 커리어인지(영입한 카드는 낼 수 없다).
 * 조건 판정은 contracts 순수 함수가 한다.
 */
export async function exchangeCardsOf(
  db: Db,
  profileId: string,
  careerIds: readonly string[],
): Promise<(ExchangeCard & { raised: number })[]> {
  const { results } = await db.$client
    .prepare(
      `SELECT k.career_id AS careerId, k.pos, k.nation, k.peak, k.legend_score AS legendScore,
              k.service_season AS season, c.foot, coalesce(c.profile_id = ?, 0) AS raised
       FROM cards k LEFT JOIN careers c ON c.id = k.career_id
       WHERE k.career_id IN (SELECT value FROM json_each(?)) AND k.owner_id = ?`,
    )
    .bind(profileId, JSON.stringify(careerIds), profileId)
    .all<ExchangeCard & { raised: number }>();
  return results;
}

/**
 * 카드 내기. D1 batch 하나(하나의 트랜잭션)라 중간 문장이 실패하면 전부 되돌아간다.
 *   1. 이 과제를 오늘 아직 내지 않았을 때만 낸 기록을 넣는다.
 *   2. 방출과 같은 가드(내 카드 · 직접 키운 커리어 · 잠금 · 감독 · 열린 등록 · 숨김)를 지나는 요청 카드의 주인을 비우고
 *      consumed_in에 기록 id를 남긴다.
 *   3. 기록의 cards에 실제로 비운 장수를 채운다. need와 다르면 CHECK 위반으로 batch 전체가 되돌아간다.
 *   4. 이 기록으로 오늘 과제(dayIds)를 모두 냈으면 기록에 보상을 적고(reward_json은 그때까지 '', 보상이 0장이어도 '[]')
 *      보상 아이템을 더한다. batch는 서로 끼어들지 않아 마지막 과제를 낸 요청 하나만 보상을 받는다.
 * 이미 냈으면 1번이 넣지 않아 나머지 문장도 아무것도 바꾸지 않는다 — claimed false.
 */
export async function claimExchange(
  db: Db,
  r: {
    id: string;
    profileId: string;
    def: ExchangeDef;
    dayIds: readonly string[];
    reward: readonly ExchangeReward[];
    careerIds: readonly string[];
    now: string;
  },
): Promise<{ claimed: boolean; done: number; completed: boolean }> {
  const d1 = db.$client;
  const ids = JSON.stringify(r.careerIds);
  const day = JSON.stringify(r.dayIds);
  const claim = `EXISTS (SELECT 1 FROM card_exchange_claims WHERE id = ?)`;
  const todayCount = `(SELECT count(*) FROM card_exchange_claims
    WHERE profile_id = ? AND exchange_id IN (SELECT value FROM json_each(?)))`;
  const finished = {
    sql: `${claim} AND ${todayCount} = ?`,
    params: [r.id, r.profileId, day, r.dayIds.length],
  };
  const results = await d1.batch([
    d1
      .prepare(
        `INSERT INTO card_exchange_claims (id, profile_id, exchange_id, need, reward_json, created_at)
         SELECT ?, ?, ?, ?, '', ?
         WHERE NOT EXISTS (SELECT 1 FROM card_exchange_claims WHERE profile_id = ? AND exchange_id = ?)`,
      )
      .bind(r.id, r.profileId, r.def.id, r.careerIds.length, r.now, r.profileId, r.def.id),
    d1
      .prepare(
        `UPDATE cards SET owner_id = NULL, consumed_in = ?, updated_at = ?
         WHERE career_id IN (SELECT value FROM json_each(?)) AND owner_id = ? AND locked = 0 AND manager = 0
           AND ${claim}
           AND EXISTS (SELECT 1 FROM careers c WHERE c.id = cards.career_id AND c.profile_id = ? AND c.hidden = 0)
           AND NOT EXISTS (SELECT 1 FROM market_listings l WHERE l.career_id = cards.career_id AND l.status = 'open')`,
      )
      .bind(r.id, r.now, ids, r.profileId, r.id, r.profileId),
    d1
      .prepare(
        `UPDATE card_exchange_claims SET cards = (
           SELECT count(*) FROM cards WHERE career_id IN (SELECT value FROM json_each(?)) AND consumed_in = ?)
         WHERE id = ?`,
      )
      .bind(ids, r.id, r.id),
    d1
      .prepare(`UPDATE card_exchange_claims SET reward_json = ? WHERE id = ? AND ${finished.sql}`)
      .bind(JSON.stringify(r.reward), r.id, ...finished.params),
    ...r.reward.map((w) => grantItemStatement(d1, r.profileId, w.item, w.qty, r.now, finished)),
    d1.prepare(`SELECT ${todayCount} AS n`).bind(r.profileId, day),
  ]);
  const done = (results.at(-1)!.results[0] as { n: number } | undefined)?.n ?? 0;
  return {
    claimed: (results[0]!.meta.changes ?? 0) === 1,
    done,
    completed: (results[3]!.meta.changes ?? 0) === 1,
  };
}

/** batch 안의 장수 확인(CHECK)이 실패했나 — 그 사이 카드가 잠기거나 팔리거나 사라졌다. */
export const isClaimCardsCheck = (e: unknown) => String(e).includes('CHECK constraint failed');
