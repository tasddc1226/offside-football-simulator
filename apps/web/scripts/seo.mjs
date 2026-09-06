import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

export const SITE_TITLE = '오프사이드 — 이번 생은 프리미어리거!';
export const SITE_DESCRIPTION = '선택으로 한 명의 축구 선수 커리어를 만들어 가는 스토리 시뮬레이션 게임, 오프사이드.';
export const PUBLIC_PATHS = ['/'];

export function parsePublicSiteUrl(value) {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== '/' && url.pathname !== '')
    ) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

export function resolveSeoConfig({ mode, publicSiteUrl, enableSearchIndexing }) {
  const origin = parsePublicSiteUrl(publicSiteUrl);
  if (enableSearchIndexing === 'true' && origin === undefined) {
    throw new Error(
      'VITE_ENABLE_SEARCH_INDEXING=true requires VITE_PUBLIC_SITE_URL to be a valid HTTPS origin (for example, https://example.com).',
    );
  }
  return {
    origin,
    indexingEnabled:
      mode === 'production' && enableSearchIndexing === 'true' && origin !== undefined,
  };
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function createHeadMarkup({ origin, indexingEnabled }) {
  const robots = indexingEnabled ? 'index, follow' : 'noindex, nofollow';
  const canonicalUrl = origin ? `${origin}/` : undefined;

  return `
    <meta name="description" content="${escapeHtml(SITE_DESCRIPTION)}" />
    <meta name="robots" content="${robots}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="ko_KR" />
    <meta property="og:site_name" content="OFFSIDE" />
    <meta property="og:title" content="${escapeHtml(SITE_TITLE)}" />
    <meta property="og:description" content="${escapeHtml(SITE_DESCRIPTION)}" />
    ${canonicalUrl ? `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />` : ''}
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(SITE_TITLE)}" />
    <meta name="twitter:description" content="${escapeHtml(SITE_DESCRIPTION)}" />
    ${canonicalUrl ? `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />` : ''}`;
}

export function createRobotsTxt({ origin, indexingEnabled }) {
  if (!indexingEnabled || !origin) return 'User-agent: *\nDisallow: /\n';
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
}

export function createSitemapXml(origin) {
  const urls = `  <url><loc>${escapeHtml(`${origin}/`)}</loc></url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function createHeaders({ origin, indexingEnabled }) {
  if (!indexingEnabled) return '/*\n  X-Robots-Tag: noindex, nofollow\n';

  return `/*\n  X-Robots-Tag: noindex, nofollow\n\n${origin}/\n  ! X-Robots-Tag\n  X-Robots-Tag: index, follow\n`;
}

export function seoPlugin(config) {
  let outputDirectory = 'dist';
  return {
    name: 'offside-seo',
    configResolved(resolvedConfig) {
      outputDirectory = resolvedConfig.build.outDir;
    },
    transformIndexHtml(html) {
      return html
        .replace('<title>OFFSIDE</title>', `<title>${SITE_TITLE}</title>`)
        .replace('</head>', `${createHeadMarkup(config)}\n  </head>`);
    },
    async closeBundle() {
      await writeFile(join(outputDirectory, 'robots.txt'), createRobotsTxt(config));
      await writeFile(join(outputDirectory, '_headers'), createHeaders(config));
      const sitemapPath = join(outputDirectory, 'sitemap.xml');
      if (config.indexingEnabled && config.origin) {
        await writeFile(sitemapPath, createSitemapXml(config.origin));
      } else {
        await rm(sitemapPath, { force: true });
      }
    },
  };
}
