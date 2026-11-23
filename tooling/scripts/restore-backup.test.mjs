import { it, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
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
