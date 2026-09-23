#!/usr/bin/env node
// T-9-001c: CI용 짧은 풀타임 밸런스 스모크. tooling/fulltime-sim으로 N개의 random 정책 커리어를
// 헤드리스로 돌리고, 0 errors와 상식적인 범위(peak OVR, 은퇴 나이)만 빠르게 확인한다. 전체 밸런스
// 회귀는 `pnpm --filter @offside/fulltime-sim run check-parity`(full-validation.yml, N=20000)가 맡는다.
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const simDir = path.join(repoRoot, 'tooling', 'fulltime-sim');

export function checkAggregate(agg, { n }) {
  const problems = [];
  if (agg.n !== n) problems.push(`n=${agg.n}, expected ${n}`);
  if (agg.errors !== 0) problems.push(`errors=${agg.errors}, expected 0`);
  const ovrByAge = agg.ovrByAge ?? {};
  const nByAge = agg.nByAge ?? {};
  for (const age of Object.keys(nByAge)) {
    const avg = ovrByAge[age] / nByAge[age];
    if (!(avg >= 1 && avg <= 99)) problems.push(`ovrByAge[${age}] average ${avg} out of [1,99]`);
  }
  return problems;
}

function main() {
  const n = Number(process.argv[2] || 2000);
  const tag = process.argv[3] || 'ci-smoke';
  const resultDir = path.join(simDir, 'results', tag);

  const run = spawnSync(
    'pnpm',
    ['--filter', '@offside/fulltime-sim', 'exec', 'tsx', 'simulate.ts', String(n), 'random', tag],
    { cwd: repoRoot, stdio: 'inherit' },
  );
  if (run.status !== 0) {
    console.error(`sim-smoke: simulate.ts exited with status ${run.status}`);
    process.exitCode = 1;
    return;
  }

  try {
    const agg = JSON.parse(readFileSync(path.join(resultDir, 'aggregate-random.json'), 'utf8'));
    const problems = checkAggregate(agg, { n });
    if (problems.length > 0) {
      console.error('sim-smoke: FAILED');
      for (const p of problems) console.error(`  - ${p}`);
      process.exitCode = 1;
      return;
    }
    console.log(`sim-smoke: OK — ${agg.n} careers, 0 errors, ovrByAge in range (${agg.secs}s).`);
  } finally {
    rmSync(resultDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
