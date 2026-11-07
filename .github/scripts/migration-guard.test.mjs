import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isMigrationSql, judge, main, scanMigration, statements } from './migration-guard.mjs';

const scan = (sql, file = 'apps/api/migrations/9999_x.sql') => scanMigration(file, sql);

test('11-08 장애 마이그레이션(0159)은 두 규칙 모두에 걸린다', () => {
  const file = 'apps/api/migrations/0159_hof_partial.sql';
  const r = judge([
    scanMigration(file, readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')),
  ]);
  assert.equal(r.errors.length, 2);
  assert.match(r.errors[0], /14개/);
  assert.match(r.errors[1], /careers_hof_goals_idx/);
});

test('큰 표 인덱스 2개까지는 통과하고 3개면 실패한다', () => {
  const idx = (n, t = 'careers') =>
    `CREATE INDEX \`i${n}\` ON \`${t}\` (\`a\`);--> statement-breakpoint\n`;
  assert.deepEqual(judge([scan(idx(1) + idx(2))]).errors, []);
  assert.equal(judge([scan(idx(1) + idx(2) + idx(3))]).errors.length, 1);
  // 여러 파일을 합쳐 센다.
  assert.equal(
    judge([scan(idx(1) + idx(2)), scan(idx(3), 'apps/api/migrations/9998_y.sql')]).errors.length,
    1,
  );
});

test('작은 표 인덱스는 세지 않는다', () => {
  const sql = [1, 2, 3, 4].map((n) => `CREATE INDEX i${n} ON owner_items (qty);`).join('\n');
  assert.deepEqual(judge([scan(sql)]).errors, []);
});

test('큰 표 재생성 · 대량 UPDATE도 무거운 작업으로 센다', () => {
  const sql = `CREATE TABLE \`__new_cards\` (id text);
INSERT INTO \`__new_cards\` SELECT id FROM cards;
UPDATE careers SET hidden = 0;
UPDATE OR IGNORE \`team_matches\` SET x = 1;`;
  assert.equal(scan(sql).heavy.length, 3);
});

test('같은 이름 DROP 뒤 CREATE는 작은 표여도 실패하고, 새 이름이면 통과한다', () => {
  assert.equal(
    judge([
      scan('DROP INDEX IF EXISTS `a_idx`; CREATE UNIQUE INDEX IF NOT EXISTS `a_idx` ON small (x);'),
    ]).errors.length,
    1,
  );
  assert.deepEqual(judge([scan('DROP INDEX a_idx; CREATE INDEX a2_idx ON small (x);')]).errors, []);
});

test('allow 주석이 있는 파일은 경고만 한다', () => {
  const sql = `-- migration-guard: allow 11-09 04시 배포
${[1, 2, 3].map((n) => `CREATE INDEX i${n} ON careers (a);`).join('\n')}`;
  const r = judge([scan(sql)]);
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 1);
  // 이유가 없으면 허용하지 않는다.
  assert.equal(scan('-- migration-guard: allow\nSELECT 1;').allowed, false);
});

test('주석 안의 CREATE INDEX는 세지 않는다', () => {
  assert.deepEqual(statements('-- CREATE INDEX x ON careers (a);\nSELECT 1;'), ['SELECT 1']);
});

test('마이그레이션 경로만 고른다', () => {
  assert.equal(isMigrationSql('apps/api/migrations/0160_x.sql'), true);
  assert.equal(isMigrationSql('apps/api/migrations-ops/0001_x.sql'), true);
  assert.equal(isMigrationSql('apps/api/migrations/meta/0160_snapshot.json'), false);
  assert.equal(isMigrationSql('docs/x.sql'), false);
});

test('main은 새로 더한 마이그레이션만 읽고 결과를 종료 코드로 낸다', () => {
  const base = 'a'.repeat(40);
  const head = 'b'.repeat(40);
  const quiet = { log() {}, warn() {}, error() {} };
  const exec = (files) => (_cmd, args) => (args[0] === 'diff' ? files.join('\0') : '');
  const bad = [1, 2, 3].map((n) => `CREATE INDEX i${n} ON careers (a);`).join('\n');
  const env = { CI_BASE_SHA: base, CI_HEAD_SHA: head };
  assert.equal(
    main(env, exec(['apps/api/migrations/0200_x.sql']), () => bad, quiet),
    1,
  );
  assert.equal(
    main(env, exec(['apps/api/src/x.ts']), () => bad, quiet),
    0,
  );
  assert.equal(
    main({}, exec([]), () => '', quiet),
    0,
  );
});
