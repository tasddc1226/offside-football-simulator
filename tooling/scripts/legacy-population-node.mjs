import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const root = resolve(new URL('../..', import.meta.url).pathname);
const script = resolve(root, 'tooling/scripts/legacy-population.ts');
const tsx = resolve(root, 'node_modules/.pnpm/node_modules/.bin/tsx');
const positions = ['GK', 'DF', 'MF', 'FW'];

function value(args, name, fallback) {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
}

function run(command, args, envExtra = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, ...envExtra },
    });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolvePromise() : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}

async function buildAccelerated(persistentDirectory) {
  const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
  const { build } = require('esbuild');
  const directory =
    persistentDirectory ?? (await mkdtemp(join(tmpdir(), 'offside-population-bundle-')));
  await mkdir(directory, { recursive: true });
  const output = join(directory, 'legacy-population.mjs');
  const manifestPath = join(directory, 'bundle-manifest.json');
  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const hash = createHash('sha256')
      .update(await readFile(output))
      .digest('hex');
    if (manifest.hash !== hash) throw new Error('Saved population bundle checksum mismatch');
    return { path: output, hash };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const shim = resolve(root, 'tooling/scripts/node-hash.ts');
  const domainHash = resolve(root, 'packages/domain/src/hash.ts');
  let aliasHits = 0;
  await build({
    entryPoints: [script],
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    plugins: [
      {
        name: 'node-hash-alias',
        setup(buildApi) {
          buildApi.onResolve({ filter: /hash\.(?:js|ts)$/ }, (args) => {
            const resolved = resolve(args.resolveDir, args.path).replace(/\.js$/, '.ts');
            if (resolved !== domainHash) return undefined;
            aliasHits += 1;
            return { path: shim };
          });
        },
      },
    ],
  });
  if (aliasHits === 0)
    throw new Error('Node hash alias was not applied; refusing an unaccelerated bundle');
  const bundleHash = createHash('sha256')
    .update(await readFile(output))
    .digest('hex');
  await writeFile(manifestPath, JSON.stringify({ hash: bundleHash, nodeVersion: process.version }));
  return { path: output, hash: bundleHash };
}

async function runPartitioned(command, baseArgs, directory, bundleHash) {
  const started = performance.now();
  const output = value(baseArgs, '--out', 'artifacts/legacy-population.json');
  const cleanArgs = baseArgs.filter(
    (arg, index) =>
      arg !== '--checkpoint' &&
      arg !== '--out' &&
      baseArgs[index - 1] !== '--checkpoint' &&
      baseArgs[index - 1] !== '--out',
  );
  const env = bundleHash === undefined ? {} : { LEGACY_POPULATION_BUNDLE_HASH: bundleHash };
  await Promise.all(
    positions.map((position) =>
      run(
        command,
        [
          ...cleanArgs,
          '--__population-run',
          '--position',
          position,
          '--checkpoint',
          join(directory, `${position}.checkpoint.json`),
        ],
        env,
      ),
    ),
  );
  await run(
    command,
    [
      ...cleanArgs,
      '--__population-run',
      '--merge-checkpoints',
      positions.map((position) => join(directory, `${position}.checkpoint.json`)).join(','),
      '--out',
      output,
    ],
    env,
  );
  return { merged: output, elapsedMs: performance.now() - started };
}

