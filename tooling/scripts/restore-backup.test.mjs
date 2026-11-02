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
