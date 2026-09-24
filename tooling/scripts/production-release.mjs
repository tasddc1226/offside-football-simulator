import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// T-9-001c: migration 0015가 모든 게임 테이블(careers/snapshots/service_seasons 등)을 드롭한 뒤
// 운영 D1에 남아야 하는 테이블. 이 목록 밖의 테이블이 나타나거나 이 목록의 테이블이 없으면
// preflight/deploy 모두 실패로 취급해야 한다(사람이 직접 스키마를 검토해야 하는 신호).
export const EXPECTED_TABLES = Object.freeze([
  'audit_log',
  'auth_attempts',
  'idempotency',
  'profiles',
  'sessions',
]);

// wrangler가 적용한 migration 이력을 기록하는 내부 테이블. 앱 스키마가 아니므로 비교에서 뺀다.
const WRANGLER_MIGRATIONS_TABLE = 'd1_migrations';

function rowsFromWrangler(value) {
  const blocks = Array.isArray(value) ? value : [value];
  if (blocks.length === 0) throw new Error('Wrangler returned an empty response envelope.');
  return blocks.flatMap((block) => {
    if (block?.success === false) throw new Error('Wrangler reported an unsuccessful D1 query.');
    if (Array.isArray(block?.results)) return block.results;
    if (
      Array.isArray(block?.result) &&
      block.result.every((entry) => Array.isArray(entry?.results))
    ) {
      return block.result.flatMap((entry) => entry.results);
    }
    throw new Error('Wrangler response did not contain a D1 results array.');
  });
}

/**
 * `SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'`
 * 결과를 검사한다. wrangler의 d1_migrations를 뺀 나머지가 정확히 EXPECTED_TABLES와 같아야 통과다(순서 무관).
 */
export function inspectSchema(json) {
  const tables = rowsFromWrangler(json)
    .map((row) => row.name)
    .filter((name) => typeof name === 'string' && name !== WRANGLER_MIGRATIONS_TABLE)
    .sort();
  const expected = [...EXPECTED_TABLES].sort();
  const missing = expected.filter((name) => !tables.includes(name));
  const unexpected = tables.filter((name) => !expected.includes(name));
  return {
    tableCount: tables.length,
    tables,
    matchesExpected: missing.length === 0 && unexpected.length === 0,
    missing,
    unexpected,
  };
}

/** 집계 count 쿼리(`SELECT '<table>' table_name, COUNT(*) row_count FROM <table>; ...`) 결과를 정리한다. */
export function inspectCounts(json) {
  return rowsFromWrangler(json).map((row) => ({
    table: String(row.table_name),
    rows: Number(row.row_count),
  }));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
function appendSummary(lines) {
  if (process.env.GITHUB_STEP_SUMMARY)
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, { flag: 'a' });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, path] = process.argv.slice(2);
  if (command === 'schema') {
    // 순수 보고용이다 — 실패시키지 않는다. migration 0015 적용 전에는 게임 테이블이 여전히 남아
    // 있어 matchesExpected가 자연스럽게 false다(첫 cutover의 preflight가 그 상태를 보여줘야 한다).
    // 워크플로가 migration 뒤에만 출력값을 `true`와 엄격 비교해 실패시킨다.
    const result = inspectSchema(readJson(path));
    appendSummary([
      '### Production D1 schema',
      `- schema tables: ${result.tableCount} (${result.tables.join(', ') || 'none'})`,
      `- matches expected post-0015 schema: ${result.matchesExpected}`,
      ...(result.missing.length ? [`- missing: ${result.missing.join(', ')}`] : []),
      ...(result.unexpected.length ? [`- unexpected: ${result.unexpected.join(', ')}`] : []),
    ]);
    process.stdout.write(result.matchesExpected ? 'true' : 'false');
  } else if (command === 'bookmark') {
    const value = readJson(path);
    const findBookmark = (candidate) => {
      if (!candidate || typeof candidate !== 'object') return null;
      for (const [key, child] of Object.entries(candidate)) {
        if (key.toLowerCase().includes('bookmark') && typeof child === 'string') return child;
        const nested = findBookmark(child);
        if (nested) return nested;
      }
      return null;
    };
    const bookmark = findBookmark(value);
    if (!bookmark) throw new Error('Wrangler did not return a Time Travel bookmark.');
    appendSummary(['### D1 recovery point', `- bookmark: \`${bookmark}\``]);
  } else if (command === 'counts') {
    const counts = inspectCounts(readJson(path));
    appendSummary([
      '### Production D1 aggregate counts',
      ...counts.map((entry) => `- ${entry.table}: ${entry.rows}`),
    ]);
  } else {
    throw new Error('Usage: production-release.mjs bookmark|schema|counts <wrangler-json>');
  }
}
