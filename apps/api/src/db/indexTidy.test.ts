import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';

// T-11-659 중복 인덱스를 지우고 외래키 칼럼 인덱스를 더한 뒤에도, 지운 인덱스가 맡던 조회와 cascade 삭제가 표 전체를
// 훑지 않는지 쿼리 계획으로 고정한다.

describe('인덱스 정리 (T-11-659)', () => {
  let ctx: TestD1;
  beforeAll(async () => {
    ctx = await createTestD1();
  });
  afterAll(async () => {
    await ctx.dispose();
  });
  const plan = async (sql: string) =>
    (
      await ctx.env.DB.prepare(`EXPLAIN QUERY PLAN ${sql}`).bind('x').all<{ detail: string }>()
    ).results
      .map((r) => r.detail)
      .join('\n');
  const names = async () =>
    new Set(
      (
        await ctx.env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all<{
          name: string;
        }>()
      ).results.map((r) => r.name),
    );

  it('중복 인덱스 3개는 없고 외래키 인덱스 5개가 있다', async () => {
    const n = await names();
    for (const gone of [
      'careers_profile_id_idx',
      'push_devices_profile_idx',
      'team_matches_away_created_idx',
    ])
      expect(n.has(gone)).toBe(false);
    for (const added of [
      'team_live_matches_home_team_idx',
      'team_live_matches_away_team_idx',
      'best11_slots_career_idx',
      'best11_changes_in_career_idx',
      'best11_changes_out_career_idx',
    ])
      expect(n.has(added)).toBe(true);
  });

  it('지운 인덱스가 맡던 조회는 복합 인덱스로 찾는다(표 전체 훑기 없음)', async () => {
    const cases = [
      'SELECT id FROM careers WHERE profile_id = ?',
      'SELECT updated_at FROM push_devices WHERE profile_id = ?',
      'SELECT id FROM team_matches WHERE away_team_id = ? ORDER BY created_at DESC',
    ];
    for (const sql of cases) {
      const p = await plan(sql);
      expect(p, sql).toMatch(/USING (COVERING )?INDEX/);
      expect(p, sql).not.toMatch(/^SCAN \w+$/m);
    }
  });

  it('외래키 cascade · set null이 찾는 칼럼에 인덱스를 쓴다', async () => {
    const cases: [string, string][] = [
      ['SELECT 1 FROM team_live_matches WHERE home_team_id = ?', 'team_live_matches_home_team_idx'],
      ['SELECT 1 FROM team_live_matches WHERE away_team_id = ?', 'team_live_matches_away_team_idx'],
      ['SELECT 1 FROM best11_slots WHERE career_id = ?', 'best11_slots_career_idx'],
      ['SELECT 1 FROM best11_changes WHERE in_career_id = ?', 'best11_changes_in_career_idx'],
      ['SELECT 1 FROM best11_changes WHERE out_career_id = ?', 'best11_changes_out_career_idx'],
    ];
    for (const [sql, idx] of cases) expect(await plan(sql), sql).toContain(idx);
  });
});
