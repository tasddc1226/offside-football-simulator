import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { brandSvg } from '../brand/build-icons.mjs';
import guideKo from '../../../packages/app-core/src/i18n/ko/publicGuide.mjs';
import guideEn from '../../../packages/app-core/src/i18n/en/publicGuide.mjs';
import guideJa from '../../../packages/app-core/src/i18n/ja/publicGuide.mjs';
import guideZh from '../../../packages/app-core/src/i18n/zh/publicGuide.mjs';
import articlesKo from '../../../packages/app-core/src/i18n/ko/publicArticles.mjs';
import articlesEn from '../../../packages/app-core/src/i18n/en/publicArticles.mjs';
import articlesJa from '../../../packages/app-core/src/i18n/ja/publicArticles.mjs';
import articlesZh from '../../../packages/app-core/src/i18n/zh/publicArticles.mjs';
import {
  BRAND_VERSION,
  GUIDE_LOCALES,
  PUBLIC_PAGES,
  STATIC_PAGES,
  landingPage,
  articlePath,
  createStructuredData,
  stripAppBundle,
  createHeaders,
  createHeadMarkup,
  createRobotsTxt,
  createSitemapXml,
  pageHtml,
  parsePublicSiteUrl,
  resolveSeoConfig,
} from './seo.mjs';

const FAKE_BASE_HTML = `<!doctype html>
<html lang="ko">
  <head>
    <title>오프사이드 - 축구선수 커리어 시뮬레이션 게임</title>
    <link rel="modulepreload" crossorigin href="/assets/shared-abc123.js">
    <script type="module" crossorigin src="/assets/index-abc123.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-abc123.css">
  <!-- offside-seo:start --><!-- offside-seo:end -->
</head>
  <body>
    <div id="app"></div>
    <div id="modal"></div>
  </body>
</html>`;

test('accepts only an HTTPS origin', () => {
  assert.equal(parsePublicSiteUrl('https://play.example.com/'), 'https://play.example.com');
  assert.equal(parsePublicSiteUrl('http://play.example.com'), undefined);
  assert.equal(parsePublicSiteUrl('https://play.example.com/path'), undefined);
});

test('brand discovery uses the versioned approved icon assets', () => {
  const head = createHeadMarkup({ origin: undefined, indexingEnabled: false });
  assert.match(head, /offside-icon-v7-64\.png/);
  assert.match(
    head,
    /offside-icon-v7-dark-64\.png" type="image\/png" sizes="64x64" media="\(prefers-color-scheme: dark\)"/,
  );
  assert.match(head, /offside-icon-v7-180\.png/);
  assert.match(head, /og-offside-v7\.png/);
  assert.match(head, /site\.webmanifest/);
  assert.doesNotMatch(head, /favicon\.svg/);
});

test('indexing is opt-in and production-only', () => {
  assert.deepEqual(resolveSeoConfig({ mode: 'production' }), {
    origin: undefined,
    indexingEnabled: false,
  });
  assert.equal(
    resolveSeoConfig({
      mode: 'production',
      publicSiteUrl: 'https://play.example.com',
      enableSearchIndexing: 'true',
    }).indexingEnabled,
    true,
  );
  assert.equal(
    resolveSeoConfig({
      mode: 'staging',
      publicSiteUrl: 'https://staging.example.com',
      enableSearchIndexing: 'true',
    }).indexingEnabled,
    false,
  );
  assert.throws(() => resolveSeoConfig({ mode: 'production', enableSearchIndexing: 'true' }));
});

test('public static pages do not load the app bundle, but index.html does', () => {
  const config = { origin: undefined, indexingEnabled: false };
  const guide = pageHtml(FAKE_BASE_HTML, config, '/guide/', '<p><a href="/">홈으로</a></p>');
  assert.doesNotMatch(guide, /<script type="module"/);
  assert.doesNotMatch(guide, /modulepreload/);
  assert.match(guide, /<link rel="stylesheet"/);
  assert.match(guide, /href="\/"/);

  const appShell = pageHtml(FAKE_BASE_HTML, config, '/', '<p>loading</p>', {
    forceNoIndex: true,
    keepAppBundle: true,
  });
  assert.match(appShell, /<script type="module"[^>]*src="\/assets\/index-abc123\.js"><\/script>/);
  assert.match(appShell, /modulepreload/);
});

