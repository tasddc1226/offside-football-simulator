import type { Db } from '../client.js';
import { MATCH_INCOME_KIND } from './ownerTeams.js';

/** T-11-823 광고를 보고 한 번 더 받은 랭크 경기 수입(owner_fund_ledger.kind). ref는 경기 id, 경기마다 한 줄뿐이다. */
export const MATCH_INCOME_AD_KIND = 'match_income_ad';
/** 내역 · 대조가 경기 수입으로 함께 세는 kind 목록(SQL IN 안에 그대로 넣는다). */
export const MATCH_INCOME_KINDS_SQL = `'${MATCH_INCOME_KIND}', '${MATCH_INCOME_AD_KIND}'`;
/** 경기가 끝난 뒤 이 시간 안에만 한 번 더 받을 수 있다(결과 화면에서 바로 누르는 버튼이다). */
export const MATCH_INCOME_AD_WINDOW_MS = 60 * 60_000;

/**
 * T-11-823 앱에서 보상형 광고를 끝까지 본 뒤(광고 제거 · 멤버십은 바로) 그 경기 수입을 한 번 더 받는다. 광고 시청을 서버가
 * 확인하지는 않는다(경기마다 한 번 · 그 경기에서 받은 만큼이라 따로 부르는 이득이 광고를 보는 것과 같다, 출석 한 번 더와 같은 기준).
 * 내가 걸어 수입을 받은 경기여야 하고(거래 기록의 match_income 줄), 이미 받았으면 다시 주지 않는다. D1 batch는 한 트랜잭션이라
 * 두 문장이 같은 조건을 본다 — 잔액을 먼저 올리고, 같은 조건으로 기록 줄을 넣는다(넣은 뒤에는 조건이 거짓이 된다).
 */
export async function claimMatchIncomeAd(
  db: Db,
  r: { profileId: string; matchId: string; now: string },
): Promise<{ amount: number; balance: number } | 'none' | 'taken'> {
  const d1 = db.$client;
  const since = new Date(Date.parse(r.now) - MATCH_INCOME_AD_WINDOW_MS).toISOString();
  const base = `SELECT delta FROM owner_fund_ledger
                 WHERE profile_id = ? AND kind = '${MATCH_INCOME_KIND}' AND ref = ? AND created_at >= ?`;
  const open = `NOT EXISTS (SELECT 1 FROM owner_fund_ledger
                             WHERE profile_id = ? AND kind = '${MATCH_INCOME_AD_KIND}' AND ref = ?)`;
  const results = await d1.batch([
    d1.prepare(`${base} LIMIT 1`).bind(r.profileId, r.matchId, since),
    d1
      .prepare(
        `UPDATE owner_funds SET balance = balance + (${base} LIMIT 1), updated_at = ?
          WHERE profile_id = ? AND EXISTS (${base}) AND ${open}`,
      )
      .bind(
        r.profileId,
        r.matchId,
        since,
        r.now,
        r.profileId,
        r.profileId,
        r.matchId,
        since,
        r.profileId,
        r.matchId,
      ),
    d1
      .prepare(
        `INSERT INTO owner_fund_ledger (profile_id, kind, delta, balance, ref, created_at)
         SELECT ?, '${MATCH_INCOME_AD_KIND}', delta, (SELECT balance FROM owner_funds WHERE profile_id = ?), ?, ?
           FROM (${base} LIMIT 1) WHERE ${open}`,
      )
      .bind(
        r.profileId,
        r.profileId,
        r.matchId,
        r.now,
        r.profileId,
        r.matchId,
        since,
        r.profileId,
        r.matchId,
      ),
    d1.prepare(`SELECT balance FROM owner_funds WHERE profile_id = ?`).bind(r.profileId),
  ]);
  const found = results[0]!.results[0] as { delta: number } | undefined;
  if (!found) return 'none';
  if (!results[1]!.meta.changes) return 'taken';
  const bal = results[3]!.results[0] as { balance: number } | undefined;
  return { amount: found.delta, balance: bal?.balance ?? 0 };
}
