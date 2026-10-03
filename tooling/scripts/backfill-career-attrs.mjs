// One-off, offline reconstruction of display-only attributes for legacy retired careers.
// Never write peak_profile: that would change position ratings and match results.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const METHOD = 'peer-offset-median-v1';
export const ATTRS = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];
const POSITIONS = ['FW', 'MF', 'DF', 'GK'];
const MIN_PEERS = 8;
const quote = (v) => `'${String(v).replaceAll("'", "''")}'`;

export function readAttrs(raw) {
  try {
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return p &&
      ATTRS.every((k) => Number.isInteger(p.attrs?.[k]) && p.attrs[k] >= 0 && p.attrs[k] <= 99)
      ? Object.fromEntries(ATTRS.map((k) => [k, p.attrs[k]]))
      : null;
  } catch {
    return null;
  }
}

const validPeak = (r) =>
  POSITIONS.includes(r.pos) && Number.isInteger(r.peak) && r.peak >= 0 && r.peak <= 99;
const median = (xs) => {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export function estimateAttrs(row, references) {
  if (!validPeak(row)) return null;
  const samePos = references.filter((r) => r.pos === row.pos);
  const pools = [
    ['position-type-detail', samePos.filter((r) => r.type === row.type && r.dpos === row.dpos)],
    ['position-type', samePos.filter((r) => r.type === row.type)],
    ...(row.dpos ? [['position-detail', samePos.filter((r) => r.dpos === row.dpos)]] : []),
    ['position', samePos],
  ];
  const pool = pools.find(([, peers]) => peers.length >= MIN_PEERS);
  if (!pool) return null;
  const near = pool[1].filter((r) => Math.abs(r.peak - row.peak) <= 5);
  const peers = near.length >= MIN_PEERS ? near : pool[1];
  const attrs = Object.fromEntries(
    ATTRS.map((key) => [
      key,
      Math.max(
        0,
        Math.min(99, Math.round(row.peak + median(peers.map((r) => r.attrs[key] - r.peak)))),
      ),
    ]),
  );
  return {
    v: 1,
    source: 'estimated',
    method: METHOD,
    attrs,
    cohort: pool[0] + (peers === near ? '-near-ovr' : ''),
    samples: peers.length,
  };
}

/** Preserve every original profile and every previous backfill; no random variation or user names. */
export function planBackfill(rows) {
  const references = rows.flatMap((r) => {
    const attrs = readAttrs(r.peak_profile);
    return attrs && validPeak(r) ? [{ ...r, attrs }] : [];
  });
  const changes = [];
  const summary = {
    retired: rows.length,
    referenceProfiles: references.length,
    originalPreserved: 0,
    previousBackfillPreserved: 0,
    invalidOriginal: 0,
    insufficientReference: 0,
    invalidPeak: 0,
    estimated: 0,
    cohorts: {},
  };
  for (const row of rows) {
    if (row.peak_profile != null) {
      summary[readAttrs(row.peak_profile) ? 'originalPreserved' : 'invalidOriginal']++;
      continue;
    }
    if (row.card_attrs_json != null) {
      summary.previousBackfillPreserved++;
      continue;
    }
    if (!validPeak(row)) {
      summary.invalidPeak++;
      continue;
    }
    const estimate = estimateAttrs(row, references);
    if (!estimate) {
      summary.insufficientReference++;
      continue;
    }
    changes.push({ row, value: JSON.stringify(estimate) });
    summary.estimated++;
    summary.cohorts[estimate.cohort] = (summary.cohorts[estimate.cohort] ?? 0) + 1;
  }
  return { changes, summary };
}

export function updateSql({ row, value }) {
  return `UPDATE careers SET card_attrs_json=${quote(value)} WHERE id=${quote(row.id)} AND status='retired' AND peak_profile IS NULL AND card_attrs_json IS NULL AND peak=${row.peak} AND pos=${quote(row.pos)} AND type=${quote(row.type)} AND ${row.dpos == null ? 'dpos IS NULL' : `dpos=${quote(row.dpos)}`};`;
}

export function rollbackSql({ row, value }) {
  return `UPDATE careers SET card_attrs_json=NULL WHERE id=${quote(row.id)} AND card_attrs_json=${quote(value)};`;
}

export function dbCommandArgs(env, sql, file) {
  if (env !== 'local' && file)
    throw new Error('Remote backfills must use query commands, not SQL imports');
  const args = ['--filter', '@offside/api', 'exec', 'wrangler', 'd1', 'execute', `offside-${env}`];
  args.push(
    ...(env === 'local'
      ? ['--local', '--persist-to', '.wrangler/state']
      : ['--remote', '--env', env]),
  );
  args.push('--json', ...(file ? ['--file', file, '--yes'] : ['--command', sql]));
  return args;
}

function dbCommand(env, sql, file) {
  const args = dbCommandArgs(env, sql, file);
  const result = spawnSync('pnpm', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0)
    throw new Error(`Wrangler failed (${result.status}). ${result.stderr.trim()}`);
  const parsed = JSON.parse(result.stdout);
  if (!Array.isArray(parsed) || parsed.some((r) => r.success === false))
    throw new Error('D1 query failed');
  return parsed;
}

function readRows(env, hasColumn) {
  return dbCommand(
    env,
    `SELECT id,pos,type,dpos,peak,peak_profile,status,retired_at,retire_age,legend_score,apps,goals,assists,trophies,awards,caps,ballon,${hasColumn ? 'card_attrs_json' : 'NULL AS card_attrs_json'} FROM careers WHERE status='retired' ORDER BY id`,
  )[0].results;
}

const PROTECTED_FIELDS = [
  'id',
  'pos',
  'type',
  'dpos',
  'peak',
  'peak_profile',
  'status',
  'retired_at',
  'retire_age',
  'legend_score',
  'apps',
  'goals',
  'assists',
  'trophies',
  'awards',
  'caps',
  'ballon',
];
export const protectedHash = (rows) =>
  createHash('sha256')
    .update(JSON.stringify(rows.map((r) => PROTECTED_FIELDS.map((k) => r[k]))))
    .digest('hex');

export async function main(argv = process.argv.slice(2)) {
  const opts = { env: 'local', apply: false, out: null, confirmation: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--env') opts.env = argv[++i];
    else if (argv[i] === '--apply') opts.apply = true;
    else if (argv[i] === '--dry-run') opts.apply = false;
    else if (argv[i] === '--out') opts.out = argv[++i];
    else if (argv[i] === '--confirm-production') opts.confirmation = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!['local', 'staging', 'production'].includes(opts.env))
    throw new Error('Invalid environment');
  if (opts.apply && opts.env === 'production' && opts.confirmation !== 'offside-production') {
    throw new Error('Production apply requires --confirm-production offside-production');
  }
  const out = path.resolve(
    opts.out ??
      path.join(
        ROOT,
        '.local-dev/career-attrs-backfill',
        `${opts.env}-${new Date().toISOString().replaceAll(':', '-')}`,
      ),
  );
  await mkdir(out, { recursive: true, mode: 0o700 });
  if ((await readdir(out)).length)
    throw new Error('Use an empty output directory to preserve previous rollback files');
  const columns = dbCommand(opts.env, 'PRAGMA table_info(careers)')[0].results;
  const hasColumn = columns.some((c) => c.name === 'card_attrs_json');
  if (opts.apply && !hasColumn)
    throw new Error('Apply the card_attrs_json migration before backfilling');
  const rows = readRows(opts.env, hasColumn);
  const { changes, summary } = planBackfill(rows);
  const report = {
    environment: opts.env,
    method: METHOD,
    mode: opts.apply ? 'apply' : 'dry-run',
    migrationRequired: !hasColumn,
    ...summary,
  };
  const save = (name, data) => writeFile(path.join(out, name), data, { mode: 0o600 });
  await save('before.json', JSON.stringify(rows));
  await save('apply.sql', changes.map(updateSql).join('\n'));
  await save('rollback.sql', changes.map(rollbackSql).join('\n'));
  await save('report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!opts.apply) return report;
  // Remote query batches avoid the import workflow; files remain private audit artifacts.
  const batchSize = opts.env === 'local' ? 200 : 100;
  for (let i = 0; i < changes.length; i += batchSize) {
    const name = `batch-${String(i / batchSize).padStart(4, '0')}.sql`;
    const sql = changes
      .slice(i, i + batchSize)
      .map(updateSql)
      .join('\n');
    await save(name, sql);
    dbCommand(opts.env, sql, opts.env === 'local' ? path.join(out, name) : undefined);
    console.log(`Applied batch ${i / batchSize + 1}/${Math.ceil(changes.length / batchSize)}`);
  }
  const after = readRows(opts.env, true);
  const oldIds = new Set(rows.map((r) => r.id));
  if (protectedHash(rows) !== protectedHash(after.filter((r) => oldIds.has(r.id)))) {
    throw new Error(
      'Original profile or career metadata changed during backfill; inspect before.json',
    );
  }
  const byId = new Map(after.map((r) => [r.id, r]));
  report.applied = changes.filter((c) => byId.get(c.row.id)?.card_attrs_json === c.value).length;
  report.remaining = planBackfill(after).summary;
  report.originalDataUnchanged = true;
  await save('report.json', JSON.stringify(report, null, 2));
  if (report.applied !== changes.length)
    throw new Error('Some guarded writes did not apply; inspect report.json');
  console.log(
    JSON.stringify(
      { applied: report.applied, remaining: report.remaining, originalDataUnchanged: true },
      null,
      2,
    ),
  );
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
