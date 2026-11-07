import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unstable_splitSqlQuery as splitSqlQuery } from 'wrangler';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';

// DB 구조 점검(T-11-660 · T-11-661)에서 기존 데이터를 옮기는 마이그레이션을 실제 이전 행으로 검증한다. 앞 번호까지 적용 →
// 옛 표에 행을 넣고 → 나머지를 적용한 뒤 옮겨진 값을 본다.

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');
const files = readdirSync(DIR)
  .filter((n) => n.endsWith('.sql'))
  .sort();
const sqlOf = (names: string[]) =>
  names
    .flatMap((n) => splitSqlQuery(readFileSync(path.join(DIR, n), 'utf8')))
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
/** prefix(예: '0155')보다 앞 파일들 / 그 파일부터. */
const split = (prefix: string) => {
  const i = files.findIndex((n) => n.startsWith(prefix));
  if (i < 0) throw new Error(`no migration ${prefix}`);
  return [files.slice(0, i), files.slice(i)] as const;
};

const P = 'prf_legacy';
const T = '2026-11-07T00:00:00.000Z';

describe('데이터를 옮기는 마이그레이션', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1({ migrate: false });
  });
  afterEach(async () => {
    await ctx.dispose();
  });
  /** 그 시점 profiles 표의 필수 칼럼만 채운 프로필 한 줄(마이그레이션마다 칼럼이 달라서 표 정보로 만든다). */
  const profile = async () => {
    const cols = (
      await ctx.env.DB.prepare(
        'SELECT name, type FROM pragma_table_info(\'profiles\') WHERE "notnull" = 1 AND dflt_value IS NULL',
      ).all<{ name: string; type: string }>()
    ).results;
    const vals = cols.map((c) =>
      c.name === 'id' ? P : /INT|REAL/i.test(c.type) ? 0 : c.name.endsWith('_json') ? '{}' : T,
    );
    await ctx.env.DB.prepare(
      `INSERT INTO profiles (${cols.map((c) => c.name).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    )
      .bind(...vals)
      .run();
  };

  it('T-11-660 0155: 기존 자금 잔액마다 opening 기록 한 줄', async () => {
    const [before, after] = split('0155');
    await ctx.env.DB.exec(sqlOf(before));
    await profile();
    await ctx.env.DB.prepare(
      `INSERT INTO owner_funds (profile_id, balance, updated_at) VALUES (?, 1234, ?)`,
    )
      .bind(P, T)
      .run();
    await ctx.env.DB.exec(sqlOf(after));
    const rows = await ctx.env.DB.prepare(
      'SELECT profile_id, kind, delta, balance, ref FROM owner_fund_ledger',
    ).all();
    expect(rows.results).toEqual([
      { profile_id: P, kind: 'opening', delta: 1234, balance: 1234, ref: null },
    ]);
  });

  it('T-11-661 0156 · 0157: 칭호 진행도 칼럼 값을 metrics_json으로 옮기고 옛 표를 지운다', async () => {
    const [before, after] = split('0156');
    await ctx.env.DB.exec(sqlOf(before));
    await profile();
    const required = (
      await ctx.env.DB.prepare(
        'SELECT name FROM pragma_table_info(\'owner_title_progress\') WHERE "notnull" = 1 AND dflt_value IS NULL',
      ).all<{ name: string }>()
    ).results.map((r) => r.name);
    const legacy: Record<string, string | number> = Object.fromEntries(required.map((c) => [c, 0]));
    Object.assign(legacy, {
      profile_id: P,
      criteria_version: 5,
      preseason: 2,
      forwards: 3,
      enhance_tries: 7,
      updated_at: T,
    });
    const keys = Object.keys(legacy);
    await ctx.env.DB.prepare(
      `INSERT INTO owner_title_progress (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
    )
      .bind(...keys.map((k) => legacy[k]))
      .run();
    await ctx.env.DB.exec(sqlOf(after));
    const row = await ctx.env.DB.prepare(
      'SELECT criteria_version, metrics_json, updated_at FROM owner_title_metrics WHERE profile_id = ?',
    )
      .bind(P)
      .first<{ criteria_version: number; metrics_json: string; updated_at: string }>();
    expect(row).toMatchObject({ criteria_version: 5, updated_at: T });
    expect(JSON.parse(row!.metrics_json)).toMatchObject({
      preseason: 2,
      forwards: 3,
      enhanceTries: 7,
      midfield: 0,
    });
    const left = await ctx.env.DB.prepare(
      "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'owner_title_progress'",
    ).first<{ n: number }>();
    expect(left!.n).toBe(0);
  });
});
