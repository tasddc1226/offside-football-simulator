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

// T-10-033: 이벤트 정의는 import 부수효과로 EVENTS에 등록된다. 게임 경로에서 import가 빠지면 정의가
// 지연 청크(EventDex)로만 가고 일반 플레이에서 이벤트가 안 뜬다 — 모듈마다 첫 이벤트 id로 확인한다.
// military.ts는 season.ts가 정적으로 import해 공유 청크로 가므로 여기서는 나머지 네 모듈만 본다.
// 첫 화면에 함께 내려받는 청크(index.html의 진입 스크립트 + modulepreload) 어디에든 있으면 된다 — 번들러가
// 공유 모듈을 index 밖의 정적 청크(actions-*.js 등)로 떼어 내도 시작할 때 로드된다.
const EVENT_MARKERS = ['knock', 'rival-1', 'var', 'fw-drought'];
const indexHtml = readFileSync(path.join(distDir, 'index.html'), 'utf8');
const initialFiles = [...indexHtml.matchAll(/(?:src|href)="\/?assets\/([^"]+\.js)"/g)].map((m) => m[1]);
const initialSource = initialFiles.map((f) => readFileSync(path.join(distAssetsDir, f), 'utf8')).join('\n');
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

const missing = EVENT_MARKERS.filter((id) => !new RegExp(`id:\\s*["'\`]${id}["'\`]`).test(initialSource));
if (missing.length) {
  console.error(`초기 청크에 이벤트 정의가 없다(${missing.join(', ')}) — 진입점(main.ts → ui/actions.ts → game/turn.ts)에서 game/event-registry.js가 정적으로 import되는지 확인하라.`);
  process.exit(1);
}

console.log('check:bundle OK');
