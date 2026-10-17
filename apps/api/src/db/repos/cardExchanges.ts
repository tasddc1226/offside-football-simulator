import type { ExchangeCard, ExchangeDef } from '@offside/contracts/card-exchange-rules';
import type { Db } from '../client.js';
import { grantItemStatement } from './itemShop.js';

// T-11-374 카드 바치기 과제. 과제 정의는 코드(contracts card-exchange-rules)에 있고 여기서는 낸 기록과 카드 비우기만 한다.

/** 이번 주 · 이번 시즌 과제마다 내가 낸 횟수. card_exchange_claims_profile_idx가 받친다. */
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

/** 낼 카드 후보: 요청한 카드 중 지금 내 카드(기본키로만 읽는다). 조건 판정은 contracts 순수 함수가 한다. */
export async function exchangeCardsOf(
  db: Db,
  profileId: string,
  careerIds: readonly string[],
): Promise<ExchangeCard[]> {
  const { results } = await db.$client
    .prepare(
      `SELECT k.career_id AS careerId, k.pos, k.nation, k.peak, k.legend_score AS legendScore,
              k.service_season AS season, c.foot
       FROM cards k LEFT JOIN careers c ON c.id = k.career_id
       WHERE k.career_id IN (SELECT value FROM json_each(?)) AND k.owner_id = ?`,
    )
    .bind(JSON.stringify(careerIds), profileId)
    .all<ExchangeCard>();
  return results;
}

/**
 * 카드 내기. D1 batch 하나(하나의 트랜잭션)라 중간 문장이 실패하면 전부 되돌아간다.
 *   1. 과제가 아직 횟수가 남았을 때만 낸 기록을 넣는다.
 *   2. 방출과 같은 가드(내 카드 · 잠금 · 감독 · 열린 등록 · 숨김)를 지나는 요청 카드의 주인을 비우고 consumed_in에 기록 id를 남긴다.
 *   3. 기록의 cards에 실제로 비운 장수를 채운다. need와 다르면 CHECK 위반으로 batch 전체가 되돌아간다.
 *   4. 보상 아이템을 더한다(1번 기록이 있을 때만).
 * 횟수가 다 찼으면 1번이 넣지 않아 나머지 문장도 아무것도 바꾸지 않는다 — claimed false.
 */
export async function claimExchange(
  db: Db,
  r: { id: string; profileId: string; def: ExchangeDef; careerIds: readonly string[]; now: string },
): Promise<{ claimed: boolean }> {
  const d1 = db.$client;
  const ids = JSON.stringify(r.careerIds);
  const claim = { sql: `EXISTS (SELECT 1 FROM card_exchange_claims WHERE id = ?)`, params: [r.id] };
  const results = await d1.batch([
    d1
      .prepare(
        `INSERT INTO card_exchange_claims (id, profile_id, exchange_id, need, reward_json, created_at)
         SELECT ?, ?, ?, ?, ?, ?
         WHERE (SELECT count(*) FROM card_exchange_claims WHERE profile_id = ? AND exchange_id = ?) < ?`,
      )
      .bind(
        r.id,
        r.profileId,
        r.def.id,
        r.careerIds.length,
        JSON.stringify(r.def.reward),
        r.now,
        r.profileId,
        r.def.id,
        r.def.maxClaims,
      ),
    d1
      .prepare(
        `UPDATE cards SET owner_id = NULL, consumed_in = ?, updated_at = ?
         WHERE career_id IN (SELECT value FROM json_each(?)) AND owner_id = ? AND locked = 0 AND manager = 0
           AND ${claim.sql}
           AND NOT EXISTS (SELECT 1 FROM careers c WHERE c.id = cards.career_id AND c.hidden = 1)
           AND NOT EXISTS (SELECT 1 FROM market_listings l WHERE l.career_id = cards.career_id AND l.status = 'open')`,
      )
      .bind(r.id, r.now, ids, r.profileId, r.id),
    d1
      .prepare(
        `UPDATE card_exchange_claims SET cards = (
           SELECT count(*) FROM cards WHERE career_id IN (SELECT value FROM json_each(?)) AND consumed_in = ?)
         WHERE id = ?`,
      )
      .bind(ids, r.id, r.id),
    ...r.def.reward.map((w) => grantItemStatement(d1, r.profileId, w.item, w.qty, r.now, claim)),
  ]);
  return { claimed: (results[0]!.meta.changes ?? 0) === 1 };
}

/** batch 안의 장수 확인(CHECK)이 실패했나 — 그 사이 카드가 잠기거나 팔리거나 사라졌다. */
export const isClaimCardsCheck = (e: unknown) => String(e).includes('CHECK constraint failed');
