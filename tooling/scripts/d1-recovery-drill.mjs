import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { client, preflight, capture, EXPORT_ACK } from './d1-snapshot.mjs';

const PROTECTED = new Set([
  '2cfe462c-204e-4842-805c-5840fc9b1758',
  '37688e3f-b905-4240-abdb-e23e778dfad9',
  'c6edc33e-e879-4ccf-9fc1-807aeb61561d',
]);
/** There is deliberately no switch to override this restriction. */
export function requireDrillDatabase(id, name) {
  if (PROTECTED.has(id) || !/^offside-recovery-drill-[a-zA-Z0-9_-]+$/.test(name ?? ''))
    throw new Error('Recovery drills require an isolated disposable database');
}
export async function drill({ env = process.env, id, expectedName, output }, fetcher = fetch) {
  requireDrillDatabase(id, expectedName);
  const api = client(env, fetcher);
  await preflight(api, id, expectedName); // Verify actual remote identity before any SQL/restore.
  const base = `/d1/database/${id}`;
  const existing = await api(`${base}/query`, {
    sql: "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%'",
  });
  if (!Array.isArray(existing) || existing.some((b) => b.success !== true || b.results.length))
    throw new Error('Drill database must be empty');
  await mkdir(output, { mode: 0o700 });
  const query = async (sql) => {
    const blocks = await api(`${base}/query`, { sql });
    if (!Array.isArray(blocks) || blocks.some((b) => b.success !== true))
      throw new Error('Drill query failed');
    return blocks;
  };
  await query(
    'CREATE TABLE parent(id INTEGER PRIMARY KEY, balance INTEGER NOT NULL); CREATE TABLE child(id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id), amount INTEGER NOT NULL); INSERT INTO parent VALUES(1,10); INSERT INTO child VALUES(1,1,10);',
  );
  const before = await api(`${base}/time_travel/bookmark`);
  await query('UPDATE parent SET balance=20; UPDATE child SET amount=20;');
  const changed = await query('SELECT balance FROM parent');
  if (changed[0]?.results?.[0]?.balance !== 20) throw new Error('Drill mutation not observed');
  await api(
    `${base}/time_travel/restore?bookmark=${encodeURIComponent(before.bookmark)}`,
    undefined,
    'POST',
  );
  const restored = await query('SELECT balance FROM parent');
  if (restored[0]?.results?.[0]?.balance !== 10) throw new Error('Time Travel roundtrip failed');
  const result = await capture(
    { env, id, expectedName, output: join(output, 'snapshot'), confirm: EXPORT_ACK(id) },
    fetcher,
  );
  const local = join(output, 'snapshot', 'packed', 'manifest.json');
  const manifest = JSON.parse(await readFile(local, 'utf8'));
  // Show that the verified artifact remains the old snapshot even after new live writes.
  await query('UPDATE parent SET balance=99; UPDATE child SET amount=99;');
  const code = `import sys,sqlite3,importlib.util,json; from pathlib import Path
p=Path(sys.argv[1]); spec=importlib.util.spec_from_file_location('s',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
r=m.verify(sys.argv[2],sys.argv[3]);c=sqlite3.connect(sys.argv[3]);assert c.execute('SELECT balance FROM parent').fetchone()[0]==10;assert c.execute('SELECT amount FROM child').fetchone()[0]==10;print(json.dumps(r))`;
  execFileSync(
    'python3',
    [
      '-c',
      code,
      new URL('./snapshot-backup.py', import.meta.url).pathname,
      join(output, 'snapshot', 'packed', 'roundtrip'),
      join(output, 'point-in-time.sqlite'),
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return {
    databaseId: id,
    databaseName: expectedName,
    timeTravelRestored: true,
    r2RoundtripVerified: true,
    independentSnapshotPreserved: true,
    tables: manifest.tables,
    rows: manifest.rows,
    prefix: result.prefix,
    exportMs: result.exportMs,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({
    options: {
      'database-id': { type: 'string' },
      'expected-name': { type: 'string' },
      output: { type: 'string' },
    },
  });
  drill({ id: values['database-id'], expectedName: values['expected-name'], output: values.output })
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch(() => {
      console.error(
        'Isolated recovery drill failed. Raw SQL, signed URLs and credentials suppressed.',
      );
      process.exitCode = 1;
    });
}
