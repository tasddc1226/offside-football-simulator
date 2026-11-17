// T-11-584 앱 · 웹 소개 페이지(/app/, /en/app/, /ja/app/, /zh/app/). 광고 · 크리에이터 · 검색 유입을 받아 스토어나 웹 게임으로 보낸다.
// 게임 셸(index.html)을 쓰지 않는 독립 문서다: 앱 번들 · 사이트 CSS 없이 이 파일의 CSS와 짧은 스크립트만 싣는다.
// 스토어 버튼은 워커의 /get(기기 · 유입 캠페인에 맞는 스토어 주소로 302)으로, 웹 버튼은 게임(/)으로 간다.
// 문구는 언어마다 packages/app-core/src/i18n/<언어>/publicLanding.mjs에 있다.
import ko from '../../../packages/app-core/src/i18n/ko/publicLanding.mjs';
import en from '../../../packages/app-core/src/i18n/en/publicLanding.mjs';
import ja from '../../../packages/app-core/src/i18n/ja/publicLanding.mjs';
import zh from '../../../packages/app-core/src/i18n/zh/publicLanding.mjs';

/**
 * 화면에 보이는 App Store 평점 · 평가 수(구조화 데이터 평점도 같은 값). 기준일 · 명예의 전당 인원은 각 언어 문구의 asOf · legends.
 * 바꿀 때는 App Store(한국) · /v1/hof 값을 다시 확인하고 네 언어 문구의 asOf · legends도 같이 고친다.
 */
export const LANDING_STATS = { rating: 4.8, ratingCount: 254 };

/** 언어별 소개 페이지. 한국어는 지금 주소(/app/), 다른 언어는 /<언어>/app/. html은 <html lang>. */
export const LANDING_LOCALES = {
  ko: { path: '/app/', html: 'ko', copy: ko },
  en: { path: '/en/app/', html: 'en', copy: en },
  ja: { path: '/ja/app/', html: 'ja', copy: ja },
  zh: { path: '/zh/app/', html: 'zh-Hant', copy: zh },
};
/** 언어 고르기에 쓰는 각 언어 자기 이름. */
const LANG_NAMES = { ko: '한국어', en: 'English', ja: '日本語', zh: '繁體中文' }; // i18n-ignore 언어 자기 이름
/** 언어마다 그 언어 가이드 · FAQ 주소(공략 · 공정성 · 소개 · 약관은 한국어 한 벌). */
const guidePrefix = (lang) => (lang === 'ko' ? '' : `/${lang}`);

const SHOT_KEYS = ['season', 'live', 'pk', 'credits'];
/** 그 언어 게임 화면으로 찍은 스크린샷이 있는 언어(public/landing/<언어>/, e2e/landing-shots.spec.ts). 없으면 한국어 화면. */
const SHOT_LANGS = new Set(['ja']);
const shotDir = (lang) => (SHOT_LANGS.has(lang) ? `/landing/${lang}/` : '/landing/');

/** 유입 캠페인이 없을 때 붙이는 랜딩 꼬리표(contracts/acquisition CAMPAIGNS에 있는 값). */
export const LANDING_UTM = {
  utm_source: 'landing',
  utm_medium: 'web',
  utm_campaign: 'app_landing',
};
const webHref = (place) =>
  `/?${new URLSearchParams({ ...LANDING_UTM, utm_content: `lp_${place}` })}`;
const getHref = (os, place) => `/get?os=${os}&amp;p=${place}`;
const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

