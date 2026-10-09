import {
  REWARD_KINDS,
  REWARD_UNCAPPED,
  resolveBalance,
  type FundsSpend,
  type RewardKind,
} from '@offside/contracts';
import type { Db } from '../client.js';
import { getActiveBalance } from './balance.js';

// T-11-152 구단 자금으로 사는 선수 후보 리롤권. 쌓이기만 하는 구단 자금을 없애는 곳이라 비싸게 팔고, 같은 날 더 살수록
// 비싸지며 하루 상한이 있다. 수치는 운영 도구 밸런스 설정(이적시장 묶음)의 활성 버전을 요청 때 바로 읽는다.

/** 리롤권 상점 수치(활성 버전, 없으면 기본값). */
export async function rerollShopRules(db: Db) {
  const b = resolveBalance((await getActiveBalance(db))?.values);
  return { price: b.rerollPrice, growth: b.rerollPriceGrowth, cap: b.rerollDailyCap };
}

/** 가진 리롤권 · 구단 자금 · since(오늘 0시, 한국 시각) 뒤에 산 장수를 한 번에 읽는다(행이 없으면 0). */
export async function shopSnapshot(db: Db, profileId: string, since: string) {
  const row = await db.$client
    .prepare(
      `SELECT (SELECT qty FROM owner_items WHERE profile_id = ?1 AND item = 'reroll') AS reroll,
              (SELECT balance FROM owner_funds WHERE profile_id = ?1) AS balance,
              (SELECT coalesce(sum(qty), 0) FROM owner_item_purchases
                WHERE profile_id = ?1 AND item = 'reroll' AND created_at >= ?2) AS bought`,
    )
    .bind(profileId, since)
    .first<{ reroll: number | null; balance: number | null; bought: number }>();
  return { reroll: row?.reroll ?? 0, balance: row?.balance ?? 0, bought: row?.bought ?? 0 };
}

/**
 * 구단 자금으로 하나 사기(item = 원장 이름). 1) 오늘 같은 item을 산 수가 라우트가 본 값(bought) 그대로일 때만 원장에 넣고
 * 2) 그 행이 있으면 자금을 빼고 3) grantReroll이면 리롤권을 더한다. 동시에 두 번 사면 뒤 요청은 1이 0행이라 아무것도 바꾸지
 * 않는다(won = false). 잔액이 모자라면 CHECK 위반으로 batch 전체가 되돌아간다.
 */
async function buyItem(
  db: Db,
  b: {
    id: string;
    profileId: string;
    item: string;
    grantReroll: boolean;
    price: number;
    bought: number;
    since: string;
    now: string;
  },
): Promise<{ won: boolean; balance: number; reroll: number }> {
  const d1 = db.$client;
  const won = `EXISTS (SELECT 1 FROM owner_item_purchases WHERE id = ?)`;
  const results = await d1.batch([
    d1
      .prepare(
        `INSERT INTO owner_item_purchases (id, profile_id, item, qty, price, created_at)
         SELECT ?, ?, ?, 1, ?, ?
         WHERE (SELECT coalesce(sum(qty), 0) FROM owner_item_purchases
                WHERE profile_id = ? AND item = ? AND created_at >= ?) = ?`,
      )
      .bind(b.id, b.profileId, b.item, b.price, b.now, b.profileId, b.item, b.since, b.bought),
    d1
      .prepare(
        `UPDATE owner_funds SET balance = balance - ?, updated_at = ? WHERE profile_id = ? AND ${won}`,
      )
      .bind(b.price, b.now, b.profileId, b.id),
    ...(b.grantReroll
      ? [
          d1
            .prepare(
              `INSERT INTO owner_items (profile_id, item, qty, updated_at)
               SELECT ?, 'reroll', 1, ? WHERE ${won}
               ON CONFLICT (profile_id, item) DO UPDATE SET qty = qty + 1, updated_at = excluded.updated_at`,
            )
            .bind(b.profileId, b.now, b.id),
        ]
      : []),
    d1
      .prepare(
        `SELECT (SELECT balance FROM owner_funds WHERE profile_id = ?) AS balance,
                (SELECT qty FROM owner_items WHERE profile_id = ? AND item = 'reroll') AS reroll`,
      )
      .bind(b.profileId, b.profileId),
  ]);
  const row = results.at(-1)!.results[0] as { balance: number | null; reroll: number | null };
  return {
    won: results[0]!.meta.changes === 1,
    balance: row.balance ?? 0,
    reroll: row.reroll ?? 0,
  };
}

