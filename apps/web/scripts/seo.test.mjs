import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createHeaders,
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
  assert.throws(() =>
    resolveSeoConfig({ mode: 'production', enableSearchIndexing: 'true' }),
  );
});

test('production discovery files contain the public root only', () => {
  const config = { origin: 'https://play.example.com', indexingEnabled: true };
  assert.match(createRobotsTxt(config), /Sitemap: https:\/\/play\.example\.com\/sitemap\.xml/);
  assert.equal((createSitemapXml(config.origin).match(/<url>/g) ?? []).length, 1);
  assert.match(createSitemapXml(config.origin), /<loc>https:\/\/play\.example\.com\/<\/loc>/);
  assert.match(createHeaders(config), /\/\*\n[ ]{2}X-Robots-Tag: noindex/);
  assert.match(
    createHeaders(config),
    /https:\/\/play\.example\.com\/\n[ ]{2}! X-Robots-Tag/,
  );
});