async function verify() {
  const directory = await mkdtemp(join(tmpdir(), 'offside-population-verify-'));
  const normal = join(directory, 'normal.json');
  const acceleratedOutput = join(directory, 'accelerated.json');
  const base = ['--count', '20', '--seasons', '20', '--smoke'];
  const normalStarted = performance.now();
  await run(tsx, [
    script,
    ...base,
    '--checkpoint',
    join(directory, 'normal.checkpoint.json'),
    '--out',
    normal,
  ]);
  const normalMs = performance.now() - normalStarted;
  const acceleratedBundle = await buildAccelerated();
  const accelerated = await runPartitioned(
    process.execPath,
    [acceleratedBundle.path, ...base, '--out', acceleratedOutput],
    directory,
    acceleratedBundle.hash,
  );
  const normalReport = JSON.parse(await readFile(normal, 'utf8'));
  const acceleratedReport = JSON.parse(await readFile(acceleratedOutput, 'utf8'));
  const normalize = (report) =>
    report.groups.map((group) => ({ position: group.position, rows: group.rows }));
  if (JSON.stringify(normalize(normalReport)) !== JSON.stringify(normalize(acceleratedReport)))
    throw new Error('normal and accelerated population rows differ');
  const stats = Object.fromEntries(
    normalReport.groups.map((group) => {
      const scores = group.rows.map((row) => row.score).sort((a, b) => a - b);
      const bandCounts = Object.fromEntries(
        group.rows.reduce(
          (counts, row) => counts.set(row.bandId, (counts.get(row.bandId) ?? 0) + 1),
          new Map(),
        ),
      );
      return [
        group.position,
        {
          min: scores[0],
          median: scores[Math.floor(scores.length / 2)],
          max: scores.at(-1),
          bandCounts,
        },
      ];
    }),
  );
  const vectors = {
    '': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    abc: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    안녕하세요: '2c68318e352971113645cbc72861e1ec23f48d5baa5f9b405fed9dddca893eb4',
    '⚽️': '29e9bc41871f12fd1b848ebbc49f96d5b137ae58090cb7452f9d60fd2f574216',
    '\ud800': '91a681b998555fb475479817b126c94e57e52011fa1842c5d188795a4a05226b',
  };
  function utf8Encode(value) {
    const bytes = [];
    for (let index = 0; index < value.length; index += 1) {
      const codePoint = value.codePointAt(index);
      if (codePoint > 0xffff) index += 1;
      if (codePoint <= 0x7f) bytes.push(codePoint);
      else if (codePoint <= 0x7ff) bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
      else if (codePoint <= 0xffff)
        bytes.push(
          0xe0 | (codePoint >> 12),
          0x80 | ((codePoint >> 6) & 0x3f),
          0x80 | (codePoint & 0x3f),
        );
      else
        bytes.push(
          0xf0 | (codePoint >> 18),
          0x80 | ((codePoint >> 12) & 0x3f),
          0x80 | ((codePoint >> 6) & 0x3f),
          0x80 | (codePoint & 0x3f),
        );
    }
    return Buffer.from(bytes);
  }
  for (const [input, expected] of Object.entries(vectors)) {
    if (createHash('sha256').update(utf8Encode(input)).digest('hex') !== expected)
      throw new Error(`SHA-256/UTF-8 vector failed: ${JSON.stringify(input)}`);
  }
  console.log(
    JSON.stringify(
      {
        verifiedCareers: 80,
        normalPath: normal,
        acceleratedPath: acceleratedOutput,
        acceleratedBundleHash: acceleratedBundle.hash,
        normalMs,
        acceleratedMs: accelerated.elapsedMs,
        speedup: normalMs / accelerated.elapsedMs,
        stats,
      },
      null,
      2,
    ),
  );
}

const args = process.argv.slice(2);
if (args.includes('--verify')) {
  await verify();
} else if (args.includes('--normal')) {
  await run(tsx, [script, ...args.filter((arg) => arg !== '--normal')]);
} else {
  const directory = resolve(
    value(args, '--work-dir', await mkdtemp(join(tmpdir(), 'offside-population-run-'))),
  );
  const acceleratedBundle = await buildAccelerated(directory);
  console.log(
    JSON.stringify({
      workDirectory: directory,
      bundleHash: acceleratedBundle.hash,
      concurrency: 4,
    }),
  );
  const { merged, elapsedMs } = await runPartitioned(
    process.execPath,
    [acceleratedBundle.path, ...args],
    directory,
    acceleratedBundle.hash,
  );
  console.log(
    JSON.stringify(
      {
        merged,
        acceleratedBundleHash: acceleratedBundle.hash,
        elapsedMs,
        concurrency: 4,
        hashMode: 'node-crypto-equivalent',
      },
      null,
      2,
    ),
  );
}
