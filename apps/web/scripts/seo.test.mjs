import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  BRAND_VERSION,
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
    <title>오프사이드 — 풀타임 축구 커리어</title>
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

test('brand discovery uses the versioned approved flag assets', () => {
  const head = createHeadMarkup({ origin: undefined, indexingEnabled: false });
  assert.match(head, /offside-flag-v6-64\.png/);
  assert.match(head, /offside-flag-v6-180\.png/);
  assert.match(head, /og-offside-flag-v6\.png/);
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
  assert.equal((createSitemapXml(config.origin).match(/<url>/g) ?? []).length, 5);
  assert.match(createSitemapXml(config.origin), /<loc>https:\/\/play\.example\.com\/<\/loc>/);
  assert.match(createHeaders(config), /\/\*\n[ ]{2}X-Robots-Tag: noindex/);
  assert.match(createHeaders(config), /\/\n[ ]{2}X-Robots-Tag: index, follow/);
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
  const ui = readFileSync(new URL('../src/game/ui.ts', import.meta.url), 'utf8');
  assert.match(ui, new RegExp(`/brand/offside-flag-${BRAND_VERSION}-64\\.png`));
});

test('structured data: home is a free web game, FAQ mirrors visible Q&A, no-index shells get none', () => {
  const config = { origin: 'https://play.example.com', indexingEnabled: true };
  const graph = (head) =>
    JSON.parse(head.match(/ld\+json">(.*?)<\/script>/)[1])['@graph'].map((g) => g['@type']);
  assert.deepEqual(graph(createHeadMarkup(config, '/')), ['WebSite', 'VideoGame']);
  assert.deepEqual(graph(createHeadMarkup(config, '/faq/')), ['BreadcrumbList', 'FAQPage']);
  assert.doesNotMatch(createHeadMarkup(config, '/', true), /ld\+json/);
});
