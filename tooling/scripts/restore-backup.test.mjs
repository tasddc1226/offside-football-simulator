import { it, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
const script = new URL('./restore-backup.py', import.meta.url).pathname;
it('restores ordered decoded/gzip chunks, checks counts/FKs and refuses missing chunks or overwrite', () => {
  const dir = mkdtempSync(join(tmpdir(), 'offside-restore-test-'));
  try {
    writeFileSync(
      join(dir, '0001.sql'),
      'CREATE TABLE parent(id INTEGER PRIMARY KEY);\nCREATE TABLE child(id INTEGER REFERENCES parent(id));\nINSERT INTO parent VALUES(1);\n',
    );
    writeFileSync(join(dir, '0002.sql'), gzipSync('INSERT INTO child VALUES(1);\n'));
    const args = [
      '--source',
      dir,
      '--destination',
      join(dir, 'restored.sqlite'),
      '--chunks',
      '2',
      '--tables',
      '2',
      '--rows',
      '2',
    ];
    const result = JSON.parse(execFileSync('python3', [script, ...args], { encoding: 'utf8' }));
    expect(result).toMatchObject({ countsMatch: true, integrityOk: true, foreignKeyViolations: 0 });
    expect(spawnSync('python3', [script, ...args]).status).toBe(1);
    args[3] = join(dir, 'missing.sqlite');
    args[5] = '3';
    expect(spawnSync('python3', [script, ...args]).status).toBe(1);
    args[3] = join(dir, 'invalid.sqlite');
    args[5] = '2';
    writeFileSync(join(dir, '0002.sql'), 'INSERT INTO child VALUES(99);\n');
    const invalid = spawnSync('python3', [script, ...args], { encoding: 'utf8' });
    expect(invalid.status).toBe(1);
    expect(JSON.parse(invalid.stdout).foreignKeyViolations).toBe(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
it('T-11-777 accepts a row count between --min-rows and --rows when seal rows replace earlier ones', () => {
  const dir = mkdtempSync(join(tmpdir(), 'offside-restore-test-'));
  try {
    writeFileSync(
      join(dir, '0001.sql'),
      "CREATE TABLE parent(id INTEGER PRIMARY KEY, v TEXT);\nINSERT INTO parent VALUES(1, 'old');\n",
    );
    writeFileSync(
      join(dir, '0002.sql'),
      "INSERT OR REPLACE INTO parent VALUES(1, 'new');\nINSERT OR REPLACE INTO parent VALUES(2, 'late');\n",
    );
    const run = (name, extra) =>
      spawnSync(
        'python3',
        [
          script,
          '--source',
          dir,
          '--destination',
          join(dir, name),
          '--chunks',
          '2',
          '--tables',
          '1',
          '--rows',
          '3',
          ...extra,
        ],
        { encoding: 'utf8' },
      );
    // 조각에 적힌 행은 3개지만 하나는 바꿔 넣기라 복원한 행은 2개다.
    expect(run('exact.sqlite', []).status).toBe(1);
    const ranged = run('ranged.sqlite', ['--min-rows', '1']);
    expect(ranged.status).toBe(0);
    expect(JSON.parse(ranged.stdout)).toMatchObject({ rows: 2, countsMatch: true });
    expect(run('short.sqlite', ['--min-rows', '3']).status).toBe(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
it('T-11-814 removes children of parents deleted during the backup, reports tables, and refuses above the limit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'offside-restore-test-'));
  try {
    writeFileSync(
      join(dir, '0001.sql'),
      [
        'CREATE TABLE parent(id INTEGER PRIMARY KEY);',
        'CREATE TABLE child(id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id) ON DELETE CASCADE);',
        'CREATE TABLE grandchild(id INTEGER PRIMARY KEY, child_id INTEGER REFERENCES child(id) ON DELETE CASCADE);',
        'CREATE TABLE note(id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id) ON DELETE SET NULL);',
        'CREATE TABLE strict(id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id));',
        'INSERT INTO parent VALUES(1);',
        // 부모 9는 백업 도중 지워졌다: 자식 · 손자는 지우고, SET NULL 참조는 비운다.
        'INSERT INTO child VALUES(1, 1);',
        'INSERT INTO child VALUES(2, 9);',
        'INSERT INTO grandchild VALUES(1, 2);',
        'INSERT INTO note VALUES(1, 9);',
        '',
      ].join('\n'),
    );
    const run = (name, extra) =>
      spawnSync(
        'python3',
        [
          script,
          '--source',
          dir,
          '--destination',
          join(dir, name),
          '--chunks',
          '1',
          '--tables',
          '5',
          '--rows',
          '5',
          '--min-rows',
          '5',
          ...extra,
        ],
        { encoding: 'utf8' },
      );
    const plain = run('plain.sqlite', []);
    expect(plain.status).toBe(1);
    expect(JSON.parse(plain.stdout)).toMatchObject({
      // 손자는 자식이 아직 있어 처음에는 위반이 아니다. 자식을 지운 뒤 다음 바퀴에서 잡힌다.
      foreignKeyViolations: 2,
      foreignKeyTables: { 'child -> parent': 1, 'note -> parent': 1 },
      orphansRepaired: 0,
    });
    const repaired = run('repaired.sqlite', ['--repair-orphans', '10']);
    expect(repaired.status).toBe(0);
    expect(JSON.parse(repaired.stdout)).toMatchObject({
      rows: 3,
      countsMatch: true,
      foreignKeyViolations: 0,
      orphansRepaired: 3,
      orphanTables: { child: 1, grandchild: 1, note: 1 },
      orphanLimitExceeded: false,
    });
    // 상한을 넘으면 아무것도 고치지 않고 실패로 둔다(부모가 빠진 것일 수 있다).
    const over = run('over.sqlite', ['--repair-orphans', '1']);
    expect(over.status).toBe(1);
    expect(JSON.parse(over.stdout)).toMatchObject({
      rows: 5,
      foreignKeyViolations: 2,
      orphansRepaired: 0,
      orphanLimitExceeded: true,
    });
    // CASCADE · SET NULL이 아닌 외래 키는 고치지 않는다.
    writeFileSync(
      join(dir, '0001.sql'),
      readFileSync(join(dir, '0001.sql'), 'utf8') + 'INSERT INTO strict VALUES(1, 9);\n',
    );
    const strict = run('strict.sqlite', ['--repair-orphans', '10']);
    expect(strict.status).toBe(1);
    expect(JSON.parse(strict.stdout).foreignKeyTables).toEqual({ 'strict -> parent': 1 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
