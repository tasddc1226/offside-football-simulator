#!/usr/bin/env node
// 첫 화면에 내려받는 JS(index.html의 진입 스크립트 + modulepreload) gzip 합이 예산을 넘지 않는지 검사한다.
// T-10-051: 예전엔 index-*.js만 셌다 — 번들러가 공유 모듈을 정적 청크로 떼어 내면 실제 첫 화면 크기는 그대로인데
// 숫자만 오르내렸다. 동적 import 청크(account, 도감, 관리자 등)는 첫 화면에 받지 않으므로 넣지 않는다.
import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// T-10-051: 첫 화면 JS 전체 ~120KB(index 63 + season 51 + 작은 공유 청크) — 여유 약 13%로 잡는다.
const LIMIT_BYTES = 135 * 1024;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(scriptDir, '../dist');
const distAssetsDir = path.resolve(distDir, 'assets');

if (!existsSync(path.join(distDir, 'index.html'))) {
  console.error('dist/index.html을 찾지 못했다. 먼저 pnpm --filter @offside/web build를 실행하라.');
  process.exit(1);
}

// T-10-033: 이벤트 정의는 import 부수효과로 EVENTS에 등록된다. 게임 경로에서 import가 빠지면 정의가
// 지연 청크(EventDex)로만 가고 일반 플레이에서 이벤트가 안 뜬다 — 모듈마다 첫 이벤트 id로 확인한다.
// military.ts는 season.ts가 정적으로 import해 공유 청크로 가므로 여기서는 나머지 네 모듈만 본다.
// 첫 화면 청크 어디에든 있으면 된다.
const EVENT_MARKERS = ['knock', 'rival-1', 'var', 'fw-drought'];
const indexHtml = readFileSync(path.join(distDir, 'index.html'), 'utf8');
const initialFiles = [...indexHtml.matchAll(/(?:src|href)="\/?assets\/([^"]+\.js)"/g)].map(
  (m) => m[1],
);
if (!initialFiles.some((f) => /^index-/.test(f))) {
  console.error('index.html이 가리키는 index-*.js를 dist/assets에서 찾지 못했다.');
  process.exit(1);
}
const initialSource = initialFiles
  .map((f) => readFileSync(path.join(distAssetsDir, f), 'utf8'))
  .join('\n');
let totalGzipBytes = 0;
for (const file of initialFiles) {
  const bytes = readFileSync(path.join(distAssetsDir, file));
  const gzipBytes = gzipSync(bytes).length;
  totalGzipBytes += gzipBytes;
  console.log(`${file}: ${(gzipBytes / 1024).toFixed(2)} KB gzip`);
}

const totalKb = (totalGzipBytes / 1024).toFixed(2);
console.log(`합계: ${totalKb} KB gzip (예산 ${LIMIT_BYTES / 1024} KB)`);

if (totalGzipBytes > LIMIT_BYTES) {
  console.error(`첫 화면 JS gzip 합이 ${LIMIT_BYTES / 1024}KB 예산을 초과했다.`);
  process.exit(1);
}

const missing = EVENT_MARKERS.filter(
  (id) => !new RegExp(`id:\\s*["'\`]${id}["'\`]`).test(initialSource),
);
if (missing.length) {
  console.error(
    `초기 청크에 이벤트 정의가 없다(${missing.join(', ')}) — 진입점(main.ts → ui/actions.ts → game/turn.ts)에서 game/event-registry.js가 정적으로 import되는지 확인하라.`,
  );
  process.exit(1);
}

console.log('check:bundle OK');
