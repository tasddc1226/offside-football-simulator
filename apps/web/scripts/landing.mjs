// T-11-584 앱 · 웹 랜딩(/app/). 광고 · 크리에이터 · 검색 유입을 받아 스토어나 웹 게임으로 보낸다.
// 게임 셸(index.html)을 쓰지 않는 독립 문서다: 앱 번들 · 사이트 CSS 없이 이 파일의 CSS와 짧은 스크립트만 싣는다.
// 스토어 버튼은 워커의 /get(기기 · 유입 캠페인에 맞는 스토어 주소로 302)으로, 웹 버튼은 게임(/)으로 간다.

/** 화면에 보이는 숫자(구조화 데이터 평점도 같은 값). 바꿀 때는 App Store · /v1/hof 값을 다시 확인한다. */
export const LANDING_STATS = { asOf: '10월 30일', rating: 4.8, ratingCount: 224, legends: '14만' };

/** App Store 한국 리뷰 원문(맞춤법 그대로, 닉네임 없이 날짜만). */
const REVIEWS = [
  ['저녁먹고 깔았는데 정신차리니 새벽 5시', '10월 6일'],
  ['선수에 욕심이 나서 보는 광고는 이 게임이 처음임', '10월 11일'],
  ['개발자님 피드백도빠르고 업데이트도빨라서 굿', '10월 10일'],
  ['이렇게 선수 키워가는 게임이 나와서 너무 좋습니다.', '10월 4일'],
  ['시간 가는줄도 모르고 했네요', '10월 9일'],
  ['S급 한번만 맛 보면 여한이 없겠습니다.', '10월 5일'],
];
const TICKER = [
  '저녁먹고 깔았는데 정신차리니 새벽 5시',
  '진짜 간만에 재밌는 모바일겜',
  '개발자님 피드백도빠르고 업데이트도빨라서 굿',
  'S급 한번만 맛 보면 여한이 없겠습니다',
  '이렇게 선수 키워가는 게임이 나와서 너무 좋습니다',
];
const PATH = [
  ['18', '고3 시즌', '스피드 · 슈팅 · 패스 중 훈련 방향을 정하고 경기를 치러요.'],
  ['20', '데뷔와 이적', '제의가 오면 출전 기회와 팀 순위를 보고 골라요. 임대, 해외 진출도 있어요.'],
  ['27', '입대와 대표팀', '입대 시기를 정하고, 뽑히면 A매치와 국제 대회에 나가요.'],
  [
    '38',
    '은퇴',
    `기록이 명예의 전당에 올라가요. 지금까지 ${LANDING_STATS.legends} 명이 넘게 올라갔어요.`,
  ],
];
const AFTER = [
  ['구단주 팀', '은퇴 선수로 스쿼드를 짜요.'],
  ['이적시장', '다른 유저와 선수를 사고팔아요.'],
  ['오프사이드 컵', '유저 팀끼리 컵과 리그를 치러요.'],
  ['랭크 경기', '경기 중 선택으로 결과를 바꿔요.'],
];
const SHOTS = [
  ['season', '시즌 순위', '시즌 순위 화면'],
  ['live', '경기 중계', '경기 문자 중계 화면'],
  ['pk', '승부차기', '승부차기 미니게임 화면'],
  ['credits', '은퇴 기록', '은퇴한 선수의 커리어 기록 화면'],
];
const FAQ = [
  [
    '광고나 결제가 확률을 바꾸나요?',
    '광고 시청과 광고 제거 구매는 확률에 영향을 주지 않아요. 유료 아이템이 하는 일과 확률은 <a href="/fairness/">확률과 공정성</a> 페이지에 공개돼 있어요.',
  ],
  [
    '웹에서 하던 커리어를 앱으로 옮길 수 있나요?',
    '백업 코드나 Google · Apple 계정 연결로 옮길 수 있어요.',
  ],
  ['어떤 언어로 할 수 있나요?', '한국어, 영어, 일본어, 번체 중국어예요.'],
];

