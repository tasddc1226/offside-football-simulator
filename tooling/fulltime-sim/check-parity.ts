// T-9-001c: simulate.ts가 쓴 careers-<policy>.csv를 reference/<policy>.json의 밸런스 기준선과
// 비교한다. simulate.ts/analyze.ts는 손대지 않는다 — 이 스크립트는 그 산출물만 읽는 별도 도구다.
// quantile/pearson/share는 analyze.ts와 공유하는 ./metrics.ts 구현을 쓴다(예전엔 이 파일에 따로
// 구현돼 있었고 undefined 처리 방식이 analyze.ts와 어긋나 있었다).
// 실행: tsx check-parity.ts <tag> [policy] [referenceFile]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pearson, quantile, share, type Row } from './metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type MetricKey =
  | 'peakP10'
  | 'peakP50'
  | 'peakP90'
  | 'corrPotPeak'
  | 'europeShare'
  | 'plShare'
  | 'cappedShare'
  | 'ballonWinShare'
  | 'retireAgeP50';

type Metrics = Record<MetricKey, number>;

const TOLERANCES: Metrics = {
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

function readCsv(csvPath: string): Row[] {
  const lines = fs.readFileSync(csvPath, 'utf8').split('\n');
  const cols = lines[0]!.split(',');
  return lines
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const values = line.split(',');
      const row: Row = {};
      cols.forEach((c, i) => {
        const raw = values[i]!;
        row[c] = raw === '' || Number.isNaN(+raw) ? raw : +raw;
      });
      return row;
    });
}

export function computeMetrics(rows: Row[]): Metrics {
  return {
    peakP10: quantile(rows.map((r) => r.peak), 0.1),
    peakP50: quantile(rows.map((r) => r.peak), 0.5),
    peakP90: quantile(rows.map((r) => r.peak), 0.9),
    corrPotPeak: pearson(rows, 'pot', 'peak'),
    europeShare: share(rows, (r) => (r.maxTier as number) >= 4),
    plShare: share(rows, (r) => r.maxTier === 8),
    cappedShare: share(rows, (r) => (r.caps as number) > 0),
    ballonWinShare: share(rows, (r) => (r.ballon as number) > 0),
    retireAgeP50: quantile(rows.map((r) => r.retireAge), 0.5),
  };
}

export interface CompareResult {
  key: MetricKey;
  actual: number;
  expected: number;
  tolerance: number;
  diff: number;
  ok: boolean;
}

export function compareMetrics(
  actual: Metrics,
  expected: Metrics,
  tolerances: Metrics = TOLERANCES,
): { ok: boolean; results: CompareResult[] } {
  const results = (Object.keys(expected) as MetricKey[]).map((key) => {
    const tol = tolerances[key] ?? 0;
    const diff = Math.abs(actual[key] - expected[key]);
    return { key, actual: actual[key], expected: expected[key], tolerance: tol, diff, ok: diff <= tol };
  });
  return { ok: results.every((r) => r.ok), results };
}

function main() {
  const [tag, policy = 'random', referenceFile] = process.argv.slice(2);
  if (!tag) {
    console.error('Usage: check-parity.ts <tag> [policy=random] [referenceFile]');
    process.exitCode = 1;
    return;
  }
  const csvPath = path.join(__dirname, 'results', tag, `careers-${policy}.csv`);
  const refPath = referenceFile
    ? path.resolve(referenceFile)
    : path.join(__dirname, 'reference', `${policy}.json`);

  const rows = readCsv(csvPath);
  const reference = JSON.parse(fs.readFileSync(refPath, 'utf8')) as { version?: number; metrics: Metrics };
  const actual = computeMetrics(rows);
  const { ok, results } = compareMetrics(actual, reference.metrics);

  console.log(`[check-parity] ${rows.length} careers (${policy}) vs ${path.basename(refPath)}${reference.version ? ` v${reference.version}` : ''}`);
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
