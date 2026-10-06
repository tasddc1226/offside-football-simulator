#!/usr/bin/env node
// T-11-106 다국어 게이트. 화면·게임·서버 코드에 한국어 문구를 새로 박아 넣으면 실패한다.
//
// 사전(`i18n/` 폴더) 밖 소스에서 주석을 뺀 한글 덩어리 수를 파일마다 세어 기준선(`tooling/i18n-baseline.json`)과
// 비교한다. 기준선은 다국어 도입 전부터 남은 한국어(저장값·운영 도구 밖 남은 문구)이고, 줄기만 해야 한다(래칫).
// - 늘었거나 기준선에 없는 파일에 한글이 생기면 실패: 문구를 ko/en 사전으로 옮긴다.
// - 줄었으면 실패: `pnpm lint:i18n --update`로 기준선을 낮춰 함께 커밋한다.
// - 저장값·식별자처럼 일부러 한국어로 두는 줄은 같은 줄이나 바로 윗줄에 `i18n-ignore` 주석을 단다.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 검사하는 소스 뿌리. */
export const ROOTS = [
  'apps/web/src',
  'apps/mobile/src',
  'apps/api/src',
  'packages/app-core/src',
  'packages/game/src',
  'packages/contracts/src',
];
const EXT = /\.(ts|tsx|svelte|mjs|js)$/;
/** 검사하지 않는 경로 — 사전 자체, 테스트, 운영 도구(한국어로 둔다). */
const SKIP = [
  /(^|\/)i18n\//,
  /\.(test|spec)\.[a-z]+$/,
  /(^|\/)__fixtures__\//,
  /(^|\/)node_modules\//,
  /(^|\/)admin\//,
  /(^|\/)Admin\.(svelte|tsx)$/,
];
export const BASELINE = 'tooling/i18n-baseline.json';

const HANGUL_RUN = /[ㄱ-ㅎㅏ-ㅣ가-힣](?:[ㄱ-ㅎㅏ-ㅣ가-힣0-9\s.,!?·%~:+\-/()]*[ㄱ-ㅎㅏ-ㅣ가-힣])?/g;

/** 주석과 `i18n-ignore` 줄을 지운다. URL의 `://`는 주석으로 보지 않는다. */
export function stripComments(src) {
  const lines = src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, '')).split('\n');
  const kept = lines.map((l, i) =>
    l.includes('i18n-ignore') ||
    (i > 0 && /^\s*(\/\/|\/\*|\{\/\*|<!--).*i18n-ignore/.test(lines[i - 1]))
      ? ''
      : l,
  );
  return kept
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

/** 주석을 뺀 한글 덩어리 — [줄 번호, 덩어리]. */
export function hangulRuns(src) {
  const code = stripComments(src);
  const out = [];
  for (const m of code.matchAll(HANGUL_RUN)) {
    out.push([code.slice(0, m.index).split('\n').length, m[0].replace(/\s+/g, ' ')]);
  }
  return out;
}

function walk(dir, root, files) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    const rel = path.relative(root, abs).split(path.sep).join('/');
    if (SKIP.some((r) => r.test(rel + (e.isDirectory() ? '/' : '')))) continue;
    if (e.isDirectory()) walk(abs, root, files);
    else if (EXT.test(e.name)) files.push(rel);
  }
}

/** 파일 → 한글 덩어리 목록(한글이 있는 파일만). */
export function scan(root) {
  const files = [];
  for (const r of ROOTS) walk(path.join(root, r), root, files);
  /** @type {Record<string, [number, string][]>} */
  const found = {};
  for (const f of files.sort()) {
    const runs = hangulRuns(readFileSync(path.join(root, f), 'utf8'));
    if (runs.length) found[f] = runs;
  }
  return found;
}

/** 기준선과 비교한다. */
export function compare(found, baseline) {
  const grew = [];
  const shrank = [];
  for (const f of new Set([...Object.keys(found), ...Object.keys(baseline)])) {
    const now = found[f]?.length ?? 0;
    const was = baseline[f] ?? 0;
    if (now > was) grew.push({ file: f, now, was, runs: found[f] });
    else if (now < was) shrank.push({ file: f, now, was });
  }
  return { grew, shrank };
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const found = scan(root);
  const counts = Object.fromEntries(Object.entries(found).map(([f, r]) => [f, r.length]));
  const file = path.join(root, BASELINE);
  if (process.argv.includes('--update')) {
    writeFileSync(file, `${JSON.stringify(counts, null, 2)}\n`);
    console.log(`i18n 기준선 갱신: 파일 ${Object.keys(counts).length}개`);
    return;
  }
  const baseline = JSON.parse(readFileSync(file, 'utf8'));
  const { grew, shrank } = compare(found, baseline);
  for (const g of grew) {
    console.error(`✗ ${g.file}: 한글 ${g.was} → ${g.now}`);
    for (const [line, run] of g.runs) console.error(`    ${line}: ${run}`);
  }
  if (grew.length)
    console.error(
      '\n새 한국어 문구는 i18n/ko·i18n/en 사전으로 옮긴다(docs/operations/i18n.md). 저장값·식별자라 한국어로 둬야 하면 `i18n-ignore` 주석을 단다.',
    );
  for (const s of shrank) console.error(`↓ ${s.file}: 한글 ${s.was} → ${s.now}`);
  if (shrank.length)
    console.error('\n한국어가 줄었다. `pnpm lint:i18n --update`로 기준선을 낮춰 함께 커밋한다.');
  if (grew.length || shrank.length) process.exit(1);
  console.log(`check:i18n OK (기준선 파일 ${Object.keys(baseline).length}개)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
