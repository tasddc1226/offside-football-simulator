#!/usr/bin/env node
// ADR-009 "검토 통과 구현 규칙"·DSN-CHN-001: 초기 청크 300KB(gzip) 이하.
// vite build 후 dist/assets의 진입 JS(라우트 청크 제외, index-*.js + vendor-*.js) gzip 합을 검사한다.
// T-0-013: Pretendard dynamic subset 전환 후 폰트 예산도 같이 검사한다.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LIMIT_BYTES = 300 * 1024;
const FONT_FILE_LIMIT_BYTES = 200 * 1024;
const PRELOADED_FONT_BUDGET_BYTES = 100 * 1024;

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

// T-0-013: woff2 subset 파일 하나가 200KB를 넘으면 dynamic subset이 깨진 것이다(예: 원본 2MB 파일이 그대로 나옴).
const fontFiles = entries.filter((name) => /\.woff2$/.test(name));
let largestFontBytes = 0;
let largestFontFile = null;
for (const file of fontFiles) {
  const bytes = statSync(path.join(distAssetsDir, file)).size;
  if (bytes > largestFontBytes) {
    largestFontBytes = bytes;
    largestFontFile = file;
  }
  if (bytes > FONT_FILE_LIMIT_BYTES) {
    console.error(
      `${file}: ${(bytes / 1024).toFixed(2)} KB — woff2 파일 하나가 예산 ${FONT_FILE_LIMIT_BYTES / 1024}KB를 초과했다.`,
    );
    process.exit(1);
  }
}
if (largestFontFile) {
  console.log(
    `가장 큰 폰트 subset: ${largestFontFile} ${(largestFontBytes / 1024).toFixed(2)} KB (예산 ${FONT_FILE_LIMIT_BYTES / 1024} KB)`,
  );
}

// T-0-013: 초기 HTML이 <link rel="preload" as="font">로 미리 받는 폰트 바이트 합은 100KB 이하여야 한다.
// dynamic subset은 화면에 실제로 쓰이는 글자 범위만 받는 게 목적이므로, 누군가 실수로 subset 전체를
// preload에 걸면 여기서 잡힌다.
let indexHtml;
try {
  indexHtml = readFileSync(path.join(distDir, 'index.html'), 'utf8');
} catch {
  console.error('dist/index.html을 찾지 못했다. 먼저 pnpm --filter @offside/web build를 실행하라.');
  process.exit(1);
}

const preloadFontHrefs = [
  ...indexHtml.matchAll(/<link\b[^>]*rel="preload"[^>]*as="font"[^>]*href="([^"]+)"[^>]*>/g),
  ...indexHtml.matchAll(/<link\b[^>]*as="font"[^>]*rel="preload"[^>]*href="([^"]+)"[^>]*>/g),
].map((match) => match[1]);

let preloadedFontBytes = 0;
for (const href of preloadFontHrefs) {
  const fileName = href.replace(/^\/?assets\//, '');
  preloadedFontBytes += statSync(path.join(distAssetsDir, fileName)).size;
}
console.log(
  `초기 HTML에서 preload되는 폰트 합: ${(preloadedFontBytes / 1024).toFixed(2)} KB (예산 ${PRELOADED_FONT_BUDGET_BYTES / 1024} KB)`,
);
if (preloadedFontBytes > PRELOADED_FONT_BUDGET_BYTES) {
  console.error('초기 HTML에서 preload되는 폰트 합이 100KB 예산을 초과했다.');
  process.exit(1);
}

console.log('check:bundle OK');
