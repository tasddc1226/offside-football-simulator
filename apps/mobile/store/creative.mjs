// App Store 크리에이티브 자산(헤더 · 검색 결과): node creative.mjs [ko|en|ja] → out/ios/<lang>/header.png · search.png
// 크기와 아트 안전 영역은 Apple 템플릿(developer.apple.com/app-store/asset-best-practices)을 따른다. CSS 픽셀의 2배로 찍는다.
//   헤더 3840×1646, 안전 영역 1644×658(가운데) · 검색 결과 3840×2560, 안전 영역 2166×1028(가운데)
// 헤더는 브랜드 한 가지(대표 문구), 검색 결과는 무슨 게임인지와 실제 화면을 보여 준다.
import path from 'node:path';
import { chromium, icon, frames, b64, esc, mark, FONTS, shoot } from './lib.mjs';

const SEARCH = {
  ko: {
    h: '축구 선수 커리어,\n*고3부터 은퇴까지*',
    s: '선수를 만들고, 결정적인 순간을 차고, 명예의 전당에 올라요',
  },
  en: {
    h: 'A football career,\n*school to retirement*',
    s: 'Create a player, take the big moments, reach the Hall of Fame',
  },
  ja: {
    h: 'サッカー選手の人生を\n*高校から引退まで*',
    s: '選手をつくり、決定的な瞬間を決め、殿堂入りを目指す',
  },
};

const font = (lang) => (lang === 'ja' ? "'Noto Sans JP'" : 'Pretendard');
// 경기장 배경(줄무늬 · 센터 서클 · 오프사이드 라인)은 화면 전체에 깔고, 글과 화면은 안전 영역 안에 둔다.
const pitch = (w, h, lineX) => `
.st{position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.035) 0 ${w / 12}px,transparent ${w / 12}px ${w / 6}px)}
.hl{position:absolute;left:50%;top:0;bottom:0;width:4px;margin-left:-2px;background:rgba(255,255,255,.08)}
.c{position:absolute;left:50%;top:50%;width:${h * 0.62}px;height:${h * 0.62}px;transform:translate(-50%,-50%);border:4px solid rgba(255,255,255,.08);border-radius:50%}
.line{position:absolute;top:-40px;bottom:-40px;left:${lineX}px;width:10px;background:#E8412C;transform:skewX(-12deg);box-shadow:0 0 40px rgba(232,65,44,.6)}
.e{display:flex;align-items:center;gap:14px;font-family:'Barlow Condensed';font-weight:700;letter-spacing:.16em;color:#D6F24A}
.e img{border-radius:22%}
h1{font-weight:800;letter-spacing:-.03em;line-height:1.1}h1 em{font-style:normal;color:#D6F24A}
p{color:rgba(242,246,241,.8);word-break:keep-all}h1{word-break:keep-all}
.p{position:absolute;border-radius:12%/5.5%;padding:1.2%;background:linear-gradient(145deg,#3a4640,#0a0f0c 40%,#1d2622);box-shadow:0 30px 60px rgba(0,0,0,.5)}
.p div{width:100%;height:100%;border-radius:10.5%/4.8%;background-size:100% 100%}`;
const base = (lang, w, h) =>
  `*{margin:0;box-sizing:border-box}body{width:${w}px;height:${h}px;overflow:hidden;position:relative;font-family:${font(lang)},sans-serif;color:#f2f6f1;background:radial-gradient(80% 110% at 40% 40%,#25603f,#1c4a35 45%,#0b1d14)}`;
const phone = (shot, { left, top, height, rotate, z = 0 }) =>
  `<div class="p" style="z-index:${z};left:${left}px;top:${top}px;height:${height}px;width:${height * 0.46}px;transform:rotate(${rotate}deg)"><div style="background-image:url(data:image/png;base64,${shot})"></div></div>`;

const langs = process.argv[2] ? [process.argv[2]] : ['ko', 'en', 'ja'];
const browser = await chromium.launch();

// 헤더 1920×823(CSS) — 안전 영역 x 549~1371, y 247~576.
const header = await browser.newPage({
  viewport: { width: 1920, height: 823 },
  deviceScaleFactor: 2,
});
for (const lang of langs) {
  const copy = frames[0][lang];
  const size = { ko: 70, en: 54, ja: 58 }[lang];
  const html = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${base(lang, 1920, 823)}${pitch(1920, 823, 1130)}
.t{position:absolute;left:560px;top:270px;width:520px}.e{font-size:24px}.e img{width:46px;height:46px}
h1{margin-top:22px;font-size:${size}px}p{margin-top:16px;font-size:22px}</style></head><body>
<div class="st"></div><div class="hl"></div><div class="c"></div><div class="line"></div>
${phone(b64(`shots/${lang}/03.png`), { left: 1110, top: 262, height: 300, rotate: -6 })}
${phone(b64(`shots/${lang}/07.png`), { left: 1225, top: 250, height: 316, rotate: 5 })}
<div class="t"><div class="e"><img src="data:image/png;base64,${icon}">OFFSIDE</div><h1>${mark(copy.h)}</h1><p>${esc(copy.s)}</p></div>
</body></html>`;
  await shoot(header, html, path.join('ios', lang, 'header.png'));
}

// 검색 결과 1920×1280(CSS) — 안전 영역 x 418~1501, y 383~897.
const search = await browser.newPage({
  viewport: { width: 1920, height: 1280 },
  deviceScaleFactor: 2,
});
for (const lang of langs) {
  const copy = SEARCH[lang];
  const size = { ko: 50, en: 42, ja: 44 }[lang];
  const html = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${base(lang, 1920, 1280)}${pitch(1920, 1280, 905)}
.t{position:absolute;left:430px;top:500px;width:440px}.e{font-size:22px}.e img{width:44px;height:44px}
h1{margin-top:22px;font-size:${size}px}p{margin-top:18px;font-size:22px;line-height:1.45}</style></head><body>
<div class="st"></div><div class="hl"></div><div class="c"></div><div class="line"></div>
${phone(b64(`shots/${lang}/02.png`), { left: 905, top: 410, height: 460, rotate: -4 })}
${phone(b64(`shots/${lang}/03.png`), { left: 1100, top: 395, height: 480, rotate: 0, z: 2 })}
${phone(b64(`shots/${lang}/07.png`), { left: 1295, top: 410, height: 460, rotate: 4 })}
<div class="t"><div class="e"><img src="data:image/png;base64,${icon}">OFFSIDE</div><h1>${mark(copy.h)}</h1><p>${esc(copy.s)}</p></div>
</body></html>`;
  await shoot(search, html, path.join('ios', lang, 'search.png'));
}
await browser.close();
