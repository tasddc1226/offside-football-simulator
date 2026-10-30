import { resolveBalance } from '@offside/contracts';
import type { EnhanceRules } from '@offside/contracts/card-enhance';
import type { Db } from '../client.js';
import { getActiveBalance } from './balance.js';

// T-11-373 카드 강화(docs/tracking/card-enhance-plan.md). 판정은 서버가 하고, 한 번의 시도는 D1 batch 하나다. 첫 문장의 조건부
// INSERT(카드 단계 · 실패 수 · 쓴 시도권이 라우트가 본 그대로이고, 시도권이 남았고, 같은 멱등 키가 없고, 잔액이 넉넉할 때만)가
// "이번 요청이 이겼는가"의 표식이고, 자금 · 카드 갱신은 그 행이 있을 때만 한다.

/** 카드가 구단주 팀 선발로 뛴 랭크 경기 수(쌓아 둔 수 + 지금 선발에서 뛴 수). 카드 별칭은 k. */
const STARTS_SQL = `(k.enhance_starts + coalesce((SELECT sum(t.wins + t.draws + t.losses - s.since)
    FROM team_lineup_cards s JOIN owner_teams t ON t.id = s.team_id
    WHERE s.career_id = k.career_id AND t.profile_id = k.owner_id), 0))`;

/** 운영 도구 밸런스 설정의 강화 수치(활성 버전, 없으면 기본값). */
export async function enhanceRules(db: Db): Promise<EnhanceRules> {
  const b = resolveBalance((await getActiveBalance(db))?.values);
  return {
    open: b.enhanceOpen >= 1,
    startsPerTry: b.enhanceStartsPerTry,
    costScale: b.enhanceCostScale,
    rateScale: b.enhanceRateScale,
  };
}

export type EnhanceCardRow = {
  ownerId: string;
  manager: boolean;
  cardValue: number | null;
  level: number;
  fails: number;
  starts: number;
  used: number;
  listed: boolean;
};

/** 카드 하나의 강화 상태와 구단 자금 잔액(한 번에). 카드가 없으면 card = null. */
export async function enhanceSnapshot(db: Db, profileId: string, careerId: string) {
  const row = await db.$client
    .prepare(
      `SELECT (SELECT balance FROM owner_funds WHERE profile_id = ?1) AS balance,
              k.owner_id AS ownerId, k.manager AS manager, k.card_value AS cardValue,
              k.enhance AS level, k.enhance_fails AS fails, k.enhance_used AS used, ${STARTS_SQL} AS starts,
              EXISTS (SELECT 1 FROM market_listings WHERE career_id = ?2 AND status = 'open') AS listed
         FROM (SELECT 1) LEFT JOIN cards k ON k.career_id = ?2`,
    )
    .bind(profileId, careerId)
    .first<{
      balance: number | null;
      ownerId: string | null;
      manager: number | null;
      cardValue: number | null;
      level: number | null;
      fails: number | null;
      used: number | null;
      starts: number | null;
      listed: number;
    }>();
  const card: EnhanceCardRow | null =
    row && row.ownerId !== null && row.level !== null
      ? {
          ownerId: row.ownerId,
          manager: !!row.manager,
          cardValue: row.cardValue,
          level: row.level,
          fails: row.fails ?? 0,
          starts: row.starts ?? 0,
          used: row.used ?? 0,
          listed: !!row.listed,
        }
      : null;
  return { balance: row?.balance ?? 0, card };
}

/** 같은 멱등 키로 이미 끝난 시도(재시도 응답을 그대로 돌려준다). */
export async function enhanceByRequestKey(db: Db, profileId: string, requestKey: string) {
  return db.$client
    .prepare(
      `SELECT career_id AS careerId, from_level AS "from", to_level AS "to", fails, success, cost
         FROM card_enhance_log WHERE profile_id = ? AND request_key = ?`,
    )
    .bind(profileId, requestKey)
    .first<{
      careerId: string;
      from: number;
      to: number;
      fails: number;
      success: number;
      cost: number;
    }>();
}

/**
 * 강화 한 번. 1) 카드가 라우트가 본 단계 · 실패 수 · 쓴 시도권 그대로(내 카드 · 감독 아님 · 기준가 있음 · 열린 등록 없음)이고, 쓴
 * 시도권 + 1장만큼 선발 경기를 뛰었고, 같은 멱등 키가 없고, 잔액이 비용 이상일 때만 기록을 넣고 2) 그 행이 있으면 자금을 빼고 3) 카드
 * 단계 · 실패 수 · 쓴 시도권을 바꾼다. won = 1이 들어갔는가.
 */
export async function attemptEnhance(
  db: Db,
  a: {
    id: string;
    profileId: string;
    careerId: string;
    requestKey: string;
    from: number;
    fails: number;
    used: number;
    startsPerTry: number;
    to: number;
    nextFails: number;
    success: boolean;
    rateBp: number;
    roll: number;
    cost: number;
    now: string;
  },
): Promise<{ won: boolean; balance: number }> {
  const d1 = db.$client;
  const won = `EXISTS (SELECT 1 FROM card_enhance_log WHERE id = ?)`;
  const results = await d1.batch([
    d1
      .prepare(
        `INSERT INTO card_enhance_log
           (id, profile_id, career_id, request_key, from_level, to_level, fails, success, rate_bp, roll, cost, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12
         WHERE EXISTS (SELECT 1 FROM cards k
                        WHERE k.career_id = ?3 AND k.owner_id = ?2 AND k.manager = 0 AND k.card_value IS NOT NULL
                          AND k.enhance = ?5 AND k.enhance_fails = ?7 AND k.enhance_used = ?13
                          AND ${STARTS_SQL} >= (?13 + 1) * ?14)
           AND NOT EXISTS (SELECT 1 FROM market_listings WHERE career_id = ?3 AND status = 'open')
           AND NOT EXISTS (SELECT 1 FROM card_enhance_log WHERE profile_id = ?2 AND request_key = ?4)
           AND coalesce((SELECT balance FROM owner_funds WHERE profile_id = ?2), 0) >= ?11`,
      )
      .bind(
        a.id,
        a.profileId,
        a.careerId,
        a.requestKey,
        a.from,
        a.to,
        a.fails,
        a.success ? 1 : 0,
        a.rateBp,
        a.roll,
        a.cost,
        a.now,
        a.used,
        a.startsPerTry,
      ),
    d1
      .prepare(
        `UPDATE owner_funds SET balance = balance - ?, updated_at = ? WHERE profile_id = ? AND ${won}`,
      )
      .bind(a.cost, a.now, a.profileId, a.id),
    d1
      .prepare(
        `UPDATE cards SET enhance = ?, enhance_fails = ?, enhance_used = enhance_used + 1, updated_at = ?
          WHERE career_id = ? AND ${won}`,
      )
      .bind(a.to, a.nextFails, a.now, a.careerId, a.id),
    d1.prepare(`SELECT balance FROM owner_funds WHERE profile_id = ?`).bind(a.profileId),
  ]);
  const row = results.at(-1)!.results[0] as { balance: number } | undefined;
  return { won: results[0]!.meta.changes === 1, balance: row?.balance ?? 0 };
}
