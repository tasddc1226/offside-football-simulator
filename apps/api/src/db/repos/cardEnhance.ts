import { resolveBalance } from '@offside/contracts';
import { ENHANCE_TICKER_FROM, type EnhanceRules } from '@offside/contracts/card-enhance';
import type { TickerEnhance } from '@offside/contracts';
import { TICKER_FIRSTS_MAX } from '@offside/contracts/polling';
import type { Db } from '../client.js';
import { getActiveBalance } from './balance.js';

// T-11-373 카드 강화(docs/tracking/card-enhance-plan.md). 판정은 서버가 하고, 한 번의 시도는 D1 batch 하나다 — 첫 문장의 조건부
// INSERT(카드 상태 · 하루 한도가 라우트가 본 그대로일 때만)가 "이번 요청이 이겼는가"의 표식이고, 자금 · 카드 갱신은 그 행이 있을
// 때만 한다. 잔액이 모자라면 owner_funds CHECK 위반으로 batch 전체가 되돌아간다.

/** 운영 도구 밸런스 설정의 강화 수치(활성 버전, 없으면 기본값). */
export async function enhanceRules(db: Db): Promise<EnhanceRules> {
  const b = resolveBalance((await getActiveBalance(db))?.values);
  return {
    costScale: b.enhanceCostScale,
    rateScale: b.enhanceRateScale,
    pity: b.enhancePity,
    dailyCap: b.enhanceDailyCap,
    effectScale: b.enhanceEffectScale,
  };
}

/** 구단주 팀 경기 효과 배율만(경기 · 팀 화면 경로). */
export const enhanceEffectScale = async (db: Db) => (await enhanceRules(db)).effectScale;

/** 오늘(since 뒤) 시도 수와 잔액. 카드를 주면 그 카드의 강화 상태와 열린 판매 등록 여부도 같은 왕복에 읽는다. */
export async function enhanceSnapshot(db: Db, profileId: string, since: string, careerId?: string) {
  const row = await db.$client
    .prepare(
      `SELECT (SELECT count(*) FROM card_enhance_log WHERE profile_id = ?1 AND created_at >= ?2) AS used,
              (SELECT balance FROM owner_funds WHERE profile_id = ?1) AS balance,
              k.owner_id AS ownerId, k.manager AS manager, k.card_value AS cardValue,
              k.enhance AS enhance, k.enhance_fails AS fails,
              EXISTS (SELECT 1 FROM market_listings WHERE career_id = ?3 AND status = 'open') AS listed
         FROM (SELECT 1) LEFT JOIN cards k ON k.career_id = ?3`,
    )
    .bind(profileId, since, careerId ?? null)
    .first<{
      used: number;
      balance: number | null;
      ownerId: string | null;
      manager: number | null;
      cardValue: number | null;
      enhance: number | null;
      fails: number | null;
      listed: number;
    }>();
  return {
    used: row?.used ?? 0,
    balance: row?.balance ?? 0,
    card:
      row && row.ownerId !== null && row.enhance !== null
        ? {
            ownerId: row.ownerId,
            manager: !!row.manager,
            cardValue: row.cardValue,
            enhance: row.enhance,
            fails: row.fails ?? 0,
            listed: !!row.listed,
          }
        : null,
  };
}

/**
 * 강화 한 번. 1) 카드가 라우트가 본 단계 · 실패 수 그대로(내 카드 · 감독 아님 · 기준가 있음 · 열린 등록 없음)이고 오늘 시도 수가 used
 * 그대로일 때만 기록을 넣고 2) 그 행이 있으면 자금을 빼고 3) 카드 단계 · 실패 수를 바꾼다. won = 1이 들어갔는가.
 */
export async function attemptEnhance(
  db: Db,
  a: {
    id: string;
    profileId: string;
    careerId: string;
    from: number;
    fails: number;
    to: number;
    nextFails: number;
    success: boolean;
    rateBp: number;
    roll: number;
    cost: number;
    used: number;
    since: string;
    now: string;
  },
): Promise<{ won: boolean; balance: number }> {
  const d1 = db.$client;
  const won = `EXISTS (SELECT 1 FROM card_enhance_log WHERE id = ?)`;
  const results = await d1.batch([
    d1
      .prepare(
        `INSERT INTO card_enhance_log
           (id, profile_id, career_id, from_level, to_level, success, rate_bp, roll, cost, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
         WHERE EXISTS (SELECT 1 FROM cards
                        WHERE career_id = ?3 AND owner_id = ?2 AND manager = 0 AND card_value IS NOT NULL
                          AND enhance = ?4 AND enhance_fails = ?11)
           AND NOT EXISTS (SELECT 1 FROM market_listings WHERE career_id = ?3 AND status = 'open')
           AND (SELECT count(*) FROM card_enhance_log WHERE profile_id = ?2 AND created_at >= ?12) = ?13`,
      )
      .bind(
        a.id,
        a.profileId,
        a.careerId,
        a.from,
        a.to,
        a.success ? 1 : 0,
        a.rateBp,
        a.roll,
        a.cost,
        a.now,
        a.fails,
        a.since,
        a.used,
      ),
    d1
      .prepare(
        `UPDATE owner_funds SET balance = balance - ?, updated_at = ? WHERE profile_id = ? AND ${won}`,
      )
      .bind(a.cost, a.now, a.profileId, a.id),
    d1
      .prepare(
        `UPDATE cards SET enhance = ?, enhance_fails = ?, updated_at = ? WHERE career_id = ? AND ${won}`,
      )
      .bind(a.to, a.nextFails, a.now, a.careerId, a.id),
    d1.prepare(`SELECT balance FROM owner_funds WHERE profile_id = ?`).bind(a.profileId),
  ]);
  const row = results.at(-1)!.results[0] as { balance: number } | undefined;
  return { won: results[0]!.meta.changes === 1, balance: row?.balance ?? 0 };
}

/** 홈 전광판: 최근 7일 +8 이상 성공(부분 인덱스 card_enhance_log_big_idx로 최신순 — 조건을 상수로 써야 그 인덱스를 탄다). 숨긴 커리어는 빼고, 이름은 공개 이름만. */
export async function tickerEnhances(db: Db, nowMs: number): Promise<TickerEnhance[]> {
  const since = new Date(nowMs - 7 * 24 * 60 * 60_000).toISOString();
  const rows = await db.$client
    .prepare(
      `SELECT l.created_at AS at, l.to_level AS level, c.public_name AS name, k.pos AS pos, k.number AS number
         FROM card_enhance_log l
         JOIN cards k ON k.career_id = l.career_id
         JOIN careers c ON c.id = l.career_id
        WHERE l.success = 1 AND l.to_level >= ${ENHANCE_TICKER_FROM} AND l.created_at >= ?1 AND coalesce(c.hidden, 0) = 0
        ORDER BY l.created_at DESC
        LIMIT ?2`,
    )
    .bind(since, TICKER_FIRSTS_MAX)
    .all<TickerEnhance>();
  return rows.results;
}