const icon = {
  ios: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.4 2-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.8-3.5.8s-1.8-.8-3-.8C6.9 7.2 5.4 8.1 4.6 9.6c-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.7 2.4 3 2.4 1.2-.1 1.6-.8 3.1-.8 1.4 0 1.8.8 3.1.8 1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7 0 0-2.5-1-2.8-4zM14.1 5.5c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.7-1.3z"/></svg>',
  android:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#34a853" d="M4 2.8v18.4c0 .4.4.6.7.4l10.6-9.2L4.7 2.4c-.3-.2-.7 0-.7.4z"/><path fill="#fbbc04" d="m19.4 9.9 2.1 1.2c.6.4.6 1.2 0 1.6l-2.1 1.2-2.4-2z"/><path fill="#ea4335" d="M16.5 12.8 6.8 21.3l11.5-6.6z"/><path fill="#4285f4" d="M16.5 11.2 6.8 2.7l11.5 6.6z"/></svg>',
  web: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path fill="currentColor" d="m12 7.5 3.4 2.5-1.3 4h-4.2l-1.3-4z"/></svg>',
};
const ctas = (c, place) =>
  `<div class="ctas"><a class="btn web" data-web href="${webHref(place).replaceAll('&', '&amp;')}">${icon.web}<span><small>${c.webSmall}</small>${c.web}</span></a><a class="btn store ios" data-store href="${getHref('ios', place)}">${icon.ios}<span><small>Download on the</small>App Store</span></a><a class="btn store android" data-store href="${getHref('android', place)}">${icon.android}<span><small>GET IT ON</small>Google Play</span></a></div>`;

// 표시 폭은 첫 화면 겹친 사진 150~210px, 갤러리 휴대폰 56vw · PC 260px 안팎이라 320px 판을 먼저 쓴다(T-11-585).
const shot = (dir, key, alt, lazy) =>
  `<img src="${dir}${key}-320.webp" srcset="${dir}${key}-320.webp 320w, ${dir}${key}.webp 540w" sizes="${lazy ? '(min-width: 820px) 260px, 56vw' : '(min-width: 820px) 210px, 150px'}" width="540" height="1169" alt="${alt}"${lazy ? ' loading="lazy"' : ' fetchpriority="high"'} decoding="async">`;

const langNav = (lang) =>
  `<nav class="langs" aria-label="Language">${Object.entries(LANDING_LOCALES)
    .map(
      ([l, { path, html }]) =>
        `<a href="${path}" hreflang="${html}" lang="${html}"${l === lang ? ' aria-current="page"' : ''}>${LANG_NAMES[l]}</a>`,
    )
    .join('')}</nav>`;

