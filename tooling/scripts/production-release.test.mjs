import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EXPECTED_TABLES, inspectCounts, inspectSchema } from './production-release.mjs';

describe('production release guards', () => {
  it('lists exactly the tables of the latest drizzle migration snapshot', () => {
    // 새 테이블을 만드는 마이그레이션 PR에서 이 목록을 함께 고치지 않으면 여기서 실패한다(배포 뒤가 아니라).
    const meta = new URL('../../apps/api/migrations/meta/', import.meta.url);
    const journal = JSON.parse(readFileSync(new URL('_journal.json', meta), 'utf8'));
    const idx = String(journal.entries.at(-1).idx).padStart(4, '0');
    const snapshot = JSON.parse(readFileSync(new URL(`${idx}_snapshot.json`, meta), 'utf8'));
    expect([...EXPECTED_TABLES].sort()).toEqual(Object.keys(snapshot.tables).sort());
  });

  it('passes when the production schema is exactly the expected post-0016 table set', () => {
    const result = inspectSchema([
      {
        results: EXPECTED_TABLES.map((name) => ({ name })),
      },
    ]);
    expect(result).toEqual({
      tableCount: EXPECTED_TABLES.length,
      tables: [...EXPECTED_TABLES].sort(),
      matchesExpected: true,
      missing: [],
      unexpected: [],
    });
  });

  it('flags a missing expected table', () => {
    const result = inspectSchema([
      { results: EXPECTED_TABLES.filter((name) => name !== 'sessions').map((name) => ({ name })) },
    ]);
    expect(result.matchesExpected).toBe(false);
    expect(result.missing).toEqual(['sessions']);
    expect(result.unexpected).toEqual([]);
  });

  it('ignores the wrangler d1_migrations history table', () => {
    const result = inspectSchema([
      { results: [...EXPECTED_TABLES, 'd1_migrations'].map((name) => ({ name })) },
    ]);
    expect(result.matchesExpected).toBe(true);
    expect(result.unexpected).toEqual([]);
  });

  it('flags a leftover game table (for example a dropped snapshots row)', () => {
    const result = inspectSchema([
      { results: [...EXPECTED_TABLES, 'snapshots'].map((name) => ({ name })) },
    ]);
    expect(result.matchesExpected).toBe(false);
    expect(result.missing).toEqual([]);
    expect(result.unexpected).toEqual(['snapshots']);
  });

  it('recognizes an empty production schema without treating it as an error', () => {
    const result = inspectSchema([{ results: [] }]);
    expect(result.tableCount).toBe(0);
    expect(result.matchesExpected).toBe(false);
    expect(result.missing).toEqual([...EXPECTED_TABLES].sort());
  });

  it('fails closed when Wrangler does not return a valid results envelope', () => {
    expect(() => inspectSchema({ success: true })).toThrow('results array');
    expect(() => inspectSchema({ success: false, errors: ['redacted'] })).toThrow('unsuccessful');
  });

  it('retains only aggregate table counts from D1 output', () => {
    expect(
      inspectCounts([
        { results: [{ table_name: 'profiles', row_count: 3 }] },
        { results: [{ table_name: 'sessions', row_count: 2 }] },
      ]),
    ).toEqual([
      { table: 'profiles', rows: 3 },
      { table: 'sessions', rows: 2 },
    ]);
  });
});
