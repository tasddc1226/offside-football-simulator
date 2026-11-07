import { resolveBalance } from '@offside/contracts';
import {
  enhanceTierOf,
  type EnhanceRules,
  type EnhanceTier,
} from '@offside/contracts/card-enhance';
import type { Db } from '../client.js';
import { getActiveBalance } from './balance.js';

// T-11-373 카드 강화(docs/tracking/card-enhance-plan.md). 판정은 서버가 하고, 한 번의 시도는 D1 batch 하나다. 첫 문장의 조건부
// INSERT(카드 단계 · 실패 수가 라우트가 본 그대로이고, 같은 멱등 키가 없고, 잔액이 넉넉할 때만)가
// "이번 요청이 이겼는가"의 표식이고, 자금 · 카드 갱신은 그 행이 있을 때만 한다.

/** 운영 도구 밸런스 설정의 강화 수치(활성 버전, 없으면 기본값). */
export async function enhanceRules(db: Db): Promise<EnhanceRules> {
  const b = resolveBalance((await getActiveBalance(db))?.values);
  return {
    open: b.enhanceOpen >= 1,
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
  tier: EnhanceTier;
  listed: boolean;
};

/** 카드 하나의 강화 상태와 구단 자금 잔액(한 번에). 카드가 없으면 card = null. */
export async function enhanceSnapshot(db: Db, profileId: string, careerId: string) {
  const row = await db.$client
    .prepare(
      `SELECT (SELECT balance FROM owner_funds WHERE profile_id = ?1) AS balance,
              k.owner_id AS ownerId, k.manager AS manager, k.card_value AS cardValue,
              k.enhance AS level, k.enhance_fails AS fails, k.peak AS peak,
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
      peak: number | null;
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
          tier: enhanceTierOf(row.peak),
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

/** 강화로 바뀌는 팀 OVR · 컵 명단 OVR. 그 사이 편성을 저장했으면(저장이 OVR을 다시 잰다) 건드리지 않는다. */
export type EnhanceTeamChange = {
  id: string;
  slotsJson: string;
  presetsJsonBefore: string | null;
  ovr: number;
  cupOvr: number | null;
  presetsJson: string | null;
};

/**
 * 강화 한 번. 1) 카드가 라우트가 본 단계 · 실패 수 그대로(내 카드 · 감독 아님 · 기준가 있음 · 열린 등록 없음)이고, 같은 멱등 키가 없고, 잔액이 비용 이상일 때만 기록을 넣고 2) 그 행이 있으면 자금을 빼고 3) 카드
 * 단계 · 실패 수를 바꾼다. won = 1이 들어갔는가.
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
    to: number;
    nextFails: number;
    success: boolean;
    rateBp: number;
    downBp: number;
    roll: number;
    cost: number;
    now: string;
    team?: EnhanceTeamChange;
  },
): Promise<{ won: boolean; balance: number }> {
  const d1 = db.$client;
  const won = `EXISTS (SELECT 1 FROM card_enhance_log WHERE id = ?)`;
  const results = await d1.batch([
    d1
      .prepare(
        `INSERT INTO card_enhance_log
           (id, profile_id, career_id, request_key, from_level, to_level, fails, success, rate_bp, down_bp, roll, cost, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13
         WHERE EXISTS (SELECT 1 FROM cards k
                        WHERE k.career_id = ?3 AND k.owner_id = ?2 AND k.manager = 0 AND k.card_value IS NOT NULL
                          AND k.enhance = ?5 AND k.enhance_fails = ?7)
           AND NOT EXISTS (SELECT 1 FROM market_listings WHERE career_id = ?3 AND status = 'open')
           AND NOT EXISTS (SELECT 1 FROM card_enhance_log WHERE profile_id = ?2 AND request_key = ?4)
           AND coalesce((SELECT balance FROM owner_funds WHERE profile_id = ?2), 0) >= ?12`,
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
        a.downBp,
        a.roll,
        a.cost,
        a.now,
      ),
    d1
      .prepare(
        `UPDATE owner_funds SET balance = balance - ?, updated_at = ? WHERE profile_id = ? AND ${won}`,
      )
      .bind(a.cost, a.now, a.profileId, a.id),
    // T-11-660 자금 거래 기록(같은 조건, 차감 직후 잔액).
    d1
      .prepare(
        `INSERT INTO owner_fund_ledger (profile_id, kind, delta, balance, ref, created_at)
         SELECT ?, 'enhance', -?, (SELECT balance FROM owner_funds WHERE profile_id = ?), ?, ? WHERE ${won}`,
      )
      .bind(a.profileId, a.cost, a.profileId, a.careerId, a.now, a.id),
    d1
      .prepare(
        `UPDATE cards SET enhance = ?, enhance_fails = ?, updated_at = ?
          WHERE career_id = ? AND ${won}`,
      )
      .bind(a.to, a.nextFails, a.now, a.careerId, a.id),
    ...(a.team
      ? [
          d1
            .prepare(
              `UPDATE owner_teams SET ovr = ?, cup_ovr = ?, presets_json = ?
                WHERE id = ? AND slots_json = ? AND presets_json IS ? AND ${won}`,
            )
            .bind(
              a.team.ovr,
              a.team.cupOvr,
              a.team.presetsJson,
              a.team.id,
              a.team.slotsJson,
              a.team.presetsJsonBefore,
              a.id,
            ),
        ]
      : []),
    d1.prepare(`SELECT balance FROM owner_funds WHERE profile_id = ?`).bind(a.profileId),
  ]);
  const row = results.at(-1)!.results[0] as { balance: number } | undefined;
  return { won: results[0]!.meta.changes === 1, balance: row?.balance ?? 0 };
}

/**
 * 시즌 업적 재료: 구간(시작 이상 · 끝 미만, 끝 없으면 지금까지) 안의 강화 시도. 카드 단계는 내려가도 기록은 남으므로 로그로 센다.
 * card_enhance_log_profile_idx를 탄다.
 */
export async function enhanceActivityIn(
  db: Db,
  profileId: string,
  from: string,
  until: string | null,
  asOf?: string,
) {
  const row = await db.$client
    .prepare(
      `SELECT count(*) AS tries,
              coalesce(sum(success), 0) AS successes,
              coalesce(sum(to_level < from_level), 0) AS downs,
              coalesce(max(CASE WHEN success = 1 THEN to_level ELSE 0 END), 0) AS best
         FROM card_enhance_log
        WHERE profile_id = ?1 AND created_at >= ?2
          AND (?3 IS NULL OR created_at < ?3) AND (?4 IS NULL OR created_at <= ?4)`,
    )
    .bind(profileId, from, until, asOf ?? null)
    .first<{ tries: number; successes: number; downs: number; best: number }>();
  return {
    tries: row?.tries ?? 0,
    successes: row?.successes ?? 0,
    downs: row?.downs ?? 0,
    best: row?.best ?? 0,
  };
}