export const landingBody = (lang = 'ko') => {
  const { path: home, copy: c } = LANDING_LOCALES[lang];
  const gp = guidePrefix(lang);
  const dir = shotDir(lang);
  const vars = { legends: c.legends };
  const sticker = `<span><b>${c.sticker[0]}</b>${c.sticker[1]}<br>${c.sticker[2]}</span>`;
  return `<a class="skip" href="#main">${c.skip}</a>
<nav class="nav"><a class="mini" href="${home}">OFFSIDE</a><a class="play-top" href="${webHref('nav').replaceAll('&', '&amp;')}" data-web>${c.playTop}</a></nav>
<main id="main">
<header class="hero">
  <div class="sticker" aria-hidden="true">${sticker}</div>
  <p class="logo" role="img" aria-label="${c.logoLabel}">Offside<span>Full Time</span></p>
  <p class="subtitle">${c.subtitle}</p>
  <h1 class="pitch-line">${c.h1}<small>${c.h1Small}</small></h1>
  ${ctas(c, 'hero')}
  <div class="qr"><img src="/landing/qr-get.svg" width="76" height="76" alt=""><p><b>${c.qrTitle}</b>${c.qrBody}</p></div>
  <div class="stack" aria-hidden="true">${SHOT_KEYS.filter((k) => k !== 'pk')
    .map((k) => `<figure>${shot(dir, k, '', false)}</figure>`)
    .join('')}</div>
</header>
<div class="ticker" aria-hidden="true"><div class="row">${[...c.ticker, ...c.ticker].map((t) => `<span>${t}</span>`).join('')}</div></div>
<section class="sec">
  <p class="tag">${c.path.tag}</p>
  <h2>${c.path.title}</h2>
  <p class="lead">${c.path.lead}</p>
  <ol class="path">${c.path.items.map(([age, h, p]) => `<li><span class="age">${age}</span><h3>${h}</h3><p>${fill(p, vars)}</p></li>`).join('')}</ol>
</section>
<section class="after">
  <p class="tag">${c.after.tag}</p>
  <h2>${c.after.title}</h2>
  <p class="lead">${c.after.lead}</p>
  <div class="cards">${c.after.items.map(([h, p], i) => `<div><span class="ic">0${i + 1}</span><h3>${h}</h3><p>${p}</p></div>`).join('')}</div>
</section>
<section class="sec">
  <p class="tag">${c.reviews.tag}</p>
  <h2>${c.reviews.title}</h2>
  <div class="quotes">${c.reviews.items.map(([q, d]) => `<blockquote><div class="st" aria-label="${c.reviews.stars}">★★★★★</div><p>“${q}”</p><cite>${fill(c.reviews.cite, { date: d })}</cite></blockquote>`).join('')}</div>
  <div class="score"><span><b>${LANDING_STATS.rating}</b> ${fill(c.reviews.score, { count: LANDING_STATS.ratingCount, asOf: c.asOf })}</span><span>${c.reviews.note}</span></div>
</section>
<section class="sec">
  <p class="tag">${c.shots.tag}</p>
  <h2>${c.shots.title}</h2>
  ${c.shots.note ? `<p class="lead">${c.shots.note}</p>` : ''}
  <div class="gallery">${SHOT_KEYS.map((k) => `<figure><div class="ph">${shot(dir, k, c.shots.items[k][1], true)}</div><figcaption>${c.shots.items[k][0]}</figcaption></figure>`).join('')}</div>
</section>
<div class="duo">
  <section class="sec">
    <p class="tag">${c.where.tag}</p>
    <h2>${c.where.title}</h2>
    <p class="where">${fill(c.where.body, { guide: `${gp}/guide/` })}</p>
  </section>
  <section class="sec">
    <p class="tag">${c.faq.tag}</p>
    <h2>${c.faq.title}</h2>
    <div class="faq">${c.faq.items.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>
  </section>
</div>
<div class="last"><h2>Kick off</h2><p>${c.last}</p>${ctas(c, 'end')}</div>
</main>
<footer class="foot"><p class="made">made by Offside Lab</p>${langNav(lang)}<a href="${gp}/guide/">${c.foot.guide}</a><a href="${gp}/faq/">${c.foot.faq}</a><a href="/fairness/">${c.foot.fairness}</a><a href="/about/">${c.foot.about}</a><a href="/legal/terms/">${c.foot.terms}</a><a href="/legal/privacy/">${c.foot.privacy}</a></footer>
<div class="dock" aria-hidden="true">${ctas(c, 'dock').replace('<div class="ctas">', '<div class="ctas" inert>')}</div>`;
};

/**
 * 화면 손글씨 · 포스터 제목 글꼴은 이 페이지에 쓰는 글자만 받는다(Google Fonts text=). 한국어 · 영어는 Black Han Sans · Gaegu,
 * 일본어는 같은 느낌의 Dela Gothic One · Yusei Magic. 번체 중국어는 맞는 글꼴이 없어 시스템 굵은 글꼴로 둔다.
 */
const DISPLAY_FONTS = {
  ko: 'family=Black+Han+Sans&family=Gaegu:wght@700',
  en: 'family=Black+Han+Sans&family=Gaegu:wght@700',
  ja: 'family=Dela+Gothic+One&family=Yusei+Magic',
};
function fontHref(body, lang) {
  if (!DISPLAY_FONTS[lang]) return null;
  const text = [
    ...new Set(
      body
        .replace(/<[^>]+>/g, '')
        .replace(/&[a-z]+;/g, '')
        .replace(/\s/g, ''),
    ),
  ]
    .sort()
    .join('');
  const q = encodeURIComponent(text);
  return `https://fonts.googleapis.com/css2?${DISPLAY_FONTS[lang]}&display=swap&text=${q}`;
}