/** 리롤권 한 장 사기(buyItem). */
export const buyReroll = (
  db: Db,
  b: { id: string; profileId: string; price: number; bought: number; since: string; now: string },
) => buyItem(db, { ...b, item: 'reroll', grantReroll: true });

// ───────── T-11-153 광고 대신 구단 자금으로 받는 보상 ─────────
// 앱의 보상형 광고 자리(후보 잠재력 · 시즌 평가 보기 · 자금이 모자란 시즌의 강화)를 구단 자금으로도 받게 한다. 서버는 자금만
// 받고 원장(item = reward:<kind>)에 남긴다. 보상 자체는 기기의 게임이 준다(커리어는 기기에 있다).

const rewardItem = (kind: RewardKind) => `reward:${kind}`;
const byKind = <T>(f: (k: RewardKind) => T) =>
  Object.fromEntries(REWARD_KINDS.map((k) => [k, f(k)])) as Record<RewardKind, T>;
// 보상 종류는 코드 상수라 SQL에 바로 넣는다. IN 목록이라 (profile_id, item, created_at) 인덱스를 탄다.
const REWARD_ITEMS = REWARD_KINDS.map((k) => `'${rewardItem(k)}'`).join(', ');
const REWARD_SUMS = REWARD_KINDS.map(
  (k) => `coalesce(sum(CASE WHEN item = '${rewardItem(k)}' THEN qty END), 0) AS ${k}`,
).join(', ');

/** 보상별 수치(활성 버전, 없으면 기본값). 가격 상승 배율 · 하루 횟수는 셋이 같이 쓴다. T-11-173 강화는 하루 횟수 없음. */
export async function rewardShopRules(db: Db) {
  const b = resolveBalance((await getActiveBalance(db))?.values);
  const price: Record<RewardKind, number> = {
    candidates: b.rewardPriceCandidates,
    peek: b.rewardPricePeek,
    boost: b.rewardPriceBoost,
  };
  return byKind((k) => ({
    price: price[k],
    growth: b.rewardPriceGrowth,
    cap: k === 'boost' && b.rewardDailyCap > 0 ? REWARD_UNCAPPED : b.rewardDailyCap,
  }));
}

/** 구단 자금과 since(오늘 0시, 한국 시각) 뒤에 보상마다 받은 횟수를 한 번에 읽는다(행이 없으면 0). */
export async function rewardSnapshot(db: Db, profileId: string, since: string) {
  const row = await db.$client
    .prepare(
      `SELECT (SELECT balance FROM owner_funds WHERE profile_id = ?1) AS balance, ${REWARD_SUMS}
         FROM owner_item_purchases
        WHERE profile_id = ?1 AND item IN (${REWARD_ITEMS}) AND created_at >= ?2`,
    )
    .bind(profileId, since)
    .first<{ balance: number | null } & Record<RewardKind, number>>();
  return {
    balance: row?.balance ?? 0,
    bought: byKind((k) => row?.[k] ?? 0),
  };
}

/** 보상 한 번을 구단 자금으로 받기(buyItem). */
export const buyRewardWithFunds = (
  db: Db,
  b: {
    id: string;
    profileId: string;
    kind: RewardKind;
    price: number;
    bought: number;
    since: string;
    now: string;
  },
) => buyItem(db, { ...b, item: rewardItem(b.kind), grantReroll: false });

/** 구단 자금으로 산 것(리롤권 · 광고 대신 받은 보상) 최근 limit개. 이적시장 '자금 내역'에 거래와 함께 보인다. */
export async function myFundsSpends(
  db: Db,
  profileId: string,
  limit: number,
): Promise<FundsSpend[]> {
  const { results } = await db.$client
    .prepare(
      `SELECT id, item, price AS amount, created_at AS at FROM owner_item_purchases
        WHERE profile_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(profileId, limit)
    .all<FundsSpend>();
  return results;
}
