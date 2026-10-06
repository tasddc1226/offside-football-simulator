// Google Play 그래픽 이미지 1024×500: node feature.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(process.env.PW_FROM);
const { chromium } = require('@playwright/test');
const here = path.dirname(fileURLToPath(import.meta.url));
const b64 = (p) => fs.readFileSync(path.join(here, p)).toString('base64');
// 문구는 미리보기 첫 장(frames.json)과 같다.
const first = JSON.parse(fs.readFileSync(path.join(here, 'frames.json'), 'utf8'))[0];
const mark = (s) => s.replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
const COPY = Object.fromEntries(
  ['ko', 'en'].map((l) => [l, { h: mark(first[l].h), s: first[l].s }]),
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
for (const lang of ['ko', 'en']) {
  const a = b64(`shots/${lang}/07.png`),
    b = b64(`shots/${lang}/03.png`);
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&display=block" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet">
<style>*{margin:0;box-sizing:border-box}body{width:1024px;height:500px;overflow:hidden;position:relative;font-family:Pretendard,sans-serif;color:#f2f6f1;
background:radial-gradient(90% 120% at 25% 30%,#25603f,#1c4a35 45%,#0b1d14)}
.st{position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.035) 0 80px,transparent 80px 160px)}
.c{position:absolute;left:250px;top:50%;width:420px;height:420px;margin:-210px;border:4px solid rgba(255,255,255,.1);border-radius:50%}
.hl{position:absolute;left:250px;top:0;bottom:0;width:4px;background:rgba(255,255,255,.1)}
.line{position:absolute;top:-20px;bottom:-20px;left:640px;width:8px;background:#E8412C;transform:skewX(-12deg);box-shadow:0 0 30px rgba(232,65,44,.6)}
.t{position:absolute;left:64px;top:110px;width:540px}
.e{display:flex;align-items:center;gap:12px;font-family:'Barlow Condensed';font-weight:700;letter-spacing:.16em;font-size:26px;color:#D6F24A}
.e img{width:48px;height:48px;border-radius:11px}
h1{margin-top:22px;font-size:${lang === 'ko' ? 64 : 54}px;line-height:1.1;font-weight:800;letter-spacing:-.03em}
h1 em{font-style:normal;color:#D6F24A}p{margin-top:16px;font-size:24px;color:rgba(242,246,241,.78)}
.p{position:absolute;width:250px;height:543px;border-radius:40px;padding:7px;background:linear-gradient(145deg,#3a4640,#0a0f0c 40%,#1d2622);box-shadow:0 30px 60px rgba(0,0,0,.5)}
.p div{width:100%;height:100%;border-radius:34px;background-size:100% 100%}
</style></head><body><div class="st"></div><div class="hl"></div><div class="c"></div><div class="line"></div>
<div class="p" style="left:650px;top:70px;transform:rotate(-6deg)"><div style="background-image:url(data:image/png;base64,${b})"></div></div>
<div class="p" style="left:800px;top:40px;transform:rotate(5deg)"><div style="background-image:url(data:image/png;base64,${a})"></div></div>
<div class="t"><div class="e"><img src="data:image/png;base64,${b64('../assets/brand/offside-icon-v7-180.png')}">OFFSIDE</div><h1>${COPY[lang].h}</h1><p>${COPY[lang].s}</p></div>
</body></html>`,
    { waitUntil: 'networkidle' },
  );
  await page.evaluate(() => globalThis.document.fonts.ready);
  const out = path.join(here, 'out', 'android', lang, 'feature-graphic.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  console.log(out);
}
await browser.close();