// 기기 표시(휴대폰은 그 기기 스토어만) · 유입 캠페인 넘기기 · 첫 화면 지나면 아래 버튼 띄우기.
// 기기는 그리기 전에(head) 정해 버튼이 바뀌며 깜빡이지 않게 한다. iPadOS는 Mac으로 보이므로 터치로 가른다.
// 소개 페이지를 본 기기는 표시(offside_lp_seen)를 남겨 게임 셸이 광고 유입을 다시 이 페이지로 보내지 않게 한다(index.html).
const OS_SCRIPT = `(()=>{const d=document.documentElement,u=navigator.userAgent;d.dataset.os=/iPhone|iPad|iPod/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1)?'ios':/Android/.test(u)?'android':'other';try{localStorage.setItem('offside_lp_seen','1')}catch(e){}})();`;
const SCRIPT = `(()=>{const q=new URLSearchParams(location.search);
if(q.get('utm_source')){const keep=['utm_source','utm_medium','utm_campaign','utm_content'];
for(const a of document.querySelectorAll('[data-web],[data-store]')){const url=new URL(a.href);
for(const k of keep){if(a.hasAttribute('data-web'))url.searchParams.delete(k);const v=q.get(k);if(v)url.searchParams.set(k,v)}a.href=url.pathname+url.search}}
const dock=document.querySelector('.dock'),hero=document.querySelector('.hero .ctas'),end=document.querySelector('.last .ctas');
if(!dock||!('IntersectionObserver'in window))return;let past=false,atEnd=false;
const sync=()=>{const on=past&&!atEnd;dock.classList.toggle('on',on);dock.toggleAttribute('aria-hidden',!on);dock.querySelector('.ctas').inert=!on};
new IntersectionObserver(([e])=>{past=!e.isIntersecting&&e.boundingClientRect.top<0;sync()}).observe(hero);
new IntersectionObserver(([e])=>{atEnd=e.isIntersecting;sync()}).observe(end)})();`;

/**
 * Meta 픽셀(웹 광고 측정, 개인정보처리방침 8항). 게임 셸(src/analytics/meta.ts)과 같은 규칙: 운영 호스트에서만, 광고 측정을 거절하지 않았고
 * 동의했거나(유럽 · 영국 · 스위스는 동의해야만) 알린 뒤 기본으로 켜는 지역(워커가 붙인 offside_consent_region=notice)일 때만 불러온다.
 * 이 페이지는 동의 값을 쓰지 않는다. 보내는 것은 페이지 조회와 스토어 버튼 클릭뿐이고 자동 수집은 끈다.
 * 메타 캠페인이 '랜딩 페이지 조회'로 최적화하므로 광고 유입을 이 페이지로 보낼 때도 조회가 잡혀야 한다.
 */
const pixelScript = ({ id, host }) =>
  `(()=>{if(location.hostname!==${JSON.stringify(host)})return;let a,c;try{a=localStorage.getItem('offside_ad_consent_v1');c=localStorage.getItem('offside_analytics_consent_v1')}catch(e){return}
const notice=document.cookie.split(';').some((x)=>x.trim()==='offside_consent_region=notice');
if(a==='denied'||c==='denied'||!(a==='granted'||notice))return;
const q=function(){q.callMethod?q.callMethod.apply(q,arguments):q.queue.push(arguments)};q.push=q;q.loaded=true;q.version='2.0';q.queue=[];window.fbq=window.fbq||q;window._fbq=window._fbq||q;
fbq('set','autoConfig',false,'${id}');fbq('init','${id}');fbq('track','PageView');
const s=document.createElement('script');s.async=true;s.src='https://connect.facebook.net/en_US/fbevents.js';document.head.append(s);
document.addEventListener('click',(e)=>{if(e.target instanceof Element&&e.target.closest('[data-store]'))fbq('trackCustom','AppStoreClick')})})();`;
/** 픽셀 ID · 운영 호스트가 둘 다 바른 빌드에서만 픽셀을 싣는다. */
const validPixel = (pixel) =>
  pixel &&
  /^\d{6,20}$/.test(String(pixel.id ?? '')) &&
  /^[a-z0-9.-]+$/.test(String(pixel.host ?? ''));