test('production discovery files contain the public pages', () => {
  const config = { origin: 'https://play.example.com', indexingEnabled: true };
  assert.match(createRobotsTxt(config), /Sitemap: https:\/\/play\.example\.com\/sitemap\.xml/);
  assert.equal(
    (createSitemapXml(config.origin).match(/<url>/g) ?? []).length,
    // T-11-588 가이드 · FAQ · 공략 글은 영어 · 일본어 · 번체 중국어 주소가 더 있다.
    8 + articlesKo.length + 3 * (2 + articlesKo.length),
  );
  // T-11-231 운영 소개 페이지.
  assert.match(
    createSitemapXml(config.origin),
    /<loc>https:\/\/play\.example\.com\/about\/<\/loc>/,
  );
  assert.match(createSitemapXml(config.origin), /<loc>https:\/\/play\.example\.com\/<\/loc>/);
  assert.match(createHeaders(config), /\/\*\n[ ]{2}X-Robots-Tag: noindex/);
  assert.match(createHeaders(config), /\/\n[ ]{2}X-Robots-Tag: index, follow/);
  assert.match(
    createHeaders(config),
    /\/assets\/\*\n[ ]{2}Cache-Control: public, max-age=31536000, immutable\n[ ]{2}X-Content-Type-Options: nosniff/,
  );
  assert.match(
    createSitemapXml(config.origin),
    /<loc>https:\/\/play\.example\.com\/guide\/<\/loc>/,
  );
});

test('stripAppBundle은 속성 순서와 무관하게 앱 스크립트·modulepreload를 지운다', () => {
  const html =
    '<head><script crossorigin src="/assets/a.js" type="module"></script><link href="/assets/b.js" rel="modulepreload"><script>inline()</script></head>';
  const out = stripAppBundle(html);
  assert.ok(!out.includes('/assets/a.js'));
  assert.ok(!out.includes('modulepreload'));
  assert.ok(out.includes('inline()'));
});

test('in-app badge uses the current brand version', () => {
  // T-10-001: 인앱 배지 마크업은 ui.ts에서 Topbar.svelte로 옮겨졌다.
  const topbar = readFileSync(new URL('../src/ui/Topbar.svelte', import.meta.url), 'utf8');
  assert.match(topbar, new RegExp(`/brand/offside-icon-${BRAND_VERSION}-64\\.png`));
  assert.match(topbar, new RegExp(`/brand/offside-icon-${BRAND_VERSION}-dark-64\\.png`));
});

