import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';

// T-11-661 통합 보기(report_feed · store_purchase_ledger)가 표마다 조건을 내려 인덱스로 읽는지(표 전체 훑기 없음) 고정한다.

describe('통합 보기 쿼리 계획 (T-11-661)', () => {
  let ctx: TestD1;
  beforeAll(async () => {
    ctx = await createTestD1();
  });
  afterAll(async () => {
    await ctx.dispose();
  });
  const plan = async (sql: string, ...params: unknown[]) =>
    (
      await ctx.env.DB.prepare(`EXPLAIN QUERY PLAN ${sql}`)
        .bind(...params)
        .all<{ detail: string }>()
    ).results.map((r) => r.detail);

  it('새 신고 알림: 네 신고 표 모두 인덱스로 찾는다', async () => {
    const p = await plan(
      `SELECT source, target_id, count(*) FROM report_feed
        WHERE resolved_at IS NULL AND created_at > ?1 AND created_at <= ?2 GROUP BY source, target_kind, target_id`,
      '2026-11-07T00:00:00.000Z',
      '2026-11-07T01:00:00.000Z',
    );
    for (const t of [
      'name_reports',
      'chat_reports',
      'board_comment_reports',
      'team_comment_reports',
    ])
      expect(
        p.some((d) => d.includes(t) && /USING (COVERING )?INDEX/.test(d)),
        `${t}: ${p.join(' | ')}`,
      ).toBe(true);
    expect(p.filter((d) => /^SCAN \w+_reports$/.test(d))).toEqual([]);
  });

  it('구매 장부: 프로필 · 거래 키 조회가 두 장부 모두 인덱스를 탄다', async () => {
    const p = await plan(
      'SELECT ledger FROM store_purchase_ledger WHERE store = ? AND transaction_id = ?',
      'app_store',
      't1',
    );
    for (const t of ['iap_purchases', 'iap_ad_free_purchases'])
      expect(
        p.some((d) => d.includes(t) && /USING|PRIMARY KEY/.test(d)),
        p.join(' | '),
      ).toBe(true);
  });
});