const CSS = `:root{--cream:#f4ecd6;--paper:#fffaf0;--ink:#17201a;--ink-2:#4a5148;--pitch:#1d4a35;--pitch-2:#2a6247;--gold:#f2b632;--red:#a8361a;
--display:'Barlow Condensed','Arial Narrow',sans-serif;--body:'Pretendard Variable',Pretendard,-apple-system,'Apple SD Gothic Neo',system-ui,sans-serif;
--hand:'Gaegu',var(--body);--poster:'Black Han Sans',var(--body);color-scheme:light}
html[lang=ja]{--hand:'Yusei Magic',var(--body);--poster:'Dela Gothic One',var(--body)}
html[lang=zh-Hant]{--hand:var(--body);--poster:var(--body)}
html[lang=zh-Hant] .sec h2,html[lang=zh-Hant] .after h2,html[lang=zh-Hant] .quotes p,html[lang=zh-Hant] .path h3,html[lang=zh-Hant] .cards h3,html[lang=zh-Hant] .subtitle{font-weight:900}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--cream);color:var(--ink);font:16px/1.6 var(--body);overflow-x:hidden}
body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.45;mix-blend-mode:multiply;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .35 0 0 0 0 .3 0 0 0 0 .2 0 0 0 .22 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")}
body>*{position:relative;z-index:1}
a{color:inherit}
:focus-visible{outline:3px solid var(--red);outline-offset:3px}
h1,h2,h3{font-weight:400}
img{max-width:100%}
.skip{position:absolute;left:-999px;top:8px;background:var(--ink);color:var(--cream);padding:8px 12px;z-index:9}.skip:focus{left:8px}
.nav{display:flex;align-items:center;justify-content:space-between;padding:14px max(16px,env(safe-area-inset-right)) 14px max(16px,env(safe-area-inset-left))}
.mini{font-family:var(--display);font-weight:800;font-style:italic;font-size:22px;letter-spacing:.02em;text-decoration:none}
.play-top{font-weight:800;font-size:14px;text-decoration:none;border:2px solid var(--ink);border-radius:999px;padding:6px 12px;background:var(--paper)}
.hero{margin:4px 12px 0;border:3px solid var(--ink);border-radius:18px;background:var(--pitch);color:var(--cream);padding:28px 16px 0;text-align:center;box-shadow:6px 6px 0 var(--ink);position:relative;overflow:hidden}
.hero::before{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,transparent 0 38px,rgba(255,255,255,.05) 38px 76px),radial-gradient(circle at 50% 46%,transparent 92px,rgba(244,236,214,.3) 93px 96px,transparent 97px),linear-gradient(transparent calc(46% - 2px),rgba(244,236,214,.3) calc(46% - 2px) calc(46% + 1px),transparent calc(46% + 1px))}
.hero>*{position:relative}
.logo{margin:0;font-family:var(--display);font-weight:800;font-style:italic;text-transform:uppercase;line-height:.8;font-size:clamp(60px,19vw,74px);letter-spacing:-.01em;color:var(--gold);text-shadow:3px 3px 0 var(--ink),-1px -1px 0 var(--ink),1px -1px 0 var(--ink),-1px 1px 0 var(--ink);transform:rotate(-3deg)}
.logo span{display:block;font-size:.5em;color:var(--cream);letter-spacing:.04em;margin-top:6px}
.subtitle{display:inline-block;margin:16px 0 0;font-family:var(--poster);font-size:19px;background:var(--cream);color:var(--ink);padding:4px 12px 2px;border:2px solid var(--ink);transform:rotate(1.5deg)}
.pitch-line{margin:16px auto 0;max-width:30em;font-family:var(--body);font-weight:800;font-size:18px;line-height:1.4;color:var(--cream);text-wrap:balance}
.pitch-line small{display:block;margin-top:6px;font-size:15px;font-weight:400;color:rgba(244,236,214,.88)}
.ctas{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px auto 0;max-width:660px}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;padding:0 12px;border-radius:12px;border:3px solid var(--ink);text-decoration:none;font-weight:800;font-size:15px;line-height:1.1;box-shadow:4px 4px 0 var(--ink);transition:transform .12s,box-shadow .12s;text-align:left;color:var(--ink);background:var(--paper)}
.btn:hover{transform:translate(2px,2px);box-shadow:2px 2px 0 var(--ink)}
.btn svg{width:22px;height:22px;flex:none}
.btn small{display:block;font-size:10.5px;font-weight:600;opacity:.75}
.btn.web{background:var(--gold)}
html[data-os=ios] .btn.android,html[data-os=android] .btn.ios{display:none}
html[data-os=other] .ctas,html:not([data-os]) .ctas{grid-template-columns:1fr}
.qr{display:none}
.sticker{position:absolute;z-index:3;bottom:200px;right:10px;width:78px;height:78px;border-radius:50%;background:var(--red);color:var(--cream);border:3px solid var(--ink);display:grid;place-items:center;text-align:center;font:800 13px/1.05 var(--display);letter-spacing:.04em;transform:rotate(12deg);box-shadow:3px 3px 0 var(--ink)}
.sticker b{display:block;font-size:22px}
.stack{position:relative;height:270px;margin-top:22px}
.stack figure{position:absolute;bottom:-30px;margin:0;width:150px;border:3px solid var(--ink);border-radius:14px;overflow:hidden;background:#000;box-shadow:4px 4px 0 var(--ink)}
.stack img{display:block;width:100%;height:auto;aspect-ratio:9/15;object-fit:cover;object-position:top}
.stack figure:nth-child(1){left:calc(50% - 175px);transform:rotate(-9deg);bottom:-60px}
.stack figure:nth-child(2){left:calc(50% - 75px);z-index:2}
.stack figure:nth-child(3){left:calc(50% + 25px);transform:rotate(8deg);bottom:-60px}
.ticker{margin:22px -10px 0;background:var(--ink);color:var(--cream);overflow:hidden;transform:rotate(-1.2deg)}
.ticker .row{display:flex;gap:28px;width:max-content;padding:10px 0;animation:tick 40s linear infinite;font-family:var(--poster);font-size:16px;white-space:nowrap}
.ticker span::before{content:"★ ";color:var(--gold)}
@keyframes tick{to{transform:translateX(-50%)}}
.sec{padding:40px max(16px,env(safe-area-inset-right)) 4px max(16px,env(safe-area-inset-left))}
.tag{display:inline-block;margin:0 0 2px;font-family:var(--hand);font-size:20px;color:var(--red);transform:rotate(-2deg)}
.sec h2,.after h2{margin:0 0 6px;font-family:var(--poster);font-size:30px;line-height:1.15;letter-spacing:-.01em;text-wrap:balance}
.lead{margin:0 0 18px;color:var(--ink-2);font-size:15px;max-width:34em}
.path{list-style:none;margin:0;padding:0;display:grid;gap:14px}
.path li{border:3px solid var(--ink);border-radius:14px;background:var(--paper);padding:14px 14px 14px 64px;position:relative;box-shadow:4px 4px 0 var(--ink)}
.path li:nth-child(even){transform:rotate(.6deg)}.path li:nth-child(odd){transform:rotate(-.5deg)}
.path .age{position:absolute;left:10px;top:12px;width:44px;height:44px;border-radius:50%;border:3px solid var(--ink);background:var(--gold);display:grid;place-items:center;font:800 20px/1 var(--display)}
.path li:last-child .age{background:var(--red);color:var(--cream)}
.path h3{margin:0;font-family:var(--poster);font-size:18px}.path p{margin:3px 0 0;font-size:14px;color:var(--ink-2)}
.after{background:var(--pitch);color:var(--cream);margin-top:40px;padding:40px max(16px,env(safe-area-inset-right)) 44px max(16px,env(safe-area-inset-left));border-block:3px solid var(--ink)}
.after .tag{color:var(--gold)}.after .lead{color:rgba(244,236,214,.85)}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.cards>div{background:var(--cream);color:var(--ink);border:3px solid var(--ink);border-radius:12px;padding:12px;box-shadow:4px 4px 0 var(--ink)}
.cards .ic{display:block;font:800 26px/1 var(--display);color:var(--pitch-2)}
.cards h3{margin:6px 0 2px;font-family:var(--poster);font-size:17px}.cards p{margin:0;font-size:13px;color:var(--ink-2);line-height:1.5}
.quotes{display:grid;gap:16px;margin-top:8px}
.quotes blockquote{margin:0;background:var(--paper);border:3px solid var(--ink);border-radius:14px;padding:16px;box-shadow:4px 4px 0 var(--ink);position:relative}
.quotes blockquote:nth-child(3n+1){transform:rotate(-.8deg)}.quotes blockquote:nth-child(3n+2){transform:rotate(.7deg);background:#fff3c4}.quotes blockquote:nth-child(3n){background:#dff0ea}
.quotes blockquote::before{content:"";position:absolute;top:-12px;left:50%;width:70px;height:20px;margin-left:-35px;background:rgba(242,182,50,.75);transform:rotate(-3deg)}
.st{color:var(--red);font-size:14px;letter-spacing:2px}
.quotes p{margin:4px 0 8px;font-family:var(--poster);font-size:19px;line-height:1.35}
.quotes cite{font-style:normal;font-size:12.5px;color:var(--ink-2)}
.score{margin-top:18px;display:flex;flex-wrap:wrap;gap:10px}
.score span{border:2px solid var(--ink);border-radius:999px;padding:5px 12px;font-size:13px;font-weight:700;background:var(--paper)}
.score b{font-family:var(--display);font-size:17px}
.gallery{display:grid;grid-auto-flow:column;grid-auto-columns:56%;gap:14px;overflow-x:auto;padding:10px 4px 14px;scroll-snap-type:x mandatory}
.gallery figure{margin:0;scroll-snap-align:start;background:var(--paper);border:3px solid var(--ink);border-radius:12px;padding:8px 8px 10px;box-shadow:4px 4px 0 var(--ink)}
.gallery figure:nth-child(odd){transform:rotate(-1.5deg)}.gallery figure:nth-child(even){transform:rotate(1.2deg)}
.ph{border:2px solid var(--ink);border-radius:6px;overflow:hidden;aspect-ratio:9/15;background:#000}
.ph img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.gallery figcaption{font-family:var(--hand);font-size:19px;text-align:center;margin-top:6px;line-height:1.1}
.where{margin:0 0 18px;font-size:15px;color:var(--ink-2)}
.faq{display:grid;gap:10px}
.faq details{border:3px solid var(--ink);border-radius:12px;background:var(--paper);padding:12px 14px}
.faq summary{font-weight:800;cursor:pointer;font-size:15px}
.faq p{margin:6px 0 0;font-size:14px;color:var(--ink-2)}
.last{margin:44px 12px 0;border:3px solid var(--ink);border-radius:18px;background:var(--gold);padding:28px 16px;text-align:center;box-shadow:6px 6px 0 var(--ink)}
.last h2{margin:0;font-family:var(--display);font-weight:800;font-style:italic;font-size:56px;line-height:.9;text-transform:uppercase;text-shadow:3px 3px 0 var(--cream)}
.last p{margin:8px 0 0;font-weight:700}
.last .btn.web{background:var(--cream)}
.foot{padding:24px 16px calc(100px + env(safe-area-inset-bottom));font-size:13px;color:var(--ink-2);display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:center}
.made{width:100%;margin:0;text-align:center;font-family:var(--hand);font-size:18px;color:var(--ink)}
.langs{width:100%;display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin:4px 0 8px}
.langs a{border:2px solid var(--ink);border-radius:999px;padding:3px 10px;background:var(--paper);text-decoration:none;font-weight:700;color:var(--ink)}
.langs a[aria-current]{background:var(--ink);color:var(--cream)}
.dock{position:fixed;left:0;right:0;bottom:0;z-index:5;padding:10px max(12px,env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));background:var(--cream);border-top:3px solid var(--ink);transform:translateY(110%);transition:transform .25s;visibility:hidden}
.dock.on{transform:none;visibility:visible}
.dock .ctas{margin:0}.dock .btn{min-height:46px;box-shadow:3px 3px 0 var(--ink)}
html[data-os=other] .dock{display:none}
@media (prefers-reduced-motion:reduce){.ticker .row{animation:none}.btn,.dock{transition:none}}
@media (min-width:820px){
.nav{padding:20px 40px}
.hero{margin:6px 40px 0;padding:56px 40px 0;border-radius:26px}
.hero::before{background:repeating-linear-gradient(90deg,transparent 0 80px,rgba(255,255,255,.045) 80px 160px),radial-gradient(circle at 50% 40%,transparent 150px,rgba(244,236,214,.3) 151px 155px,transparent 156px),linear-gradient(90deg,transparent calc(50% - 2px),rgba(244,236,214,.3) calc(50% - 2px) calc(50% + 2px),transparent calc(50% + 2px))}
.logo{font-size:168px}.subtitle{font-size:26px;margin-top:22px}.pitch-line{font-size:24px;max-width:30em}.pitch-line small{font-size:17px}
.ctas,html[data-os=other] .ctas,html:not([data-os]) .ctas{grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:14px}
.btn{min-height:58px;font-size:16px}
html[data-os=other] .qr,html:not([data-os]) .qr{display:inline-flex;align-items:center;gap:12px;margin-top:18px;background:var(--cream);color:var(--ink);border:3px solid var(--ink);border-radius:12px;padding:8px 14px 8px 8px;box-shadow:4px 4px 0 var(--ink);text-align:left;transform:rotate(-1deg)}
.qr img{width:76px;height:76px;flex:none}
.qr p{margin:0;font-size:13px;color:var(--ink-2)}.qr p b{display:block;font-family:var(--hand);font-size:22px;color:var(--ink);line-height:1}
.sticker{width:120px;height:120px;top:40px;bottom:auto;right:60px;font-size:18px}.sticker b{font-size:36px}
.stack{height:380px;margin-top:40px}.stack figure{width:210px}
.stack figure:nth-child(1){left:calc(50% - 360px);transform:rotate(-10deg)}.stack figure:nth-child(2){left:calc(50% - 105px)}.stack figure:nth-child(3){left:calc(50% + 150px);transform:rotate(9deg)}
.ticker .row{font-size:20px;padding:14px 0}
.sec{padding:72px 40px 4px;max-width:1200px;margin:0 auto}
.sec h2,.after h2{font-size:46px}.lead{font-size:17px}
.path{grid-template-columns:repeat(5,minmax(0,1fr));gap:16px}.path li{padding:70px 16px 18px}.path .age{left:16px;top:14px;width:48px;height:48px}
.after{margin-top:72px;padding:72px 40px 80px}.after>*{max-width:1120px;margin-left:auto;margin-right:auto}.after .tag{display:block;width:fit-content}
.cards{grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.cards>div{padding:18px}.cards h3{font-size:21px}.cards p{font-size:14px}
.quotes{grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}.quotes p{font-size:22px}
.gallery{grid-auto-flow:row;grid-template-columns:repeat(4,minmax(0,1fr));overflow:visible;gap:22px}
.duo{display:grid;grid-template-columns:1fr 1fr;gap:40px;max-width:1200px;margin:0 auto;padding:72px 40px 4px}.duo .sec{padding:0;margin:0}
.last{margin:72px auto 0;max-width:1040px;padding:48px 40px}.last h2{font-size:110px}.last .ctas{margin-top:24px}
.foot{padding:30px 40px 40px}
.dock{display:none}}`;

