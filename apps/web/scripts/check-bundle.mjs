#!/usr/bin/env node
// 첫 화면에 내려받는 JS(index.html의 진입 스크립트 + modulepreload) gzip 합이 예산을 넘지 않는지 검사한다.
// T-10-051: 예전엔 index-*.js만 셌다 — 번들러가 공유 모듈을 정적 청크로 떼어 내면 실제 첫 화면 크기는 그대로인데
// 숫자만 오르내렸다. 동적 import 청크(account, 도감, 관리자 등)는 첫 화면에 받지 않으므로 넣지 않는다.
// T-10-104: 게임 화면·액션·게임 시트도 지연 청크로 뗐다(홈이 한가할 때 미리 받는다 — nav.warmGame).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// T-10-051: 첫 화면 JS 전체 ~120KB(index 63 + season 51 + 작은 공유 청크) — 여유 약 13%로 잡는다.
// T-10-096: 국적 표(211개국, 게임 엔진이 동기로 쓴다)로 +1.2KB — 생성 화면·영어 이름을 지연 청크로 떼고도 넘어 138KB로(사용자 결정).
// T-11-106: 게임 엔진 문구를 네임스페이스로 옮기며(키 이름·함수 문구·getter) 첫 화면에 실린 엔진 청크가 +6KB —
// 영어 사전은 지연 청크라 한국어 사용자가 받는 영어는 없다. 엔진을 첫 화면 밖으로 빼는 건 따로 할 일이라 141KB로.
const LIMIT_BYTES = 141 * 1024;

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
// T-10-104: 게임 화면(Game.svelte → actions.ts → turn.ts → event-registry)이 첫 화면 번들에서 지연 청크로 빠졌다.
// 그래서 첫 화면 청크가 아니라 '게임 청크(Game-*.js)에서 정적 import로 따라가 닿는 청크들'에 마커가 있는지 본다 —
// 게임 화면이 뜨면 함께 실행되는 범위이고, 동적 import(EventDex 등)는 따라가지 않는다.
const EVENT_MARKERS = ['knock', 'rival-1', 'var', 'fw-drought'];
const GAME_CHUNK = /^Game-[^/]+\.js$/;
// 정적 import·재수출(`import{..}from"./x.js"`, `import"./x.js"`, `export{..}from"./x.js"`)만 잡는다. `import("./x.js")`(동적)는 제외.
const STATIC_IMPORT = /\b(?:import|export)\s*(?:[^"'`;()]*?\bfrom\s*)?["']\.\/([^"']+\.js)["']/g;
/** dist/assets에서 entry 청크들이 정적 import로 닿는 청크 파일명 집합. */
function staticClosure(entries) {
  const seen = new Set();
  const queue = [...entries];
  while (queue.length) {
    const f = queue.pop();
    if (seen.has(f) || !existsSync(path.join(distAssetsDir, f))) continue;
    seen.add(f);
    const src = readFileSync(path.join(distAssetsDir, f), 'utf8');
    for (const m of src.matchAll(STATIC_IMPORT)) queue.push(m[1]);
  }
  return seen;
}
const indexHtml = readFileSync(path.join(distDir, 'index.html'), 'utf8');
const initialFiles = [...indexHtml.matchAll(/(?:src|href)="\/?assets\/([^"]+\.js)"/g)].map(
  (m) => m[1],
);
if (!initialFiles.some((f) => /^index-/.test(f))) {
  console.error('index.html이 가리키는 index-*.js를 dist/assets에서 찾지 못했다.');
  process.exit(1);
}
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

// T-11-102 화면 문구 네임스페이스(app-core i18n/ko/*.ts)는 파일째 청크에 실린다. 첫 화면 모듈이 큰 화면 네임스페이스의
// 키 몇 개만 써도 그 화면 문구 전체가 첫 화면에 실리므로, 첫 화면에 실리는 네임스페이스를 아래로 고정한다
// (docs/operations/i18n.md 규칙 8). 늘어나면 첫 화면이 쓰는 키만 작은 네임스페이스로 나누거나, 정말 필요하면 여기에 더한다.
const EAGER_NAMESPACES = new Set([
  // 게임 엔진(packages/game/src/i18n/ko) — 첫 화면에 실리는 엔진 모듈(season·military 청크)의 문구.
  'gAttrLabel',
  'gBoost',
  'gComps',
  'gData',
  'gGkLabel',
  'gLegend',
  'gMilitary',
  'gNational',
  'gRarity',
  'gRecords',
  'gRoleName',
  'gSeason',
  'gStats',
  'gSubs',
  'gTitles',
  'gTraining',
  'gTurn',
  // 화면(packages/app-core/src/i18n/ko)
  'boardLabel',
  'chatReject',
  'clubSync',
  'firstsTab',
  'gamePotentialNote',
  'hof',
  'home',
  'homeLive',
  'legendToast',
  'ownerConflict',
  'settingsApi',
  'sheetCore',
  'shell',
  'shellInstall',
  'shellLogin',
  'titleTag',
]);
const nsNames = new Set(
  ['app-core', 'game'].flatMap((pkg) =>
    readdirSync(path.resolve(scriptDir, `../../../packages/${pkg}/src/i18n/ko`))
      .filter((f) => f.endsWith('.ts'))
      .map((f) => f.slice(0, -3)),
  ),
);
// 압축된 ns('이름', { … }) 호출 — 함수 이름은 바뀌어도 첫 인자 문자열과 객체 리터럴은 남는다.
const NS_CALL = /\(\s*["'`]([A-Za-z]+)["'`]\s*,\s*\{/g;
const eagerFound = new Set();
for (const file of initialFiles)
  for (const m of readFileSync(path.join(distAssetsDir, file), 'utf8').matchAll(NS_CALL))
    if (nsNames.has(m[1])) eagerFound.add(m[1]);
const unexpected = [...eagerFound].filter((n) => !EAGER_NAMESPACES.has(n));
if (unexpected.length) {
  console.error(
    `첫 화면 청크에 예상하지 않은 문구 네임스페이스가 실렸다: ${unexpected.join(', ')}`,
  );
  process.exit(1);
}

const gameEntries = readdirSync(distAssetsDir).filter((f) => GAME_CHUNK.test(f));
if (!gameEntries.length) {
  console.error(
    'dist/assets에서 게임 청크(Game-*.js)를 찾지 못했다 — App.svelte가 Game.svelte를 지연 import하는지 확인하라.',
  );
  process.exit(1);
}
const gameSource = [...staticClosure(gameEntries)]
  .map((f) => readFileSync(path.join(distAssetsDir, f), 'utf8'))
  .join('\n');
const missing = EVENT_MARKERS.filter(
  (id) => !new RegExp(`id:\\s*["'\`]${id}["'\`]`).test(gameSource),
);
if (missing.length) {
  console.error(
    `게임 청크의 정적 import 범위에 이벤트 정의가 없다(${missing.join(', ')}) — 게임 경로(Game.svelte → ui/actions.ts → game/turn.ts)에서 game/event-registry.js가 정적으로 import되는지 확인하라.`,
  );
  process.exit(1);
}

console.log('check:bundle OK');
