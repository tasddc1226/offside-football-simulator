#!/usr/bin/env node
// 초기 청크(vite build의 dist/assets index-*.js) gzip 합이 예산을 넘지 않는지 검사한다.
// 바닐라 TS 포트라 React/TanStack 시절 예산(300KB)보다 훨씬 작아졌다 — 게임 로직(data/engine/events
// 등)을 모두 합쳐도 초기 청크는 보통 수십 KB대다. account.js(구글 로그인 UI)는 동적 import라
// 별도 청크로 지연 로드되므로 이 예산에 포함하지 않는다.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// T-10-004: Svelte 이전 후 초기 청크는 ~69KB — 회귀를 빨리 잡도록 예산을 150KB에서 85KB로 좁혔다.
const LIMIT_BYTES = 85 * 1024;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(scriptDir, '../dist');
const distAssetsDir = path.resolve(distDir, 'assets');

let entries;
try {
  entries = readdirSync(distAssetsDir);
} catch {
  console.error('dist/assets를 찾지 못했다. 먼저 pnpm --filter @offside/web build를 실행하라.');
  process.exit(1);
}

const entryFiles = entries.filter((name) => /^index-.*\.js$/.test(name));

if (entryFiles.length === 0) {
  console.error('index-*.js를 dist/assets에서 찾지 못했다.');
  process.exit(1);
}

let totalGzipBytes = 0;
for (const file of entryFiles.sort()) {
  const bytes = readFileSync(path.join(distAssetsDir, file));
  const gzipBytes = gzipSync(bytes).length;
  totalGzipBytes += gzipBytes;
  console.log(`${file}: ${(gzipBytes / 1024).toFixed(2)} KB gzip`);
}

const totalKb = (totalGzipBytes / 1024).toFixed(2);
console.log(`합계: ${totalKb} KB gzip (예산 ${LIMIT_BYTES / 1024} KB)`);

if (totalGzipBytes > LIMIT_BYTES) {
  console.error(`초기 청크 gzip 합이 ${LIMIT_BYTES / 1024}KB 예산을 초과했다.`);
  process.exit(1);
}

console.log('check:bundle OK');
