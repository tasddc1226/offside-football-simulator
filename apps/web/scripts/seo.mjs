import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

export const PUBLIC_PAGES = {
  '/': {
    title: '오프사이드 — 이번 생은 프리미어리거!',
    description:
      '선택으로 한 명의 축구 선수 커리어를 만들어 가는 스토리 시뮬레이션 게임, 오프사이드.',
  },
  '/guide/': {
    title: '게임 가이드 | OFFSIDE',
    description:
      '오프사이드의 선수 생성, 시즌 진행, 선택과 성장, 이적과 은퇴 흐름을 처음부터 알아봅니다.',
  },
  '/faq/': {
    title: '자주 묻는 질문 | OFFSIDE',
    description:
      '오프사이드의 저장 방식, 진행 방법, 지원 문의 등 게임 이용 전에 궁금한 점을 확인하세요.',
  },
};
export const PUBLIC_PATHS = Object.keys(PUBLIC_PAGES);

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
      !['/', ''].includes(url.pathname)
    )
      return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}
export function resolveSeoConfig({ mode, publicSiteUrl, enableSearchIndexing }) {
  const origin = parsePublicSiteUrl(publicSiteUrl);
  if (enableSearchIndexing === 'true' && origin === undefined)
    throw new Error(
      'VITE_ENABLE_SEARCH_INDEXING=true requires VITE_PUBLIC_SITE_URL to be a valid HTTPS origin (for example, https://example.com).',
    );
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
const absoluteUrl = (origin, path) =>
  origin ? `${origin}${path === '/' ? '/' : path}` : undefined;

export function createHeadMarkup(config, path = '/', forceNoIndex = false) {
  const page = PUBLIC_PAGES[path] ?? PUBLIC_PAGES['/'];
  const robots =
    config.indexingEnabled && !forceNoIndex && path in PUBLIC_PAGES
      ? 'index, follow'
      : 'noindex, nofollow';
  const canonical = forceNoIndex ? undefined : absoluteUrl(config.origin, path);
  const image = config.origin ? `${config.origin}/og-offside.png` : '/og-offside.png';
  return `<!-- offside-seo:start --><script>document.documentElement.dataset.publicRobots=${JSON.stringify(robots)}</script><meta name="description" content="${escapeHtml(page.description)}" />
    <meta name="robots" content="${robots}" />
    <meta property="og:type" content="website" /><meta property="og:locale" content="ko_KR" /><meta property="og:site_name" content="OFFSIDE" />
    <meta property="og:title" content="${escapeHtml(page.title)}" /><meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:image" content="${escapeHtml(image)}" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />
    ${canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}" /><link rel="canonical" href="${escapeHtml(canonical)}" />` : ''}
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" /><link rel="icon" href="/favicon.png" type="image/png" /><!-- offside-seo:end -->`;
}
export function createRobotsTxt({ origin, indexingEnabled }) {
  return !indexingEnabled || !origin
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
}
export function createSitemapXml(origin) {
  const urls = PUBLIC_PATHS.map(
    (path) => `  <url><loc>${escapeHtml(absoluteUrl(origin, path))}</loc></url>`,
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
export function createHeaders({ indexingEnabled }) {
  const publicHeaders = PUBLIC_PATHS.map(
    (path) => `${path}\n  X-Robots-Tag: ${indexingEnabled ? 'index, follow' : 'noindex, nofollow'}`,
  ).join('\n\n');
  return `/*\n  X-Robots-Tag: noindex, nofollow\n\n${publicHeaders}\n`;
}

const guideBody = `<div class="os-screen"><header><p class="os-eyebrow">HOW TO PLAY</p><h1>게임 가이드</h1><p>한 명의 선수를 만들고 시즌과 선택을 이어 가는 기본 흐름입니다.</p></header><section class="os-panel"><h2>1. 선수 생성</h2><p>19세 유망주의 이름, 성장 배경, 성별, 선호 포지션과 플레이 성향을 선택합니다.</p></section><section class="os-panel"><h2>2. 시즌 진행</h2><p>일정에 따라 경기와 커리어 사건을 만나고 경기 전 컨디션과 체력을 살핍니다. 결과에서 기록과 능력치 변화를 확인합니다.</p></section><section class="os-panel"><h2>3. 선택과 성장</h2><p>OVR 하나만이 아니라 기술, 신체, 멘탈 등 여러 능력치와 상태를 살피며 결정합니다.</p></section><section class="os-panel"><h2>4. 계약, 이적, 은퇴</h2><p>조건에 따라 계약과 이적 제안을 만날 수 있습니다. 특정 제안이나 팀은 보장되지 않으며, 기록을 쌓아 한 선수의 커리어를 완성합니다.</p></section><p><a href="/onboarding">첫 커리어 시작</a></p><nav><a href="/">홈</a> · <a href="/faq/">자주 묻는 질문</a></nav></div>`;
const faqBody = `<div class="os-screen"><header><p class="os-eyebrow">HELP</p><h1>자주 묻는 질문</h1><p>게임을 시작하거나 이어 할 때 필요한 답을 모았습니다.</p></header><section class="os-panel"><h2>어떤 게임인가요?</h2><p>축구 선수 한 명의 입장에서 선택하고 시즌을 진행하는 커리어 스토리 시뮬레이션입니다.</p><h2>진행 내용은 어디에 저장되나요?</h2><p>익명으로 바로 시작하며 브라우저 저장소를 우선 사용합니다. 설정에서 Google 연결, 동기화 상태와 복구 코드를 확인할 수 있습니다.</p><h2>서비스 시즌과 선수 시즌은 다른가요?</h2><p>서비스 시즌은 게임 규칙과 콘텐츠의 운영 단위이고, 선수 시즌은 커리어 안에서 진행되는 축구 시즌입니다.</p><h2>문제가 생겼어요.</h2><p><a href="mailto:tasddc1569@gmail.com">tasddc1569@gmail.com</a>으로 사용 환경과 문제가 발생한 화면을 보내 주세요.</p></section><p><a href="/onboarding">게임 시작</a></p><nav><a href="/">홈</a> · <a href="/guide/">게임 가이드</a></nav></div>`;

function pageHtml(baseHtml, config, path, body, forceNoIndex = false) {
  const page = PUBLIC_PAGES[path] ?? PUBLIC_PAGES['/'];
  return baseHtml
    .replace(/<title>.*?<\/title>/s, `<title>${page.title}</title>`)
    .replace(
      /<!-- offside-seo:start -->[\s\S]*?<!-- offside-seo:end -->/,
      createHeadMarkup(config, path, forceNoIndex),
    )
    .replace(
      /<div id="root">[\s\S]*?<\/div>\s*<\/body>/,
      `<div id="root"><main id="game-content">${body}</main></div>\n</body>`,
    );
}
async function createBrandAssets(outputDirectory) {
  const ball = `<circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" stroke-width="4"/><path d="m32 20 11.4 8.4-4.4 13.2H25l-4.4-13.2L32 20Z" fill="currentColor"/><path d="M32 6v14M8 24l12.6 4.4M16.6 53.2 25 41.6m22.4 11.6L39 41.6M56 24l-12.6 4.4" fill="none" stroke="currentColor" stroke-width="4"/>`;
  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" color="#91bbff"><rect width="64" height="64" rx="14" fill="#121b28"/>${ball}</svg>`;
  const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#121b28"/><g transform="translate(95 219) scale(3)" color="#91bbff">${ball}</g><text x="340" y="298" fill="#f2f5f8" font-family="Arial,sans-serif" font-size="112" font-weight="800">OFFSIDE</text><text x="346" y="375" fill="#91bbff" font-family="Arial,sans-serif" font-size="42">FOOTBALL CAREER STORY</text></svg>`;
  await writeFile(join(outputDirectory, 'favicon.svg'), favicon);
  await sharp(Buffer.from(favicon))
    .resize(64, 64)
    .png()
    .toFile(join(outputDirectory, 'favicon.png'));
  await sharp(Buffer.from(card)).png().toFile(join(outputDirectory, 'og-offside.png'));
}
export function seoPlugin(config) {
  let outputDirectory = 'dist';
  return {
    name: 'offside-seo',
    configResolved(c) {
      outputDirectory = c.build.outDir;
    },
    transformIndexHtml(html) {
      return html
        .replace('<title>OFFSIDE</title>', `<title>${PUBLIC_PAGES['/'].title}</title>`)
        .replace('</head>', `${createHeadMarkup(config)}\n</head>`);
    },
    async closeBundle() {
      const base = await readFile(join(outputDirectory, 'index.html'), 'utf8');
      for (const [path, body] of [
        ['/guide/', guideBody],
        ['/faq/', faqBody],
      ]) {
        const directory = join(outputDirectory, path.slice(1));
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, 'index.html'), pageHtml(base, config, path, body));
      }
      await writeFile(
        join(outputDirectory, 'app-shell.html'),
        pageHtml(base, config, '/', '<p>게임을 불러오는 중입니다.</p>', true),
      );
      await writeFile(join(outputDirectory, 'robots.txt'), createRobotsTxt(config));
      await writeFile(join(outputDirectory, '_headers'), createHeaders(config));
      await writeFile(
        join(outputDirectory, 'seo-policy.json'),
        JSON.stringify({
          indexingEnabled: config.indexingEnabled,
          origin: config.origin,
          publicPaths: PUBLIC_PATHS,
        }),
      );
      const sitemap = join(outputDirectory, 'sitemap.xml');
      if (config.indexingEnabled && config.origin)
        await writeFile(sitemap, createSitemapXml(config.origin));
      else await rm(sitemap, { force: true });
      await createBrandAssets(outputDirectory);
    },
  };
}