// 글꼴 CSS는 그리기를 막지 않게 늦게 붙인다(T-11-585, 게임 셸 index.html과 같은 방식).
const PRETENDARD =
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';
const BARLOW =
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,800;1,800&display=swap';
const lazyCss = (href) => {
  const h = href.replaceAll('&', '&amp;');
  return `<link rel="preload" as="style" href="${h}" onload="this.onload=null;this.rel='stylesheet'" /><noscript><link rel="stylesheet" href="${h}" /></noscript>`;
};

/** 완성된 소개 페이지 문서. head는 다른 공개 페이지와 같은 SEO 머리(createHeadMarkup)를 받는다. pixel: { id, host } 또는 없음. */
export function landingHtml(headMarkup, title, lang = 'ko', pixel = undefined) {
  const body = landingBody(lang);
  const fonts = [PRETENDARD, BARLOW, fontHref(body, lang)].filter(Boolean);
  return `<!doctype html>
<html lang="${LANDING_LOCALES[lang].html}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#f4ecd6" />
<title>${title}</title>
<script>${OS_SCRIPT}</script>
${headMarkup}
${fonts.map(lazyCss).join('\n')}
<style>${CSS}</style>
</head>
<body>
${body}
<script>${SCRIPT}</script>${validPixel(pixel) ? `\n<script>${pixelScript(pixel)}</script>` : ''}
</body>
</html>
`;
}