test('structured data: home is a free web game, FAQ mirrors visible Q&A, no-index shells get none', () => {
  const config = { origin: 'https://play.example.com', indexingEnabled: true };
  const graph = (head) =>
    JSON.parse(head.match(/ld\+json">(.*?)<\/script>/)[1])['@graph'].map((g) => g['@type']);
  assert.deepEqual(graph(createHeadMarkup(config, '/')), ['WebSite', 'VideoGame']);
  assert.deepEqual(graph(createHeadMarkup(config, '/faq/')), ['BreadcrumbList', 'FAQPage']);
  assert.doesNotMatch(createHeadMarkup(config, '/', true), /ld\+json/);
  const faq = JSON.parse(createHeadMarkup(config, '/faq/').match(/ld\+json">(.*?)<\/script>/)[1])[
    '@graph'
  ].find((entry) => entry['@type'] === 'FAQPage');
  const visible = [...STATIC_PAGES['/faq/'].matchAll(/<h2>(.*?)<\/h2><p>(.*?)<\/p>/g)];
  assert.equal(faq.mainEntity.length, visible.length);
  for (const [index, [, question, answer]] of visible.entries()) {
    assert.equal(faq.mainEntity[index].name, question);
    assert.equal(faq.mainEntity[index].acceptedAnswer.text, answer.replace(/<[^>]+>/g, ''));
  }
});

test('static guide correction dictionaries have complete English and Japanese counterparts', () => {
  for (const translated of [guideEn, guideJa, guideZh]) {
    assert.deepEqual(Object.keys(translated).sort(), Object.keys(guideKo).sort());
    for (const text of Object.values(translated)) {
      assert.equal(typeof text, 'string');
      assert.ok(text.trim());
      assert.doesNotMatch(text, /[가-힣]/);
    }
  }
});

test('T-11-441 가이드의 진행 상황 저장은 웹 · 앱을 나눠 적는다', () => {
  const guide = STATIC_PAGES['/guide/'];
  assert.ok(guide.includes(`<p>${guideKo.saveWeb}</p>`));
  assert.ok(guide.includes(`<p>${guideKo.saveApp}</p>`));
  assert.doesNotMatch(guide, /이 브라우저\(기기\)에만/);
});

test('T-10-118 maskable 아이콘은 모서리 없는 배경에 서클·글자만 80%로 줄인다', () => {
  const out = brandSvg('light', { rounded: false, artScale: 0.8 });
  assert.doesNotMatch(out, /rx="224"/);
  assert.match(out, /<g transform="translate\(102\.4 102\.4\) scale\(0\.8\)">/);
  assert.match(brandSvg('light'), /rx="224"/);
});

test('T-11-452 공략 글은 가이드 아래 색인 페이지로 나가고 가이드 · 서로를 잇는다', () => {
  const config = { origin: 'https://play.example.com', indexingEnabled: true };
  const sitemap = createSitemapXml(config.origin);
  assert.ok(articlesKo.length >= 6);
  for (const a of articlesKo) {
    const path = articlePath(a.slug);
    assert.match(a.slug, /^[a-z0-9-]+$/);
    assert.ok(PUBLIC_PAGES[path]?.title.startsWith(a.title));
    assert.match(sitemap, new RegExp(`<loc>https://play\\.example\\.com${path}</loc>`));
    const body = STATIC_PAGES[path];
    assert.match(body, new RegExp(`<h1>${a.title}</h1>`));
    assert.match(body, /href="\/guide\/"/);
    // 본문이 빈약하지 않게: 표시되는 글자가 1,500자 이상.
    assert.ok(body.replace(/<[^>]+>/g, '').length >= 1500, a.slug);
    assert.match(STATIC_PAGES['/guide/'], new RegExp(`href="${path}"`));
    assert.match(createHeadMarkup(config, path), /index, follow/);
    const graph = createStructuredData(config.origin, path);
    assert.equal(graph[1]['@type'], 'Article');
    assert.equal(graph[0].itemListElement.length, 3);
  }
});

test('T-11-452 공략 글 영어 · 일본어는 한국어와 같은 구조이고 한글이 없다', () => {
  const shape = (list) => list.map((a) => [a.slug, a.sections.map(([, ps]) => ps.length)]);
  for (const translated of [articlesEn, articlesJa, articlesZh]) {
    assert.deepEqual(shape(translated), shape(articlesKo));
    assert.doesNotMatch(JSON.stringify(translated), /[가-힣]/);
  }
});

test('T-11-584 /app/ 랜딩은 독립 문서이고 색인 · 구조화 데이터 · 스토어 버튼을 갖춘다', () => {
  const config = { origin: 'https://play.example.com', indexingEnabled: true };
  const html = landingPage(config);
  assert.match(html, /^<!doctype html>/);
  assert.doesNotMatch(html, /<script type="module"/);
  assert.match(html, /<meta name="robots" content="index, follow" \/>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/play\.example\.com\/app\/" \/>/);
  assert.match(html, /"@type":\["VideoGame","MobileApplication"\]/);
  assert.match(html, /"ratingCount":224/);
  assert.match(html, /리뷰 224개/);
  assert.match(html, /href="\/get\?os=ios&amp;p=hero"/);
  assert.match(html, /href="\/get\?os=android&amp;p=hero"/);
  assert.match(
    html,
    /href="\/\?utm_source=landing&amp;utm_medium=web&amp;utm_campaign=app_landing&amp;utm_content=lp_hero"/,
  );
  assert.doesNotMatch(html, /무료/);
  // T-11-585 검색어가 든 제목 · H1 하나, 글꼴 CSS는 그리기를 막지 않는다, 다른 공개 페이지에서 랜딩으로 잇는다.
  assert.match(html, /<title>축구 선수 키우기 게임 오프사이드/);
  assert.equal(html.match(/<h1\b/g)?.length, 1);
  assert.match(
    html,
    /<h1 class="pitch-line">고3 선수 한 명을 은퇴까지 키우는 축구 커리어 시뮬레이션/,
  );
  assert.doesNotMatch(html, /(?<!<noscript>)<link rel="stylesheet" href="https:\/\//);
  for (const path of ['/guide/', '/faq/', '/fairness/', '/about/'])
    assert.match(STATIC_PAGES[path], /href="\/app\/"/, path);
  assert.match(createSitemapXml(config.origin), /<loc>https:\/\/play\.example\.com\/app\/<\/loc>/);
});

test('T-11-588 가이드 · FAQ 본문은 네 언어가 같은 구조이고 다른 언어 페이지에는 한글이 없다', () => {
  const shape = (p) => [
    p.guide.sections.map(([, ps]) => ps.length),
    p.faq.items.length,
    Object.keys(p.ui),
    Object.keys(p.guide),
    Object.keys(p.faq),
  ];
  const ko = GUIDE_LOCALES.ko.page;
  for (const lang of ['en', 'ja', 'zh']) {
    const { prefix, page, articles } = GUIDE_LOCALES[lang];
    assert.deepEqual(shape(page), shape(ko), lang);
    const paths = [
      `${prefix}/guide/`,
      `${prefix}/faq/`,
      ...articles.map((a) => `${prefix}${articlePath(a.slug)}`),
    ];
    for (const path of paths) {
      assert.ok(STATIC_PAGES[path], path);
      assert.doesNotMatch(STATIC_PAGES[path], /[가-힣]/, path);
      assert.doesNotMatch(
        PUBLIC_PAGES[path].title + PUBLIC_PAGES[path].description,
        /[가-힣]/,
        path,
      );
    }
    // 가이드 · FAQ · 공략 글끼리는 같은 언어 주소로 잇는다.
    assert.match(STATIC_PAGES[`${prefix}/guide/`], new RegExp(`href="${prefix}/faq/"`));
    assert.match(
      STATIC_PAGES[`${prefix}/guide/`],
      new RegExp(`href="${prefix}/guide/${articles[0].slug}/"`),
    );
  }
});

test('T-11-588 언어별 페이지는 html lang · og:locale · hreflang · 구조화 데이터를 그 언어로 낸다', () => {
  const config = { origin: 'https://play.example.com', indexingEnabled: true };
  const html = pageHtml(FAKE_BASE_HTML, config, '/ja/faq/', STATIC_PAGES['/ja/faq/']);
  assert.match(html, /<html lang="ja"/);
  assert.match(html, /og:locale" content="ja_JP"/);
  for (const [hreflang, path] of [
    ['ko', '/faq/'],
    ['en', '/en/faq/'],
    ['ja', '/ja/faq/'],
    ['zh-Hant', '/zh/faq/'],
    ['x-default', '/faq/'],
  ])
    assert.ok(
      html.includes(`hreflang="${hreflang}" href="https://play.example.com${path}"`),
      hreflang,
    );
  assert.match(
    pageHtml(FAKE_BASE_HTML, config, '/guide/', STATIC_PAGES['/guide/']),
    /<html lang="ko"/,
  );
  // 소개 · 약관처럼 한 벌인 페이지에는 다른 언어 주소를 달지 않는다.
  assert.doesNotMatch(createHeadMarkup(config, '/about/'), /hreflang/);
  const faq = createStructuredData(config.origin, '/zh/faq/').find((n) => n['@type'] === 'FAQPage');
  assert.equal(faq.mainEntity.length, GUIDE_LOCALES.zh.page.faq.items.length);
  assert.doesNotMatch(JSON.stringify(faq), /[가-힣]/);
  const slug = articlesEn[0].slug;
  const article = createStructuredData(config.origin, `/en/guide/${slug}/`);
  assert.equal(article[1].inLanguage, 'en');
  assert.equal(article[0].itemListElement[1].item, 'https://play.example.com/en/guide/');
});