/** 유입 캠페인이 없을 때 붙이는 랜딩 꼬리표(contracts/acquisition CAMPAIGNS에 있는 값). */
export const LANDING_UTM = {
  utm_source: 'landing',
  utm_medium: 'web',
  utm_campaign: 'app_landing',
};
const webHref = (place) =>
  `/?${new URLSearchParams({ ...LANDING_UTM, utm_content: `lp_${place}` })}`;
const getHref = (os, place) => `/get?os=${os}&amp;p=${place}`;

const icon = {
  ios: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.4 2-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.8-3.5.8s-1.8-.8-3-.8C6.9 7.2 5.4 8.1 4.6 9.6c-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.7 2.4 3 2.4 1.2-.1 1.6-.8 3.1-.8 1.4 0 1.8.8 3.1.8 1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7 0 0-2.5-1-2.8-4zM14.1 5.5c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.7-1.3z"/></svg>',
  android:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#34a853" d="M4 2.8v18.4c0 .4.4.6.7.4l10.6-9.2L4.7 2.4c-.3-.2-.7 0-.7.4z"/><path fill="#fbbc04" d="m19.4 9.9 2.1 1.2c.6.4.6 1.2 0 1.6l-2.1 1.2-2.4-2z"/><path fill="#ea4335" d="M16.5 12.8 6.8 21.3l11.5-6.6z"/><path fill="#4285f4" d="M16.5 11.2 6.8 2.7l11.5 6.6z"/></svg>',
  web: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path fill="currentColor" d="m12 7.5 3.4 2.5-1.3 4h-4.2l-1.3-4z"/></svg>',
};
const ctas = (place) =>
  `<div class="ctas"><a class="btn web" data-web href="${webHref(place).replaceAll('&', '&amp;')}">${icon.web}<span><small>설치 없이</small>웹에서 하기</span></a><a class="btn store ios" data-store href="${getHref('ios', place)}">${icon.ios}<span><small>Download on the</small>App Store</span></a><a class="btn store android" data-store href="${getHref('android', place)}">${icon.android}<span><small>GET IT ON</small>Google Play</span></a></div>`;

const shot = ([key, , alt], lazy) =>
  `<img src="/landing/${key}.webp" width="540" height="1169" alt="${alt}"${lazy ? ' loading="lazy"' : ''} decoding="async">`;

export const landingBody = () => `<a class="skip" href="#main">본문으로</a>
<nav class="nav"><a class="mini" href="/app/">OFFSIDE</a><a class="play-top" href="${webHref('nav').replaceAll('&', '&amp;')}" data-web>웹에서 하기 →</a></nav>
<main id="main">
<header class="hero">
  <div class="sticker" aria-hidden="true"><span><b>S2</b>10.31<br>OPEN</span></div>
  <h1 class="logo" aria-label="오프사이드 풀타임">Offside<span>Full Time</span></h1>
  <p class="subtitle">풀타임: 휘슬이 울릴 때까지</p>
  <p class="pitch-line">고3 선수 한 명을 프로 데뷔, 이적, 입대, 국가대표를 거쳐 은퇴까지 키우는 축구 커리어 게임이에요.</p>
  ${ctas('hero')}
  <div class="qr"><img src="/landing/qr-get.svg" width="76" height="76" alt=""><p><b>폰으로 찍어서 받기</b>iPhone · Android 자동으로 맞춰 열려요</p></div>
  <div class="stack" aria-hidden="true">${SHOTS.filter(([k]) => k !== 'pk')
    .map((s) => `<figure>${shot(s, false).replace(/alt="[^"]*"/, 'alt=""')}</figure>`)
    .join('')}</div>
</header>
<div class="ticker" aria-hidden="true"><div class="row">${[...TICKER, ...TICKER].map((t) => `<span>${t}</span>`).join('')}</div></div>
<section class="sec">
  <p class="tag">한 번의 커리어</p>
  <h2>열여덟 살에 시작해서 은퇴로 끝나요</h2>
  <p class="lead">후보 세 명 중 한 명을 골라요. 같은 선수로 다시 해도 커리어가 매번 다르게 흘러가요.</p>
  <ol class="path">${PATH.map(([age, h, p]) => `<li><span class="age">${age}</span><h3>${h}</h3><p>${p}</p></li>`).join('')}</ol>
