#!/usr/bin/env node
// 13-visual-design-system.md DSN-COL-001: 텍스트·배경 조합 4.5:1, 비텍스트 그래픽 3:1 MUST.
// tokens.css를 파싱해 두 테마의 대비를 계산한다. 미달이어도 토큰을 고치지 않고 결과만 보고한다.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const tokensPath = path.resolve(scriptDir, '../src/tokens.css');
const css = readFileSync(tokensPath, 'utf8');

/**
 * @param {string} css
 * @param {RegExp} selectorStart
 * @returns {string}
 */
function extractBlock(css, selectorStart) {
  const match = selectorStart.exec(css);
  if (!match) {
    throw new Error(`선택자를 찾지 못했다: ${selectorStart}`);
  }
  let i = match.index + match[0].length;
  let depth = 1;
  const start = i;
  while (depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  return css.slice(start, i - 1);
}

/** @param {string} block */
function parseVars(block) {
  /** @type {Record<string, string>} */
  const vars = {};
  const re = /--([a-z0-9-]+):\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(block))) {
    vars[m[1]] = m[2].trim();
  }
  return vars;
}

/** @param {string} hex */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const int = Number.parseInt(full, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

/** @param {number} c */
function channelLuminance(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** @param {{r: number; g: number; b: number}} rgb */
function relativeLuminance({ r, g, b }) {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/**
 * @param {string} hexA
 * @param {string} hexB
 */
function contrastRatio(hexA, hexB) {
  const la = relativeLuminance(hexToRgb(hexA));
  const lb = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

const lightBlock = extractBlock(css, /:root\s*\{/);
const darkBlock = extractBlock(css, /:root\[data-theme=['"]dark['"]\]\s*\{/);
const light = parseVars(lightBlock);
const dark = { ...light, ...parseVars(darkBlock) };

// UX-004 포인트 색상 프리셋. tokens.css의 id 목록과 맞춰 둔다(색을 더하거나 빼면 여기도 고친다).
const ACCENT_PRESET_IDS = ['green', 'violet', 'crimson', 'amber', 'mono'];

/** @param {string} id */
function presetVars(id) {
  const lightPresetBlock = extractBlock(css, new RegExp(`:root\\[data-accent=['"]${id}['"]\\]\\s*\\{`));
  const darkPresetBlock = extractBlock(
    css,
    new RegExp(`:root\\[data-theme=['"]dark['"]\\]\\[data-accent=['"]${id}['"]\\]\\s*\\{`),
  );
  return {
    light: { ...light, ...parseVars(lightPresetBlock) },
    dark: { ...dark, ...parseVars(darkPresetBlock) },
  };
}

// 텍스트: 4.5:1. [전경, 배경]
const TEXT_PAIRS = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surface-2'],
  ['text-2', 'bg'],
  ['text-2', 'surface'],
  ['text-2', 'surface-2'],
  ['on-accent', 'accent'],
  ['on-hero', 'hero'],
  ['hero-muted', 'hero'],
  ['accent', 'surface'],
];
// 비텍스트 그래픽(라인·게이지·아이콘): 3:1.
const NON_TEXT_PAIRS = [
  ['line', 'bg'],
  ['success', 'bg'],
  ['warning', 'bg'],
  ['danger', 'bg'],
  ['focus', 'bg'],
];

/**
 * @param {string} themeName
 * @param {Record<string, string>} vars
 */
function checkTheme(themeName, vars) {
  const rows = [];
  for (const [fg, bg] of TEXT_PAIRS) {
    const ratio = contrastRatio(vars[`os-${fg}`], vars[`os-${bg}`]);
    rows.push({ theme: themeName, fg, bg, ratio, min: 4.5, pass: ratio >= 4.5 });
  }
  for (const [fg, bg] of NON_TEXT_PAIRS) {
    const ratio = contrastRatio(vars[`os-${fg}`], vars[`os-${bg}`]);
    rows.push({ theme: themeName, fg, bg, ratio, min: 3, pass: ratio >= 3 });
  }
  return rows;
}

// 프리셋은 accent 계열만 새로 정의하므로(다른 토큰은 기본 테마 값을 그대로 물려받음) 이 두 쌍만
// 다시 본다. 나머지 쌍은 위 checkTheme('light'|'dark', ...)가 이미 확인했다.
const ACCENT_PAIRS = [
  ['on-accent', 'accent'],
  ['accent', 'surface'],
];

/**
 * @param {string} themeName
 * @param {Record<string, string>} vars
 */
function checkAccentPairs(themeName, vars) {
  return ACCENT_PAIRS.map(([fg, bg]) => {
    const ratio = contrastRatio(vars[`os-${fg}`], vars[`os-${bg}`]);
    return { theme: themeName, fg, bg, ratio, min: 4.5, pass: ratio >= 4.5 };
  });
}

const presetRows = ACCENT_PRESET_IDS.flatMap((id) => {
  const { light: lightPreset, dark: darkPreset } = presetVars(id);
  return [
    ...checkAccentPairs(`light/${id}`, lightPreset),
    ...checkAccentPairs(`dark/${id}`, darkPreset),
  ];
});

const rows = [...checkTheme('light', light), ...checkTheme('dark', dark), ...presetRows];

let allPass = true;
for (const row of rows) {
  if (!row.pass) allPass = false;
  const status = row.pass ? 'PASS' : 'FAIL';
  console.log(
    `[${status}] ${row.theme.padEnd(5)} --os-${row.fg} on --os-${row.bg}: ${row.ratio.toFixed(2)} (min ${row.min})`,
  );
}

if (!allPass) {
  console.error(
    '\n대비 미달 토큰이 있다. tokens.css 값을 고치지 말고 PR 본문 "범위 밖 발견 사항"에 적는다.',
  );
  process.exit(1);
}

console.log('\ncheck:contrast OK');
