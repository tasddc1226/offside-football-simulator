// render.mjs·feature.mjs 공통: Playwright, 문구 마크업, 글꼴, 저장.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

export const { chromium } = createRequire(process.env.PW_FROM)('@playwright/test');
export const here = path.dirname(fileURLToPath(import.meta.url));
export const b64 = (p) => fs.readFileSync(path.join(here, p)).toString('base64');
export const icon = b64('../assets/brand/offside-icon-v7-180.png');
export const frames = JSON.parse(fs.readFileSync(path.join(here, 'frames.json'), 'utf8'));

export const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** `*강조*`는 라임색 em, 줄바꿈은 br. */
export const mark = (s) =>
  esc(s)
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');

export const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&display=block" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet">`;

/** html을 그려 here/out/<rel>로 저장한다. */
export async function shoot(page, html, rel) {
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => globalThis.document.fonts.ready);
  const out = path.join(here, 'out', rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  console.log(out);
}