</section>
<section class="after">
  <p class="tag">은퇴하고 나서</p>
  <h2>키운 선수들로 내 팀을 꾸려요</h2>
  <p class="lead">은퇴한 선수는 내 구단주 팀 선수가 돼요. 다른 유저의 팀과 붙어요.</p>
  <div class="cards">${AFTER.map(([h, p], i) => `<div><span class="ic">0${i + 1}</span><h3>${h}</h3><p>${p}</p></div>`).join('')}</div>
</section>
<section class="sec">
  <p class="tag">해 본 사람들</p>
  <h2>App Store 리뷰</h2>
  <div class="quotes">${REVIEWS.map(([q, d]) => `<blockquote><div class="st" aria-label="별 5개">★★★★★</div><p>“${q}”</p><cite>App Store 리뷰 · ${d}</cite></blockquote>`).join('')}</div>
  <div class="score"><span><b>${LANDING_STATS.rating}</b> App Store · 리뷰 ${LANDING_STATS.ratingCount}개 (${LANDING_STATS.asOf})</span><span>원문 그대로 옮김</span></div>
</section>
<section class="sec">
  <p class="tag">스크린샷</p>
  <h2>게임 화면</h2>
  <div class="gallery">${SHOTS.map((s) => `<figure><div class="ph">${shot(s, true)}</div><figcaption>${s[1]}</figcaption></figure>`).join('')}</div>
