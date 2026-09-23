// T-9-001c: simulate.ts가 쓴 careers-<policy>.csv를 reference/<policy>-v4.json의 밸런스 기준선과
// 비교한다. simulate.ts/analyze.ts는 손대지 않는다 — 이 스크립트는 그 산출물만 읽는 별도 도구다.
// 실행: tsx check-parity.mjs <tag> [policy] [referenceFile]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOLERANCES = {
  peakP10: 2,
  peakP50: 2,
  peakP90: 2,
  corrPotPeak: 0.03,
  europeShare: 2,
  plShare: 2,
  cappedShare: 2,
  ballonWinShare: 0.3,
  retireAgeP50: 1,
};

function readCsv(csvPath) {
  const lines = fs.readFileSync(csvPath, 'utf8').split('\n');
  const cols = lines[0].split(',');
  return lines
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const values = line.split(',');
      const row = {};
      cols.forEach((c, i) => {
        const raw = values[i];
        row[c] = raw === '' || Number.isNaN(+raw) ? raw : +raw;
      });
      return row;
    });
}

function quantile(values, p) {
  const sorted = values.filter((x) => x !== '' && x !== undefined).sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * p)];
}

function pearson(rows, a, b) {
  const x = rows.map((r) => r[a]);
  const y = rows.map((r) => r[b]);
  const n = rows.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sx += (x[i] - mx) ** 2;
    sy += (y[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sx * sy);
}

function share(rows, predicate) {
  return (rows.filter(predicate).length / rows.length) * 100;
}

export function computeMetrics(rows) {
  return {
    peakP10: quantile(rows.map((r) => r.peak), 0.1),
    peakP50: quantile(rows.map((r) => r.peak), 0.5),
    peakP90: quantile(rows.map((r) => r.peak), 0.9),
    corrPotPeak: pearson(rows, 'pot', 'peak'),
    europeShare: share(rows, (r) => r.maxTier >= 4),
    plShare: share(rows, (r) => r.maxTier === 8),
    cappedShare: share(rows, (r) => r.caps > 0),
    ballonWinShare: share(rows, (r) => r.ballon > 0),
    retireAgeP50: quantile(rows.map((r) => r.retireAge), 0.5),
  };
}

export function compareMetrics(actual, expected, tolerances = TOLERANCES) {
  const results = Object.keys(expected).map((key) => {
    const tol = tolerances[key] ?? 0;
    const diff = Math.abs(actual[key] - expected[key]);
    return { key, actual: actual[key], expected: expected[key], tolerance: tol, diff, ok: diff <= tol };
  });
  return { ok: results.every((r) => r.ok), results };
}

function main() {
  const [tag, policy = 'random', referenceFile] = process.argv.slice(2);
  if (!tag) {
    console.error('Usage: check-parity.mjs <tag> [policy=random] [referenceFile]');
    process.exitCode = 1;
    return;
  }
  const csvPath = path.join(__dirname, 'results', tag, `careers-${policy}.csv`);
  const refPath = referenceFile
    ? path.resolve(referenceFile)
    : path.join(__dirname, 'reference', `${policy}-v4.json`);

  const rows = readCsv(csvPath);
  const reference = JSON.parse(fs.readFileSync(refPath, 'utf8'));
  const actual = computeMetrics(rows);
  const { ok, results } = compareMetrics(actual, reference.metrics);

  console.log(`[check-parity] ${rows.length} careers (${policy}) vs ${path.basename(refPath)}`);
  for (const r of results) {
    const status = r.ok ? 'ok  ' : 'FAIL';
    console.log(
      `  ${status} ${r.key}: actual=${r.actual} expected=${r.expected} tol=${r.tolerance} diff=${r.diff.toFixed(3)}`,
    );
  }
  if (!ok) {
    console.error('[check-parity] balance drifted outside tolerance — see FAIL rows above.');
    process.exitCode = 1;
  } else {
    console.log('[check-parity] within tolerance.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
