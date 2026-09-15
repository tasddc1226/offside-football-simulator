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
 * @param {{r: number; g: number; b: number}} rgb
 * @returns {string}
 */
function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * UX-013: 토큰 값이 hex 리터럴 외에 `var(--os-x)`와 `color-mix(in srgb, A p%, B)`(--os-hero-muted)
 * 일 수 있어 hex로 풀어 준다. color-mix(in srgb)는 감마 sRGB 채널을 그대로 선형 보간하므로
 * 브라우저 계산과 같다(반올림 ±1 채널 오차는 4.5:1 판정에 영향이 없는 여유를 둔다).
 * @param {string} value
 * @param {Record<string, string>} vars
 * @param {number} [depth]
 * @returns {string}
 */
function resolveColor(value, vars, depth = 0) {
  const trimmed = value.trim();
  if (depth > 8) throw new Error(`색 참조가 너무 깊다: ${value}`);
  if (trimmed.startsWith('#')) return trimmed;
  const varMatch = /^var\(--([a-z0-9-]+)\)$/i.exec(trimmed);
  if (varMatch) {
    const referenced = vars[varMatch[1]];
    if (referenced === undefined) throw new Error(`정의되지 않은 토큰 참조: ${trimmed}`);
    return resolveColor(referenced, vars, depth + 1);
  }
  const mixMatch = /^color-mix\(in srgb,\s*(.+?)\s+(\d+(?:\.\d+)?)%\s*,\s*(.+?)\)$/i.exec(trimmed);
  if (mixMatch) {
    const a = hexToRgb(resolveColor(mixMatch[1], vars, depth + 1));
    const b = hexToRgb(resolveColor(mixMatch[3], vars, depth + 1));
    const pa = Number(mixMatch[2]) / 100;
    return rgbToHex({
      r: a.r * pa + b.r * (1 - pa),
      g: a.g * pa + b.g * (1 - pa),
      b: a.b * pa + b.b * (1 - pa),
    });
  }
  throw new Error(`해석할 수 없는 색 값: ${value}`);
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

/**
 * @param {Record<string, string>} vars
 * @param {string} name `os-` 없는 토큰 이름(예: 'hero-muted')
 */
function tokenColor(vars, name) {
  const raw = vars[`os-${name}`];
  if (raw === undefined) throw new Error(`토큰이 없다: --os-${name}`);
  return resolveColor(raw, vars);
}

/**
 * hero 그라데이션의 가장 밝은 끝. 화면 전환(packages/ui/src/screen-transition.css 78%)·시네마틱
 * 인트로(apps/web/src/shared/cinematic-intro.css 80%)·트레이딩 카드(player-card.css·
 * player-creation.css 76%)·은퇴 화면(retirement-screen.css 72%)이
 * `linear-gradient(var(--os-hero), color-mix(in srgb, var(--os-hero) N%, var(--os-line)))` 위에
 * --os-on-hero·--os-hero-muted 텍스트를 올리므로, 순수 --os-hero만 보면 다크(--os-line이 밝은
 * 녹색)에서 그라데이션 끝이 4.5:1 아래로 떨어지는 회귀를 놓친다(axe도 그라데이션은 계산하지 못한다).
 * 가장 낮은 비율(72%)을 가상 토큰 --os-hero-gradient-end로 만들어 텍스트 쌍을 검사한다 — 그라데이션
 * 비율을 이보다 낮추는 화면을 새로 만들면 이 값도 함께 내린다.
 */
const HERO_GRADIENT_END_RATIO = 72;

/** @param {Record<string, string>} vars */
function withHeroGradientEnd(vars) {
  return {
    ...vars,
    'os-hero-gradient-end': `color-mix(in srgb, var(--os-hero) ${HERO_GRADIENT_END_RATIO}%, var(--os-line))`,
  };
}

const lightBlock = extractBlock(css, /:root\s*\{/);
const darkBlock = extractBlock(css, /:root\[data-theme=['"]dark['"]\]\s*\{/);
const light = withHeroGradientEnd(parseVars(lightBlock));
const dark = withHeroGradientEnd({ ...light, ...parseVars(darkBlock) });

// UX-004 포인트 색상 프리셋 + UX-013 가상 구단 프리셋('team-<id>', ACCENT_TEAM_IDS 순서). tokens.css의
// id 목록과 맞춰 둔다(색을 더하거나 빼면 여기도 고친다).
const BASE_ACCENT_PRESET_IDS = ['green', 'violet', 'crimson', 'amber', 'mono'];

// UX-013: data-accent='team-<id>' 프리셋이 있는 팀. 1.5.0의 K1 리그 12개 구단(accent-presets.ts의
// TEAM_ACCENT_PRESET_TEAM_IDS와 순서까지 같다). 1.0.0~1.4.0의 옛 12개 구단은 배지 색만 있고
// 프리셋은 없다(교체됐다) — 아래 BADGE_TEAM_IDS에서만 검사한다.
const ACCENT_TEAM_IDS = [
  'seoul-hangang-fc',
  'suwon-hwahong-fc',
  'incheon-gaetbeol-fc',
  'jeonju-deulnyeok-united',
  'ulsan-pado-fc',
  'pohang-donghae-fc',
  'daegu-palgong-fc',
  'jeju-halla-city',
  'gangneung-haesol-fc',
  'gwangju-mudeung-fc',
  'daejeon-gapcheon-fc',
  'busan-deungdae-fc',
];

// UX-008 구단 배지. tokens.css --os-team-<id> 목록과 id를 맞춰 둔다(팀을 추가·빼면 여기도 고친다).
// 배지 텍스트는 항상 --os-on-accent라 그 값과의 대비만 보면 된다(배경은 컴포넌트가 이 변수를
// 인라인 style로 꽂아 넣을 뿐 별도 조합이 없다). 1.0.0~1.4.0(가상 구단 12개)과 1.5.0(K리그식 27개)이
// 공존한다 — 과거 커리어의 ClubBadge가 계속 그려지므로 옛 id도 계속 검사한다.
const BADGE_TEAM_IDS = [
  // 1.0.0~1.4.0
  'hangang-u18',
  'seorabeol-united',
  'cheongyeon-fc',
  'gangdong-rovers',
  'onsaemiro-city',
  'byeolbit-united',
  'galmae-town',
  'noeulhang-fc',
  'geumbit-fc',
  'eunha-rovers',
  'gangnaru-united',
  'dalbit-town-fc',
  // 1.5.0 R리그(B팀)
  'seoul-hangang-fc-b',
  // 1.5.0 K1 + K2
  ...ACCENT_TEAM_IDS,
  'anyang-pyeongchon-fc',
  'bucheon-wonmi-fc',
  'seongnam-tancheon-fc',
  'gimpo-pyeongya-fc',
  'cheonan-heungtaryeong-fc',
  'asan-oncheon-fc',
  'cheongju-jikji-fc',
  'changwon-jinhae-fc',
  'gwangyang-maehwa-fc',
  'gimcheon-hwangak-fc',
  'ansan-gaetgol-fc',
  'yongin-hanteo-fc',
  'hwaseong-gukhwa-fc',
  'seoul-namsan-fc',
];

const ACCENT_PRESET_IDS = [...BASE_ACCENT_PRESET_IDS, ...ACCENT_TEAM_IDS.map((id) => `team-${id}`)];

/** @param {string} id */
function presetVars(id) {
  const lightPresetBlock = extractBlock(css, new RegExp(`:root\\[data-accent=['"]${id}['"]\\]\\s*\\{`));
  const darkPresetBlock = extractBlock(
    css,
    new RegExp(`:root\\[data-theme=['"]dark['"]\\]\\[data-accent=['"]${id}['"]\\]\\s*\\{`),
  );
  // 시스템 다크(prefers-color-scheme) 블록은 data-theme='dark' 블록과 값이 같아야 한다 — 한쪽만
  // 고치면 명시 다크와 시스템 다크가 다른 색이 되므로 여기서 드리프트를 잡는다.
  const mediaPresetBlock = extractBlock(
    css,
    new RegExp(`:root:not\\(\\[data-theme=['"]light['"]\\]\\)\\[data-accent=['"]${id}['"]\\]\\s*\\{`),
  );
  const darkPreset = parseVars(darkPresetBlock);
  const mediaPreset = parseVars(mediaPresetBlock);
  const darkKeys = Object.keys(darkPreset).sort();
  const mediaKeys = Object.keys(mediaPreset).sort();
  const same =
    darkKeys.length === mediaKeys.length &&
    darkKeys.every((key, index) => key === mediaKeys[index] && darkPreset[key] === mediaPreset[key]);
  if (!same) {
    throw new Error(
      `프리셋 '${id}'의 :root[data-theme='dark'] 블록과 @media dark 블록 값이 다르다 — 두 곳을 같게 맞춘다.`,
    );
  }
  return {
    light: { ...light, ...parseVars(lightPresetBlock) },
    dark: { ...dark, ...darkPreset },
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
  // 이슈 180: UX-011 PlayerCard 등번호 배지(apps/web/src/shared/player-card.css
  // .os-player-card-number)도 이 쌍이다 — 배지는 카드 배경(팀 컬러 12개 × 2테마 그라데이션·브랜드
  // 중립 그라데이션)과 무관하게 불투명 --os-hero 위에 --os-on-hero 글자를 고정하므로, 배지의 대비는
  // 어느 카드 맥락에서든 이 한 행이 보장한다. 배지를 반투명·currentColor로 되돌리면 그 보장이 깨진다.
  ['on-hero', 'hero'],
  ['hero-muted', 'hero'],
  // hero 그라데이션의 가장 밝은 끝(위 HERO_GRADIENT_END_RATIO) 위 텍스트 — 순수 hero보다 항상 낮다.
  ['on-hero', 'hero-gradient-end'],
  ['hero-muted', 'hero-gradient-end'],
  ['accent', 'surface'],
  // T-7-012: .os-game-hero .os-eyebrow(game.css)가 이 색을 캡션 텍스트로 쓴다 — --os-line(3:1
  // 비텍스트 기준)이 라이트 --os-bg·--os-surface-2 위에서 4.5:1을 못 넘겨 axe color-contrast
  // serious로 잡혔던 자리(이슈 180)라 텍스트 기준(4.5:1)으로 회귀를 막는다.
  ['accent', 'bg'],
  ['accent', 'surface-2'],
  // PR 231 리뷰: ClubBadge의 미등록 팀 id 폴백(team-identity.ts NEUTRAL_FALLBACK)이 이 쌍이다 —
  // 팀 배지 텍스트는 항상 --os-on-accent라(TeamBadge.tsx) 폴백 배경 --os-neutral과의 대비도
  // 등록된 팀(BADGE_TEAM_IDS)과 같은 기준으로 지킨다.
  ['on-accent', 'neutral'],
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
    const ratio = contrastRatio(tokenColor(vars, fg), tokenColor(vars, bg));
    rows.push({ theme: themeName, fg, bg, ratio, min: 4.5, pass: ratio >= 4.5 });
  }
  for (const [fg, bg] of NON_TEXT_PAIRS) {
    const ratio = contrastRatio(tokenColor(vars, fg), tokenColor(vars, bg));
    rows.push({ theme: themeName, fg, bg, ratio, min: 3, pass: ratio >= 3 });
  }
  return rows;
}

// 프리셋은 accent·hero 계열만 새로 정의하므로(다른 토큰은 기본 테마 값을 그대로 물려받음) 이 쌍들만
// 다시 본다. 나머지 쌍은 위 checkTheme('light'|'dark', ...)가 이미 확인했다. accent-bg·
// accent-surface-2는 T-7-012: .os-game-hero .os-eyebrow가 프리셋과 무관하게 --os-accent를 쓰므로
// 프리셋별로도 세 배경 모두 4.5:1을 넘는지 회귀를 막는다. on-hero/hero·hero-muted/hero는 UX-013:
// 프리셋이 --os-hero를 팀 색으로 바꾸므로 배너 제목·캡션(hero-muted)·PlayerCard 등번호 배지가
// 18종 × 2테마 전부에서 텍스트 기준을 넘어야 한다. on-hero/hero-gradient-end·hero-muted/
// hero-gradient-end는 화면 전환·트레이딩 카드·은퇴 화면의 그라데이션 끝(worst case) — 다크 --os-line이
// 밝아 프리셋 hero가 라이트 값 그대로면 여기서 미달하므로 다크 블록은 더 짙은 hero를 쓴다.
const ACCENT_PAIRS = [
  ['on-accent', 'accent'],
  ['accent', 'surface'],
  ['accent', 'bg'],
  ['accent', 'surface-2'],
  ['on-hero', 'hero'],
  ['hero-muted', 'hero'],
  ['on-hero', 'hero-gradient-end'],
  ['hero-muted', 'hero-gradient-end'],
];

/**
 * @param {string} themeName
 * @param {Record<string, string>} vars
 */
function checkAccentPairs(themeName, vars) {
  return ACCENT_PAIRS.map(([fg, bg]) => {
    const ratio = contrastRatio(tokenColor(vars, fg), tokenColor(vars, bg));
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

/**
 * @param {string} themeName
 * @param {Record<string, string>} vars
 */
function checkTeamBadges(themeName, vars) {
  return BADGE_TEAM_IDS.map((id) => {
    const ratio = contrastRatio(tokenColor(vars, 'on-accent'), tokenColor(vars, `team-${id}`));
    return { theme: themeName, fg: 'on-accent', bg: `team-${id}`, ratio, min: 4.5, pass: ratio >= 4.5 };
  });
}

const teamRows = [...checkTeamBadges('light', light), ...checkTeamBadges('dark', dark)];

const rows = [
  ...checkTheme('light', light),
  ...checkTheme('dark', dark),
  ...presetRows,
  ...teamRows,
];

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
