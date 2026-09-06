import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createHeaders,
  createHeadMarkup,
  createRobotsTxt,
  createSitemapXml,
  parsePublicSiteUrl,
  resolveSeoConfig,
} from './seo.mjs';

test('accepts only an HTTPS origin', () => {
  assert.equal(parsePublicSiteUrl('https://play.example.com/'), 'https://play.example.com');
  assert.equal(parsePublicSiteUrl('http://play.example.com'), undefined);
  assert.equal(parsePublicSiteUrl('https://play.example.com/path'), undefined);
});

test('brand discovery uses the versioned approved flag assets', () => {
  const head = createHeadMarkup({ origin: undefined, indexingEnabled: false });
  assert.match(head, /offside-flag-v5-64\.png/);
  assert.match(head, /offside-flag-v5-180\.png/);
  assert.match(head, /og-offside-flag-v5\.png/);
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

test('production discovery files contain the three public pages', () => {
  const config = { origin: 'https://play.example.com', indexingEnabled: true };
  assert.match(createRobotsTxt(config), /Sitemap: https:\/\/play\.example\.com\/sitemap\.xml/);
  assert.equal((createSitemapXml(config.origin).match(/<url>/g) ?? []).length, 3);
  assert.match(createSitemapXml(config.origin), /<loc>https:\/\/play\.example\.com\/<\/loc>/);
  assert.match(createHeaders(config), /\/\*\n[ ]{2}X-Robots-Tag: noindex/);
  assert.match(createHeaders(config), /\/\n[ ]{2}X-Robots-Tag: index, follow/);
  assert.match(
    createSitemapXml(config.origin),
    /<loc>https:\/\/play\.example\.com\/guide\/<\/loc>/,
  );
});
