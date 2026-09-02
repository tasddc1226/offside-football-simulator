#!/usr/bin/env node
// ADR-009 "검토 통과 구현 규칙"·DSN-CHN-001: 초기 청크 300KB(gzip) 이하.
// vite build 후 dist/assets의 진입 JS(라우트 청크 제외, index-*.js + vendor-*.js) gzip 합을 검사한다.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LIMIT_BYTES = 300 * 1024;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distAssetsDir = path.resolve(scriptDir, '../dist/assets');

let entries;
try {
  entries = readdirSync(distAssetsDir);
} catch {
  console.error('dist/assets를 찾지 못했다. 먼저 pnpm --filter @offside/web build를 실행하라.');
  process.exit(1);
}

const entryFiles = entries.filter((name) => /^(index|vendor)-.*\.js$/.test(name));

if (entryFiles.length === 0) {
  console.error('index-*.js 또는 vendor-*.js를 dist/assets에서 찾지 못했다.');
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
  console.error('초기 청크 gzip 합이 300KB 예산을 초과했다.');
  process.exit(1);
}

console.log('check:bundle OK');