</section>
<div class="duo">
  <section class="sec">
    <p class="tag">어디서 하나요</p>
    <h2>앱과 웹, 같은 커리어</h2>
    <p class="where">iPhone · Android 앱과 브라우저에서 할 수 있어요. 백업 코드나 Google · Apple 계정 연결로 커리어를 옮겨요. 처음이라면 <a href="/guide/">게임 가이드</a>에서 진행 방법을 볼 수 있어요.</p>
  </section>
  <section class="sec">
    <p class="tag">궁금한 것</p>
    <h2>자주 묻는 질문</h2>
    <div class="faq">${FAQ.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>
  </section>
</div>
<div class="last"><h2>Kick off</h2><p>시즌 2는 10월 31일에 열려요</p>${ctas('end')}</div>
</main>
<footer class="foot"><p class="made">made by Offside Lab</p><a href="/guide/">게임 가이드</a><a href="/faq/">자주 묻는 질문</a><a href="/fairness/">확률과 공정성</a><a href="/about/">소개</a><a href="/legal/terms/">이용약관</a><a href="/legal/privacy/">개인정보처리방침</a></footer>
<div class="dock" aria-hidden="true">${ctas('dock').replace('<div class="ctas">', '<div class="ctas" inert>')}</div>`;

/** 화면 손글씨 · 포스터 제목 글꼴은 이 페이지에 쓰는 글자만 받는다(Google Fonts text=). */
function fontHref(body) {
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
  return `https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Gaegu:wght@700&display=swap&text=${q}`;
}

// 기기 표시(휴대폰은 그 기기 스토어만) · 유입 캠페인 넘기기 · 첫 화면 지나면 아래 버튼 띄우기.
// 기기는 그리기 전에(head) 정해 버튼이 바뀌며 깜빡이지 않게 한다. iPadOS는 Mac으로 보이므로 터치로 가른다.
const OS_SCRIPT = `(()=>{const d=document.documentElement,u=navigator.userAgent;d.dataset.os=/iPhone|iPad|iPod/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1)?'ios':/Android/.test(u)?'android':'other'})();`;
const SCRIPT = `(()=>{const q=new URLSearchParams(location.search);
if(q.get('utm_source')){const keep=['utm_source','utm_medium','utm_campaign','utm_content'];
for(const a of document.querySelectorAll('[data-web],[data-store]')){const url=new URL(a.href);
for(const k of keep){if(a.hasAttribute('data-web'))url.searchParams.delete(k);const v=q.get(k);if(v)url.searchParams.set(k,v)}a.href=url.pathname+url.search}}
const dock=document.querySelector('.dock'),hero=document.querySelector('.hero .ctas'),end=document.querySelector('.last .ctas');
if(!dock||!('IntersectionObserver'in window))return;let past=false,atEnd=false;
const sync=()=>{const on=past&&!atEnd;dock.classList.toggle('on',on);dock.toggleAttribute('aria-hidden',!on);dock.querySelector('.ctas').inert=!on};
new IntersectionObserver(([e])=>{past=!e.isIntersecting&&e.boundingClientRect.top<0;sync()}).observe(hero);
new IntersectionObserver(([e])=>{atEnd=e.isIntersecting;sync()}).observe(end)})();`;

const CSS = `:root{--cream:#f4ecd6;--paper:#fffaf0;--ink:#17201a;--ink-2:#4a5148;--pitch:#1d4a35;--pitch-2:#2a6247;--gold:#f2b632;--red:#c8401f;
--display:'Barlow Condensed','Arial Narrow',sans-serif;--body:'Pretendard Variable',Pretendard,-apple-system,'Apple SD Gothic Neo',system-ui,sans-serif;
--hand:'Gaegu',var(--body);--poster:'Black Han Sans',var(--body);color-scheme:light}
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
.pitch-line{margin:16px auto 0;max-width:30em;font-size:15px;color:rgba(244,236,214,.92)}
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
.dock{position:fixed;left:0;right:0;bottom:0;z-index:5;padding:10px max(12px,env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));background:var(--cream);border-top:3px solid var(--ink);transform:translateY(110%);transition:transform .25s;visibility:hidden}
.dock.on{transform:none;visibility:visible}
.dock .ctas{margin:0}.dock .btn{min-height:46px;box-shadow:3px 3px 0 var(--ink)}
html[data-os=other] .dock{display:none}
@media (prefers-reduced-motion:reduce){.ticker .row{animation:none}.btn,.dock{transition:none}}
@media (min-width:820px){
.nav{padding:20px 40px}
.hero{margin:6px 40px 0;padding:56px 40px 0;border-radius:26px}
.hero::before{background:repeating-linear-gradient(90deg,transparent 0 80px,rgba(255,255,255,.045) 80px 160px),radial-gradient(circle at 50% 40%,transparent 150px,rgba(244,236,214,.3) 151px 155px,transparent 156px),linear-gradient(90deg,transparent calc(50% - 2px),rgba(244,236,214,.3) calc(50% - 2px) calc(50% + 2px),transparent calc(50% + 2px))}
.logo{font-size:168px}.subtitle{font-size:26px;margin-top:22px}.pitch-line{font-size:18px;max-width:34em}
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
.path{grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}.path li{padding:70px 16px 18px}.path .age{left:16px;top:14px;width:48px;height:48px}
.after{margin-top:72px;padding:72px 40px 80px}.after>*{max-width:1120px;margin-left:auto;margin-right:auto}.after .tag{display:block;width:fit-content}
.cards{grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}.cards>div{padding:18px}.cards h3{font-size:21px}.cards p{font-size:14px}
.quotes{grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}.quotes p{font-size:22px}
.gallery{grid-auto-flow:row;grid-template-columns:repeat(4,minmax(0,1fr));overflow:visible;gap:22px}
.duo{display:grid;grid-template-columns:1fr 1fr;gap:40px;max-width:1200px;margin:0 auto;padding:72px 40px 4px}.duo .sec{padding:0;margin:0}
.last{margin:72px auto 0;max-width:1040px;padding:48px 40px}.last h2{font-size:110px}.last .ctas{margin-top:24px}
.foot{padding:30px 40px 40px}
.dock{display:none}}`;

/** 완성된 /app/ 문서. head는 다른 공개 페이지와 같은 SEO 머리(createHeadMarkup)를 받는다. */
export function landingHtml(headMarkup, title) {
  const body = landingBody();
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#f4ecd6" />
<title>${title}</title>
<script>${OS_SCRIPT}</script>
${headMarkup}
<link rel="preload" as="image" href="/landing/live.webp" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,800;1,800&display=swap" />
<link rel="stylesheet" href="${fontHref(body).replaceAll('&', '&amp;')}" />
<style>${CSS}</style>
</head>
<body>
${body}
<script>${SCRIPT}</script>
</body>
</html>
`;
}
