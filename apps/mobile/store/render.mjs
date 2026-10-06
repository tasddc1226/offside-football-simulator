// 스토어 미리보기 이미지 렌더러: node render.mjs [ko|en] [ios|android] [장 번호]
// shots/<lang>/0N.png(실제 앱 화면) + frames.json(문구) → out/<platform>/<lang>/0N.png
import fs from 'node:fs';
import path from 'node:path';
import { chromium, here, icon, frames, esc, mark, FONTS, shoot } from './lib.mjs';

const langs = process.argv[2] ? [process.argv[2]] : ['ko', 'en'];
const plats = process.argv[3] ? [process.argv[3]] : ['ios', 'android'];
const only = process.argv[4] ? +process.argv[4] : 0;

const SIZE = { ios: [1320, 2868], android: [1080, 2160] };
const name = (i) => `${String(i + 1).padStart(2, '0')}.png`;

function html(f, lang, plat, img) {
  const [W, H] = SIZE[plat];
  const u = W / 1320; // 기준 폭 1320
  const tall = plat === 'ios';
  const phoneW = (tall ? 1010 : 800) * u;
  const phoneH = (phoneW * SIZE.ios[1]) / SIZE.ios[0]; // 화면은 iOS 스크린샷 비율
  const bez = 22 * u;
  const top = (tall ? 720 : 560) * u;
  const t = f[lang];
  return `<!doctype html><html><head><meta charset="utf-8">
${FONTS}
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{position:relative;font-family:Pretendard,'Apple SD Gothic Neo',sans-serif;color:#f2f6f1;
 background:radial-gradient(120% 70% at 50% 18%,#25603f 0%,#1c4a35 38%,#12301f 72%,#0b1d14 100%)}
.stripes{position:absolute;inset:0;background:repeating-linear-gradient(180deg,rgba(255,255,255,.035) 0 ${180 * u}px,transparent ${180 * u}px ${360 * u}px)}
.chalk{position:absolute;inset:0}
.chalk svg{width:100%;height:100%}
.line{position:absolute;top:-10%;height:120%;width:${12 * u}px;left:${(f.lineX ?? 0.78) * W}px;background:#E8412C;transform:skewX(-12deg);
 box-shadow:0 0 ${40 * u}px rgba(232,65,44,.55);opacity:.95}
.head{position:absolute;left:${96 * u}px;right:${96 * u}px;top:${(tall ? 150 : 96) * u}px}
.eyebrow{display:flex;align-items:center;gap:${18 * u}px;font-family:'Barlow Condensed';font-weight:700;letter-spacing:.16em;font-size:${40 * u}px;color:#D6F24A;text-transform:uppercase}
.eyebrow img{width:${64 * u}px;height:${64 * u}px;border-radius:${15 * u}px}
.eyebrow .no{color:rgba(242,246,241,.55)}
h1{margin-top:${30 * u}px;font-weight:800;font-size:${(lang === 'ko' ? 138 : 118) * u}px;line-height:1.12;letter-spacing:${lang === 'ko' ? '-0.035em' : '-0.02em'};word-break:keep-all}
h1 em{font-style:normal;color:#D6F24A}
p.sub{margin-top:${26 * u}px;font-size:${46 * u}px;font-weight:500;color:rgba(242,246,241,.78);letter-spacing:-0.01em;word-break:keep-all}
.phone{position:absolute;left:${(W - phoneW) / 2}px;top:${top}px;width:${phoneW}px;height:${phoneH}px;border-radius:${150 * u}px;
 background:linear-gradient(145deg,#3a4640,#0a0f0c 40%,#1d2622);padding:${bez}px;
 box-shadow:0 ${60 * u}px ${140 * u}px rgba(0,0,0,.55),0 0 0 ${3 * u}px rgba(255,255,255,.08) inset}
.screen{width:100%;height:100%;border-radius:${128 * u}px;overflow:hidden;position:relative;background:#000}
.screen img{width:100%;height:100%;display:block}
.island{position:absolute;top:${24 * u}px;left:50%;transform:translateX(-50%);width:${250 * u}px;height:${72 * u}px;border-radius:${40 * u}px;background:#000}
.fade{position:absolute;left:0;right:0;bottom:0;height:${220 * u}px;background:linear-gradient(180deg,transparent,rgba(11,29,20,.85))}
</style></head><body>
<div class="stripes"></div>
<div class="chalk"><svg viewBox="0 0 ${W} ${H}" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="${6 * u}">
 <line x1="0" y1="${H * 0.56}" x2="${W}" y2="${H * 0.56}"/><circle cx="${W / 2}" cy="${H * 0.56}" r="${330 * u}"/></svg></div>
<div class="line"></div>
<div class="head"><div class="eyebrow"><img src="data:image/png;base64,${icon}"><span>OFFSIDE</span><span class="no">· ${f.eyebrow}</span></div>
<h1>${mark(t.h)}</h1><p class="sub">${esc(t.s)}</p></div>
<div class="phone"><div class="screen"><img src="data:image/png;base64,${img}"><div class="island"></div></div></div>
<div class="fade"></div>
</body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const plat of plats)
  for (const lang of langs)
    for (const [i, f] of frames.entries()) {
      if (only && only !== i + 1) continue;
      const src = path.join(here, 'shots', lang, name(i));
      if (!fs.existsSync(src)) {
        console.log('skip', src);
        continue;
      }
      const [W, H] = SIZE[plat];
      await page.setViewportSize({ width: W, height: H });
      const img = fs.readFileSync(src).toString('base64');
      await shoot(page, html(f, lang, plat, img), path.join(plat, lang, name(i)));
    }
await browser.close();
