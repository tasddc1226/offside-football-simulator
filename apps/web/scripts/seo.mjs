import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import guideCopy from '../../../packages/app-core/src/i18n/ko/publicGuide.mjs';
import ARTICLES from '../../../packages/app-core/src/i18n/ko/publicArticles.mjs';
import koGuidePage from '../../../packages/app-core/src/i18n/ko/publicGuidePage.mjs';
import enGuide from '../../../packages/app-core/src/i18n/en/publicGuide.mjs';
import enArticles from '../../../packages/app-core/src/i18n/en/publicArticles.mjs';
import enGuidePage from '../../../packages/app-core/src/i18n/en/publicGuidePage.mjs';
import jaGuide from '../../../packages/app-core/src/i18n/ja/publicGuide.mjs';
import jaArticles from '../../../packages/app-core/src/i18n/ja/publicArticles.mjs';
import jaGuidePage from '../../../packages/app-core/src/i18n/ja/publicGuidePage.mjs';
import zhGuide from '../../../packages/app-core/src/i18n/zh/publicGuide.mjs';
import zhArticles from '../../../packages/app-core/src/i18n/zh/publicArticles.mjs';
import zhGuidePage from '../../../packages/app-core/src/i18n/zh/publicGuidePage.mjs';
import { APP_SHELL_MARK } from './app-shell.mjs';
import { LANDING_STATS, landingHtml } from './landing.mjs';

// T-11-073 아이콘 도형은 brand/build-icons.mjs 한 곳에 있다(라이트·다크 두 벌).
import { BRAND_VERSION, brandSvg as iconSvg } from '../brand/build-icons.mjs';
export { BRAND_VERSION };
// T-10-031 공유 링크(/career/<id>) 미리보기 카드 — 레전드 등급(src/game/legend-bands.ts LEGEND_BANDS)마다 한 장.
// CI에 한글 폰트가 없을 수 있어 이미지 글자는 영어로 두고, 선수 이름·기록은 워커가 og:title/description에 넣는다.
export const CAREER_OG_BANDS = [
  ['lg_goat', 'GREATEST OF ALL TIME', 4],
  ['lg_world', 'WORLD CLASS LEGEND', 4],
  ['lg_club', 'CLUB LEGEND', 3],
  ['lg_pro', 'TRUE PROFESSIONAL', 2],
  ['lg_plain', 'FULL TIME CAREER', 1],
];
const BRAND_BG = '#0D1511';

// T-11-452 공략 글(/guide/<slug>/). 가이드 아래 주제별 페이지라 AdSense · 검색이 읽는 원문 글이 된다.
export const articlePath = (slug) => `/guide/${slug}/`;

// T-11-588 게임 가이드 · 공략 글 · FAQ는 네 언어로 낸다. 한국어는 지금 주소, 다른 언어는 /<언어>/ 아래(/en/guide/ 등).
// 소개 · 확률과 공정성 · 약관 · 개인정보처리방침 · 랜딩은 한국어 한 벌이다.
export const GUIDE_LOCALES = {
  ko: { prefix: '', html: 'ko', og: 'ko_KR', page: koGuidePage(guideCopy), articles: ARTICLES },
  en: { prefix: '/en', html: 'en', og: 'en_US', page: enGuidePage(enGuide), articles: enArticles },
  ja: { prefix: '/ja', html: 'ja', og: 'ja_JP', page: jaGuidePage(jaGuide), articles: jaArticles },
  zh: {
    prefix: '/zh',
    html: 'zh-Hant',
    og: 'zh_TW',
    page: zhGuidePage(zhGuide),
    articles: zhArticles,
  },
};
const GUIDE_LANGS = Object.keys(GUIDE_LOCALES);
/** 이 주소의 언어(/en/ · /ja/ · /zh/ 아래면 그 언어, 나머지는 한국어). */
export const pathLang = (path) =>
  GUIDE_LANGS.find((l) => l !== 'ko' && path.startsWith(`${GUIDE_LOCALES[l].prefix}/`)) ?? 'ko';
/** 가이드 · 공략 글 · FAQ의 언어 무관 주소(/guide/…, /faq/). 아니면 null. */
const guideBase = (path) => {
  const base = path.slice(GUIDE_LOCALES[pathLang(path)].prefix.length);
  return base === '/faq/' || /^\/guide\/([a-z0-9-]+\/)?$/.test(base) ? base : null;
};
const KO = GUIDE_LOCALES.ko.page;
const NAME_POLICY = KO.namePolicy;
export const PUBLIC_PAGES = {
  '/': {
    title: '오프사이드 | 이번 생은 축구다 — 축구선수 커리어 시뮬레이션',
    description:
      '이번 생은 축구다. 오프사이드(풀타임)에서 고교 3학년부터 은퇴까지, 훈련·이적·이벤트 선택으로 한 선수의 커리어를 만듭니다. 설치 없이 바로 하는 무료 웹 시뮬레이션 게임입니다.',
  },
  // T-11-584 앱 · 웹 랜딩. 게임 셸 없이 독립 문서로 나간다(landing.mjs).
  '/app/': {
    title: '축구 선수 키우기 게임 오프사이드 | 고3부터 은퇴까지',
    description:
      '고3 선수 한 명을 프로 데뷔, 이적, 입대, 국가대표를 거쳐 은퇴까지 키우는 축구 인생게임이에요. 은퇴한 선수로 구단주 팀을 만들어 다른 유저와 경기해요. iPhone · Android 앱과 웹에서 할 수 있어요.',
  },
  ...Object.fromEntries(
    GUIDE_LANGS.flatMap((lang) => {
      const { prefix, page, articles } = GUIDE_LOCALES[lang];
      const meta = (title, description) => ({ title: `${title} | ${page.siteName}`, description });
      return [
        [`${prefix}/guide/`, meta(page.guide.title, page.guide.description)],
        ...articles.map((a) => [`${prefix}${articlePath(a.slug)}`, meta(a.title, a.description)]),
        [`${prefix}/faq/`, meta(page.faq.title, page.faq.description)],
      ];
    }),
  ),
  '/fairness/': {
    title: '확률과 공정성 | 오프사이드',
    description:
      '오프사이드(풀타임)의 확률 판정 방식, 광고·결제와 확률의 관계, 밸런스 조정 원칙, 숨겨 둔 정보와 그 이유를 공개합니다.',
  },
  '/about/': {
    title: '오프사이드 소개 | 오프사이드',
    description:
      '오프사이드(풀타임)가 어떤 게임인지, 누가 만들고 어떻게 운영하는지, 문의는 어디로 하는지 안내합니다.',
  },
  '/legal/terms/': {
    title: '이용약관 | 오프사이드',
    description: '오프사이드(풀타임) 서비스 이용약관입니다.',
  },
  '/legal/privacy/': {
    title: '개인정보처리방침 | 오프사이드',
    description: '오프사이드(풀타임)이 수집·이용하는 정보와 이용자의 권리를 안내합니다.',
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

// schema.org 구조화 데이터. 실제 화면에 있는 내용만 담는다(가짜 평점·통계 금지).
// FAQPage는 /faq/ 본문과 같은 FAQ 항목(publicGuidePage.mjs)에서 만들어 화면과 어긋나지 않게 한다.
export function createStructuredData(origin, path) {
  const url = absoluteUrl(origin, path);
  const home = absoluteUrl(origin, '/');
  if (path === '/')
    return [
      { '@type': 'WebSite', name: '오프사이드', alternateName: 'OFFSIDE', url, inLanguage: 'ko' },
      {
        '@type': 'VideoGame',
        name: '오프사이드',
        description: PUBLIC_PAGES['/'].description,
        url,
        image: `${origin}/og-offside-${BRAND_VERSION}.png`,
        inLanguage: 'ko',
        genre: ['스포츠', '시뮬레이션'],
        gamePlatform: 'Web browser',
        applicationCategory: 'GameApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
      },
    ];
  // 랜딩의 평점은 화면에 보이는 App Store 평점 · 리뷰 수와 같은 값이다(LANDING_STATS).
  if (path === '/app/')
    return [
      {
        '@type': ['VideoGame', 'MobileApplication'],
        name: '오프사이드',
        alternateName: 'OFFSIDE',
        description: PUBLIC_PAGES['/app/'].description,
        url,
        image: `${origin}/og-offside-${BRAND_VERSION}.png`,
        inLanguage: ['ko', 'en', 'ja', 'zh-Hant'],
        genre: ['스포츠', '시뮬레이션'],
        gamePlatform: ['iOS', 'Android', 'Web browser'],
        applicationCategory: 'GameApplication',
        operatingSystem: 'iOS, Android, Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: LANDING_STATS.rating,
          ratingCount: LANDING_STATS.ratingCount,
          bestRating: 5,
        },
      },
    ];
  const L = GUIDE_LOCALES[pathLang(path)];
  const article = L.articles.find((a) => `${L.prefix}${articlePath(a.slug)}` === path);
  const trail = [
    { name: L.page.ui.home, item: home },
    ...(article
      ? [{ name: L.page.ui.guide, item: absoluteUrl(origin, `${L.prefix}/guide/`) }]
      : []),
    { name: PUBLIC_PAGES[path].title.split(' | ')[0], item: url },
  ];
  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({ '@type': 'ListItem', position: i + 1, ...t })),
  };
  if (article)
    return [
      breadcrumb,
      {
        '@type': 'Article',
        headline: article.title,
        description: article.description,
        inLanguage: L.html,
        url,
        author: { '@type': 'Organization', name: 'OFFSIDE', url: home },
      },
    ];
  if (path !== `${L.prefix}/faq/`) return [breadcrumb];
  const text = (html) => html.replace(/<[^>]+>/g, '');
  return [
    breadcrumb,
    {
      '@type': 'FAQPage',
      mainEntity: L.page.faq.items.map(([q, a]) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: text(a) },
      })),
    },
  ];
}
function jsonLd(origin, path) {
  const graph = createStructuredData(origin, path);
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c')}</script>`;
}

export function createHeadMarkup(config, path = '/', forceNoIndex = false) {
  const page = PUBLIC_PAGES[path] ?? PUBLIC_PAGES['/'];
  const robots =
    config.indexingEnabled && !forceNoIndex && path in PUBLIC_PAGES
      ? 'index, follow'
      : 'noindex, nofollow';
  const canonical = forceNoIndex ? undefined : absoluteUrl(config.origin, path);
  const base = guideBase(path);
  // T-11-588 같은 가이드의 다른 언어 주소. 한국어가 기본(x-default)이다.
  const alternates =
    canonical && base
      ? [...GUIDE_LANGS.map((l) => [GUIDE_LOCALES[l].html, l]), ['x-default', 'ko']]
          .map(
            ([hreflang, l]) =>
              `<link rel="alternate" hreflang="${hreflang}" href="${escapeHtml(absoluteUrl(config.origin, `${GUIDE_LOCALES[l].prefix}${base}`))}" />`,
          )
          .join('')
      : '';
  const imagePath = `/og-offside-${BRAND_VERSION}.png`;
  const image = config.origin ? `${config.origin}${imagePath}` : imagePath;
  return `<!-- offside-seo:start --><script>document.documentElement.dataset.publicRobots=${JSON.stringify(robots)}</script><meta name="description" content="${escapeHtml(page.description)}" />
    <meta name="robots" content="${robots}" />
    <meta property="og:type" content="website" /><meta property="og:locale" content="${GUIDE_LOCALES[pathLang(path)].og}" /><meta property="og:site_name" content="OFFSIDE" />
    <meta property="og:title" content="${escapeHtml(page.title)}" /><meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:image" content="${escapeHtml(image)}" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />
    ${canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}" /><link rel="canonical" href="${escapeHtml(canonical)}" />${alternates}` : ''}
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/brand/offside-icon-${BRAND_VERSION}-64.png" type="image/png" sizes="64x64" />
    <link rel="icon" href="/brand/offside-icon-${BRAND_VERSION}-dark-64.png" type="image/png" sizes="64x64" media="(prefers-color-scheme: dark)" />
    <link rel="apple-touch-icon" href="/brand/offside-icon-${BRAND_VERSION}-180.png" sizes="180x180" />
    <link rel="manifest" href="/site.webmanifest" />${canonical && path in PUBLIC_PAGES ? jsonLd(config.origin, path) : ''}<!-- offside-seo:end -->`;
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
export function createLlmsTxt(origin) {
  const link = (path) =>
    `- [${PUBLIC_PAGES[path].title}](${absoluteUrl(origin, path)}): ${PUBLIC_PAGES[path].description}`;
  return `# 오프사이드 (OFFSIDE · 풀타임)\n\n> ${PUBLIC_PAGES['/'].description}\n\n웹 브라우저에서 무료로 플레이하는 한국어 축구 선수 커리어 스토리 시뮬레이션 게임이다. 설치나 로그인 없이 바로 시작할 수 있다.\n\n## 문서\n\n${['/app/', '/guide/', ...ARTICLES.map((a) => articlePath(a.slug)), '/faq/', '/fairness/', '/about/'].map(link).join('\n')}\n\n## 정책\n\n${['/legal/terms/', '/legal/privacy/'].map(link).join('\n')}\n`;
}
export function createHeaders({ indexingEnabled }) {
  const publicHeaders = PUBLIC_PATHS.map(
    (path) => `${path}\n  X-Robots-Tag: ${indexingEnabled ? 'index, follow' : 'noindex, nofollow'}`,
  ).join('\n\n');
  return `/*\n  X-Robots-Tag: noindex, nofollow\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n  X-Content-Type-Options: nosniff\n\n${publicHeaders}\n`;
}

/** 가이드 묶음의 아래 메뉴. 가이드 · FAQ · 공략 글은 그 언어 주소, 나머지는 한국어 한 벌이다. */
function guideNav(lang, items) {
  const { prefix, page } = GUIDE_LOCALES[lang];
  const href = { home: '/', app: '/app/', guide: `${prefix}/guide/`, faq: `${prefix}/faq/` };
  const to = (k) => href[k] ?? `/${k}/`;
  return `<nav>${items.map((k) => `<a href="${to(k)}">${page.ui[k]}</a>`).join(' · ')}</nav>`;
}
function articleList(lang, except) {
  const { prefix, page, articles } = GUIDE_LOCALES[lang];
  const items = articles
    .filter((a) => a.slug !== except)
    .map(
      (a) =>
        `<li><a href="${prefix}${articlePath(a.slug)}">${a.title}</a><br />${a.description}</li>`,
    )
    .join('');
  return `<section class="os-panel"><h2>${except ? page.ui.otherArticles : page.ui.topicArticles}</h2><ul>${items}</ul></section>`;
}
const sectionsHtml = (sections, numbered) =>
  sections
    .map(
      ([h, ps], i) =>
        `<section class="os-panel"><h2>${numbered ? `${i + 1}. ` : ''}${h}</h2>${ps.map((t) => `<p>${t}</p>`).join('')}</section>`,
    )
    .join('');
const articleBody = (lang, a) =>
  `<div class="os-screen"><header><p class="os-eyebrow">GUIDE</p><h1>${a.title}</h1><p>${a.lead}</p></header>${sectionsHtml(a.sections, false)}${articleList(lang, a.slug)}<p><a href="/">${GUIDE_LOCALES[lang].page.ui.start}</a></p>${guideNav(lang, ['home', 'app', 'guide', 'faq', 'fairness', 'legends'])}</div>`;
function guideBody(lang) {
  const { page } = GUIDE_LOCALES[lang];
  const copy = { ko: guideCopy, en: enGuide, ja: jaGuide, zh: zhGuide }[lang];
  const privacy = `<a href="/legal/privacy/">${page.ui.privacy}</a>`;
  return `<div class="os-screen"><header><p class="os-eyebrow">HOW TO PLAY</p><h1>${page.guide.title}</h1><p>${page.guide.lead}</p></header>${articleList(lang)}${sectionsHtml(page.guide.sections, true)}<section class="os-panel"><h2>${page.guide.saveTitle}</h2><p>${copy.saveWeb}</p><p>${copy.saveApp}</p><p>${page.guide.saveNote(privacy)}</p></section><p><a href="/">${page.guide.start}</a></p>${guideNav(lang, ['home', 'app', 'faq', 'fairness', 'legends'])}</div>`;
}
function faqBody(lang) {
  const { page } = GUIDE_LOCALES[lang];
  return `<div class="os-screen"><header><p class="os-eyebrow">HELP</p><h1>${page.faq.title}</h1><p>${page.faq.lead}</p></header><section class="os-panel">${page.faq.items.map(([q, a]) => `<h2>${q}</h2><p>${a}</p>`).join('')}</section><p><a href="/">${page.ui.start}</a></p>${guideNav(lang, ['home', 'app', 'guide', 'fairness'])}</div>`;
}
// T-11-141 확률과 공정성. 숫자 표는 지금 적용 중인 밸런스로 계산해야 해서 게임 안 확률 도감에 두고, 여기에는 약속과 방법만 적는다.
const fairnessBody = `<div class="os-screen"><header><p class="os-eyebrow">FAIRNESS</p><h1>확률과 공정성</h1><p>오프사이드는 같은 조건이면 모든 이용자에게 같은 규칙과 같은 확률을 적용합니다. 어떤 판정이 어떻게 이루어지는지, 무엇을 숨기고 왜 숨기는지 공개합니다.</p></header><section class="os-panel"><h2>약속</h2><p><b>같은 규칙</b> 광고 시청, 광고 제거 구매, 계정 연결, 언어 설정은 확률에 영향을 주지 않습니다. 보상형 광고(또는 광고 대신 쓰는 구단 자금)는 후보의 잠재력 범위나 스카우트 평가 같은 정보를 보여 주거나, 잠재력 강화를 자금 없이 시도하게 해 줍니다(자금이 모자란 시즌에 한 번, 그 뒤 한 선수에 2번까지 더). 시도 횟수는 늘 수 있지만 성공 확률은 자금으로 시도할 때와 같습니다.</p><p><b>유료 아이템</b> 앱에서 파는 잠재력 강화권은 그 시즌의 한 번을 썼거나 자금이 모자랄 때 한 장에 한 번 시도하게 해 주며, 광고·구단 자금과 달리 추가 시도 횟수 상한이 없습니다. 성공 확률(단계별 50%·35%·25%·15%, 실패할 때마다 다음 확률 +5%p, 성공 중 20%는 두 단계를 올리는 대성공), 단계 상한(+4), 나이 제한(29세)은 같습니다. 리롤권은 새 선수 후보 3명을 다시 뽑게 해 줄 뿐, 후보의 잠재력 확률은 그대로입니다. 대신 리롤권을 30장 쓸 때마다 프리미엄 스카우트권 1장을 받습니다(광고로 다시 뽑기는 세지 않습니다).</p><p><b>프리미엄 스카우트권</b> 확률을 바꾸는 유료 아이템은 앱에서 파는 프리미엄 스카우트권 하나입니다. 한 장을 쓰면 새 선수 후보 3명을 새로 뽑고 잠재력을 바로 공개합니다. 3명 중 1명은 실제 잠재력 A 이상이 보장되고, 모든 후보의 S 확률은 일반 후보의 정확히 2배이고, 시즌 2부터는 3배입니다. 보장 후보가 아닌 2명은 S가 아닐 때 일반 후보의 A~D 비율을 그대로 따릅니다. 지금 설정에서 일반 후보 한 명의 S 확률은 시즌 중 약 0.78%, 프리시즌 약 2.63%이고, 프리미엄 후보는 각각 약 1.57%, 5.27%입니다. 정확한 등급별 확률표는 게임 안의 상점과 후보 선택 화면에서 지금 적용 중인 값으로 볼 수 있습니다. 천장도 있습니다. S 후보 없이 29장을 쓰면 30장째 보장 후보는 S로 확정되고, 누적 100장째마다 보장 후보의 잠재력은 최고치(96)로 확정됩니다. 시즌 2부터는 S 후보 없이 19장을 쓰면 20장째, 누적 70장째마다로 앞당겨집니다. 남은 장수는 후보 선택 화면에 보입니다.</p><p><b>기기에서 판정</b> 커리어의 판정은 모두 이용자의 기기에서 이루어집니다. 서버는 커리어 결과를 정하지 않고 시즌·은퇴 기록만 받습니다. 구단주 팀 경기는 모든 팀이 같은 규칙으로 서버에서 치릅니다.</p><p><b>보이는 확률이 실제 확률</b> 선택지에 표시된 퍼센트가 실제 성공 확률이며 숨은 보정은 없습니다. 페널티킥·1대1·승부차기처럼 타이밍 게이지가 나오는 선택지는 퍼센트 대신 바늘을 멈춘 위치로 판정합니다(감속 모션을 켜 두면 표시된 확률로 판정합니다).</p><p><b>조정은 버전으로</b> 성장·부상·이벤트 확률 같은 밸런스 수치는 운영 중 조정될 수 있습니다. 조정은 특정 이용자가 아니라 모든 이용자에게 같은 값으로, 버전을 붙여 적용됩니다. 진행 중인 커리어에는 다음 시즌이 시작될 때부터, 새로 만드는 커리어에는 바로 적용됩니다.</p></section><section class="os-panel"><h2>확률표는 게임 안에서</h2><p>잠재력 등급별 확률, 잠재력 강화 단계별 확률, 이벤트 선택지 확률과 밸런스 변경 이력은 게임의 <b>확률 도감 → 확률과 공정성</b>에서 볼 수 있습니다. 표는 지금 적용 중인 밸런스 값으로 게임 코드가 직접 계산합니다. 변경 이력에는 버전으로 바꾼 수치와 코드 업데이트로 고친 산식·규칙 패치가 적용 날짜와 함께 나옵니다. 환경설정의 도움말에서도 바로 열 수 있습니다.</p></section><section class="os-panel"><h2>숨겨 둔 것과 이유</h2><p><b>실제 잠재력</b> 은퇴할 때 공개합니다. 플레이 중 보이는 스카우트 평가는 실제 값과 조금 다를 수 있습니다.</p><p><b>늦게 피는 선수</b> 실제 잠재력은 25세까지 시즌마다 무작위로 조금씩 오르내리고 21세와 24세 재평가 때 반영됩니다. 재평가에서 내려갈 때는 그 폭의 70%만, 한 번에 3까지만 반영하고 나머지는 없던 일이 됩니다. 선택과는 상관없고 모든 선수에게 같은 규칙입니다.</p><p><b>스토리·특별 이벤트</b> 스포일러를 막기 위해 한 번 겪어야 확률 도감에 열립니다. 확률 규칙은 다른 이벤트와 같습니다.</p></section><p><a href="/">게임 시작</a></p><nav><a href="/">홈</a> · <a href="/app/">앱 받기</a> · <a href="/guide/">게임 가이드</a> · <a href="/faq/">자주 묻는 질문</a></nav></div>`;
// T-11-589 통신판매업 사업자 정보. 실명 · 주소는 공개 저장소에 두지 않고 운영 설정(BUSINESS_INFO, JSON)으로 받는다.
// 모양은 앱 푸터와 같다(src/businessInfo.ts). 값이 없거나 필수 칸이 비면 이 칸을 그리지 않는다.
const BUSINESS_FIELDS = ['name', 'owner', 'regNo', 'mailOrderNo', 'address', 'phone'];
export function businessSection(raw = process.env.BUSINESS_INFO) {
  let v;
  try {
    v = JSON.parse(raw ?? '');
  } catch {
    return '';
  }
  const f = Object.fromEntries(
    BUSINESS_FIELDS.map((k) => [k, typeof v?.[k] === 'string' ? escapeHtml(v[k].trim()) : '']),
  );
  if (BUSINESS_FIELDS.some((k) => !f[k])) return '';
  const check = `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${f.regNo.replace(/\D/g, '')}`;
  return `<section class="os-panel" id="business"><h2>7. 사업자 정보</h2><p>상호 ${f.name} · 대표자 ${f.owner} · 사업자등록번호 ${f.regNo} (<a href="${check}">사업자 정보 확인</a>) · 통신판매업 신고 ${f.mailOrderNo} · 주소 ${f.address} · 전화 ${f.phone} · 이메일 contact@offside-lab.com</p></section>`;
}
const termsBody = `<div class="os-screen"><header><p class="os-eyebrow">LEGAL</p><h1>이용약관</h1><p>시행일: 2026년 10월 11일</p></header><section class="os-panel"><h2>1. 서비스</h2><p>오프사이드(풀타임)는 웹 브라우저와 iOS·Android 앱에서 이용하는 무료 축구 커리어 스토리 시뮬레이션 게임입니다. 플레이 중인 세이브(게임 진행) 자체는 이용자의 기기(브라우저·앱 저장소)에만 저장됩니다. 다만 커리어·시즌 요약 기록과 플레이 중 선택 기록은 익명 프로필 단위로 서버(Cloudflare D1)에도 저장되어 서비스 개선과 밸런스 분석에 쓰입니다. 은퇴한 선수의 커리어 기록은 명예의 전당에서 모든 이용자에게 공개됩니다. ${NAME_POLICY} 자세한 내용은 개인정보처리방침을 따릅니다. 앱의 '광고 제거'는 한 번 사면 계속 쓰는 유료 인앱 상품입니다. 앱에서 파는 리롤권·잠재력 강화권·프리미엄 스카우트권 묶음은 로그인한 구단주 계정에 들어오는 소모성 유료 인앱 상품으로, 쓰면 없어지고 다른 계정으로 옮길 수 없습니다. 앱 결제와 환불은 App Store·Google Play 정책을 따르며, 환불된 구매로 받은 아이템은 회수할 수 있습니다.</p><p id="web-pay">웹에서는 로그인한 구단주가 같은 아이템 묶음과 시즌 패스, 클럽 멤버십 30일 이용권을 살 수 있습니다. 웹에서 산 멤버십 이용권은 자동으로 다시 결제되지 않고 30일 뒤 끝나며, 이용 중에 다시 사면 끝나는 날부터 30일이 이어집니다. 웹 결제는 게임 결제 대행사 Xsolla가 판매자로 결제·세금·결제 수단을 처리하며, 결제 화면에는 이용자 나라의 통화와 세금을 넣은 금액이 표시됩니다. 결제가 확인되면 아이템·시즌 패스·멤버십 혜택이 바로 구단주 계정에 적용됩니다. 받은 아이템을 쓰지 않았고 시즌 패스 보상이나 멤버십 혜택을 받지 않았다면 결제일로부터 7일 안에 청약철회(환불)를 요청할 수 있고, 이미 쓰거나 받은 것은 디지털 콘텐츠 특성상 청약철회가 제한됩니다. 미성년자가 법정대리인의 동의 없이 결제한 경우 본인이나 법정대리인이 취소할 수 있습니다. 환불·취소는 <a href="mailto:contact@offside-lab.com">contact@offside-lab.com</a>으로 요청하며, 환불되거나 결제 취소(차지백)된 구매로 받은 아이템과 시즌 패스 보상은 회수하고, 멤버십 이용권은 그때 끝납니다.</p></section><section class="os-panel"><h2>2. 계정</h2><p>게임은 로그인 없이 바로 이용할 수 있습니다. 구글 계정이나 Apple 계정을 연결하면 로그인 상태만 서버에 남고, 게임 진행 데이터는 여전히 이용자의 기기에만 남습니다.</p></section><section class="os-panel"><h2>3. 이용자의 의무</h2><p>서비스를 부정한 목적으로 이용하거나 타인의 계정을 도용해서는 안 됩니다.</p><p>댓글, 라운지 채팅 메시지, 공개한 선수 이름, 구단 이름·감독 이름 등 이용자가 올리는 글에 욕설·비방·차별, 음란하거나 불쾌한 내용, 광고·스팸, 타인의 개인정보를 담아서는 안 됩니다. 오프사이드는 이런 내용과 이를 올리는 이용자를 용인하지 않으며, 발견하거나 신고를 받으면 해당 글을 지우거나 이름을 가리고, 댓글·채팅 작성 등 서비스 이용을 제한할 수 있습니다.</p><p>이용자는 댓글마다 있는 신고 버튼으로 부적절한 댓글을 신고하고, 작성자를 차단해 그 사람의 댓글을 보지 않을 수 있습니다. 라운지 채팅에서도 메시지마다 있는 메뉴(⋯)로 신고하고 작성자를 차단할 수 있으며, 여러 이용자가 신고한 메시지는 운영자 확인 전에도 자동으로 가려집니다. 명예의 전당 선수 상세와 팀 프로필의 이름 신고 버튼으로 부적절한 이름도 신고할 수 있습니다. 신고는 운영자가 24시간 안에 확인해 조치합니다.</p></section><section class="os-panel"><h2>4. 서비스 변경·중단</h2><p>운영상·기술상 필요에 따라 서비스 내용이 변경되거나 중단될 수 있으며, 이 경우 합리적인 방법으로 안내합니다. 게임 데이터가 기기에만 저장되는 특성상, 서비스 중단이 곧바로 이용자의 진행 데이터 손실로 이어지지는 않습니다(단, 브라우저 저장소 삭제·기기 변경 시에는 데이터가 사라질 수 있습니다).</p></section><section class="os-panel"><h2>5. 면책</h2><p>본 서비스는 현 상태(AS-IS)로 제공되며, 게임 결과나 확률적 연출로 인한 손해에 대해 책임지지 않습니다.</p></section><section class="os-panel"><h2>6. 문의</h2><p><a href="mailto:contact@offside-lab.com">contact@offside-lab.com</a></p></section>${businessSection()}<nav><a href="/">홈</a> · <a href="/app/">앱 받기</a> · <a href="/legal/privacy/">개인정보처리방침</a></nav></div>`;
const privacyBody = `<div class="os-screen"><header><p class="os-eyebrow">LEGAL</p><h1>개인정보처리방침</h1><p>시행일: 2026년 10월 11일</p></header><section class="os-panel"><h2>1. 수집하는 정보</h2><p>게임은 로그인 없이 이용할 수 있습니다. 로그인·공개 기록·선택적 이용 분석에서 처리하는 정보는 아래와 같습니다. 구글 계정으로 로그인하는 경우에만 구글이 제공하는 고유 식별자(sub)와 이메일 주소를 수집합니다. 웹이나 iOS 앱에서 Apple로 로그인하는 경우에는 Apple이 제공하는 고유 식별자(sub)만 저장하며 이메일은 저장하지 않습니다. 플레이 중인 세이브(선수 능력치, 진행 중인 시즌 등) 자체는 서버로 전송되지 않고 이용자의 브라우저(앱은 기기 저장소)에만 저장됩니다. 그와 별개로, 커리어·시즌 요약 기록(포지션·소속·기록·수상 등)과 플레이 중 선택 기록은 서비스 개선과 밸런스 분석을 위해 로그인 여부와 관계없이 익명 프로필 단위로 서버(Cloudflare D1)에 저장됩니다. 은퇴한 선수의 커리어 기록(레전드 점수·시즌별 기록·수상·등번호·포지션)은 명예의 전당에서 모든 이용자에게 공개됩니다. ${NAME_POLICY} 이름은 공개하는 동안에만 서버에 저장되며, 설정을 끄면 다음 시즌 기록부터 익명으로 올라갑니다. 은퇴한 선수는 은퇴 화면과 내 선수 상세에서 언제든 익명으로 되돌릴 수 있습니다. 댓글·이름을 신고하거나 작성자를 차단하면 그 기록(신고한 댓글·사유, 신고한 이름, 차단한 작성자)이 익명 프로필 단위로 저장되며, 계정을 삭제하면 함께 삭제됩니다. 라운지 채팅에 보낸 메시지(닉네임·내용·보낸 시각)는 채팅 서버(Cloudflare Durable Objects)에 보관되어 모든 이용자에게 보이며, 채팅 메시지를 신고하면 운영자 확인을 위해 그 메시지의 사본(작성자 닉네임·내용)과 신고 사유가 함께 저장됩니다.</p></section><section class="os-panel"><h2>2. 자동 수집 정보</h2><p>서비스 운영과 보안을 위해 접속 세션 정보와 요청 로그(접속 시각, IP, 오류 로그 등)를 일정 기간 보관합니다.</p></section><section class="os-panel"><h2>3. 이용 목적</h2><p>로그인 상태 유지, 계정 연동·해제, 부정 이용 방지, 서비스 안정성 확보와 위에서 설명한 서비스 개선·밸런스 분석에 이용합니다. 선택적 Google Analytics 분석과 Meta 픽셀 광고 측정은 동의한 경우에만 수행합니다.</p></section><section class="os-panel"><h2>4. 제3자 제공 및 국외 이전</h2><p>서비스는 Cloudflare(호스팅·인프라), Google(로그인, 동의한 경우 이용 분석, 광고), Meta Platforms(웹에서 동의한 경우 광고 측정), Apple(로그인), Xsolla(웹 결제)를 이용하며, 이 과정에서 위 정보가 해당 사업자의 해외 서버로 이전되어 처리될 수 있습니다.</p></section><section class="os-panel"><h2>5. 보유 기간</h2><p>계정 정보와 커리어·시즌 요약·선택 기록은 이용자가 계정 삭제를 요청할 때까지 보관하며, 요청 시 지체 없이 함께 삭제합니다. 라운지 채팅 메시지는 보낸 지 7일, 채팅 신고 기록은 90일이 지나면 자동으로 삭제하고, 채팅 정지 기록은 정지 기간이 끝나면 삭제합니다(계정을 삭제하면 채팅 신고·정지 기록은 바로 삭제되고, 이미 보낸 메시지는 7일 보관 기간이 끝날 때 삭제됩니다). 플레이 중인 세이브는 이용자의 브라우저(앱은 기기)에만 있으므로, 브라우저 저장소를 지우거나 앱을 삭제하면 즉시 삭제됩니다.</p></section><section class="os-panel"><h2>6. 이용자의 권리</h2><p>웹과 앱의 설정·계정 화면에서 언제든 구글 계정 연동 해제, 로그아웃, 계정 삭제를 요청할 수 있습니다. 계정 삭제는 확인 절차를 거쳐 처리됩니다.</p></section><section class="os-panel" id="analytics"><h2>7. 선택적 이용 분석 (Google Analytics)</h2><p>게임 개선과 유입 경로·플레이 지속률 분석을 위해, 이용자가 분석에 동의한 경우에만 웹에서는 Google Analytics 4 태그를, 앱에서는 Google Analytics for Firebase를 사용합니다. 동의 전과 거절한 경우에는 분석 요청을 보내지 않으며, 앱은 동의 전 활동을 나중에 몰아 보내지도 않습니다. 거절해도 게임 이용에는 불이익이 없습니다.</p><p>Google LLC는 쿠키 기반 브라우저 식별자, 방문 시각·기기·브라우저 정보, 허용된 유입 경로와 캠페인, 정규화한 화면 이동, 커리어 시작·첫 시즌 완료·은퇴·공유 버튼 시도 및 링크 복사 성공 정보를 해외 서버에서 처리합니다. 앱에서는 브라우저 쿠키 대신 앱 설치마다 만들어지는 분석용 식별자(앱 인스턴스 ID)와 세션·기기 모델·운영체제·앱 버전·대략적인 지역 같은 Firebase 표준 정보, 그리고 게임 화면 이동과 커리어 시작·첫 진행·첫 시즌 완료·시즌 진행 단계·이어하기·은퇴 정보를 처리합니다. 앱 이용 분석에는 광고 식별자(IDFA·Android 광고 ID)를 사용하지 않습니다. 앱에 표시되는 광고가 쓰는 정보는 9항에서 따로 안내합니다. 선수 이름·닉네임·이메일·계정 및 커리어 ID·인증 정보·입력한 자유 텍스트는 분석 이벤트에 포함하지 않으며, 원본 주소의 식별자·검색어·해시를 제거합니다. 이용 분석에는 광고 연동·Google Signals·User-ID를 사용하지 않습니다.</p><p>GA4의 사용자·이벤트 데이터 보관 기간은 2개월로 설정합니다. 집계 보고서는 이 기간과 다르게 보관될 수 있습니다. 이 브라우저의 분석 쿠키는 최대 60일, 이벤트 중복 방지 기록(웹·앱)은 최근 30일·최대 200개 커리어와 현재 커리어만 보관합니다. 분석 기록은 게임 세이브와 분리합니다.</p><p>웹은 환경설정의 이용 분석 선택에서, 앱은 설정의 '앱 이용 분석 동의 (선택)'에서 언제든 동의를 철회할 수 있습니다. 철회하면 이후 수집을 중단하고 웹은 이 브라우저의 분석용 쿠키와 중복 방지 기록을, 앱은 기기의 분석 데이터(앱 인스턴스 ID 포함)와 중복 방지 기록을 삭제합니다. 이미 전송된 정보가 자동 삭제되는 것은 아니며, 관련 문의는 아래 연락처로 할 수 있습니다. Google의 처리 방식은 <a href="https://policies.google.com/privacy">Google 개인정보처리방침</a>에서 확인할 수 있습니다.</p></section><section class="os-panel" id="meta"><h2>8. 선택적 광고 측정 (Meta 픽셀)</h2><p>페이스북·인스타그램 광고로 들어온 방문이 실제로 게임을 시작했는지 재기 위해, 웹에서 이용 분석 카드에 동의한 경우에만 Meta Platforms의 Meta 픽셀을 불러옵니다. 동의 전과 거절한 경우에는 픽셀을 불러오지 않으며, 거절해도 게임 이용에는 불이익이 없습니다. 앱에는 Meta 픽셀이나 SDK를 넣지 않습니다.</p><p>Meta는 쿠키(_fbp, 광고를 눌러 들어온 경우 _fbc)로 만든 브라우저 식별자, 광고 클릭 식별자, 방문한 페이지 주소, 기기·브라우저 정보와 IP 주소, 그리고 커리어 시작·첫 시즌 완료·App Store 버튼 이용 여부를 해외 서버에서 처리합니다. 선수 이름·닉네임·이메일·계정 및 커리어 ID는 보내지 않으며, 버튼·페이지 내용을 자동으로 수집하는 기능과 고객 정보 매칭은 쓰지 않습니다. 광고를 눌러 들어왔다는 표시는 안내 화면 순서를 정하기 위해 이 브라우저에만 저장하고 서버로 보내지 않습니다.</p><p>웹 환경설정의 이용 분석 선택에서 언제든 동의를 철회할 수 있습니다. 철회하면 이후 전송을 멈추고 이 브라우저의 _fbp·_fbc 쿠키를 지웁니다. Meta의 처리 방식은 <a href="https://www.facebook.com/privacy/policy/">Meta 개인정보처리방침</a>에서 확인할 수 있습니다.</p></section><section class="os-panel" id="ads"><h2>9. 광고 (Google AdSense · AdMob)</h2><p>기록실·소식·선수 상세처럼 읽는 화면의 맨 아래에 광고를 보여 줄 수 있습니다. 웹은 Google AdSense, iOS·Android 앱은 Google AdMob을 씁니다. 게임을 조작하는 화면에는 광고를 두지 않으며, 광고를 보지 않아도 게임 이용에 불이익이 없습니다.</p><p>광고를 보여 주기 위해 Google LLC가 웹에서는 쿠키 등으로 브라우저 정보와 방문한 페이지 주소를, 앱에서는 기기 광고 식별자와 앱 정보를, 그리고 기기 정보와 IP 주소를 해외 서버에서 처리합니다. 서비스는 관심사에 따른 맞춤 광고를 요청하지 않고 비개인화 광고만 요청합니다. 비개인화 광고도 빈도 제한·부정 클릭 방지·집계 보고를 위해 쿠키나 광고 식별자를 사용할 수 있습니다. iOS 앱은 앱 추적 동의를 요청하지 않습니다. 유럽경제지역·영국·스위스의 앱 이용자에게는 광고를 요청하기 전에 Google 동의 메시지를 보여 주며, 동의하지 않아도 게임은 그대로 이용할 수 있습니다. 앱에서는 광고를 영구히 끄는 '광고 제거'를 인앱 결제로 살 수 있습니다. 결제는 Apple·Google이 처리하며, 서비스는 결제 정보를 받지 않고 구매 여부만 기기에서 확인합니다. 리롤권·잠재력 강화권 묶음을 사면 아이템을 한 번만 주기 위해 스토어가 준 거래 식별자, 상품, 구매 시각, 테스트 구매 여부를 구단주 프로필에 연결해 서버(Cloudflare D1)에 보관하고, 계정을 삭제하면 함께 삭제합니다. 구매를 확인하려고 Apple이 서명한 거래 정보를 서버에서 검증하고, Google Play 구매는 Google Play Developer API로 Google에 확인합니다. 웹에서 아이템 묶음·시즌 패스·멤버십 이용권을 사면 결제는 Xsolla가 판매자로 처리하며, 카드 번호 등 결제 정보는 Xsolla 결제 화면에 직접 입력되어 서비스로 전달되지 않습니다. 서비스는 아이템을 주고 환불을 처리하기 위해 주문 번호, Xsolla 주문 번호, 상품, 결제 금액과 통화, 결제·환불 시각, 결제 상태를 구단주 프로필에 연결해 서버(Cloudflare D1)에 보관하고, 결제 화면을 열 때 구단주 프로필 식별자, 접속 나라(알 수 없으면 IP 주소)와 화면 언어를 Xsolla에 보냅니다. Xsolla의 처리 방식은 <a href="https://xsolla.com/privacypolicy">Xsolla 개인정보처리방침</a>에서 확인할 수 있습니다. 선수 이름·닉네임·이메일·계정 및 커리어 정보는 광고에 전달하지 않습니다. 앱은 광고 운영을 개선하기 위해 시즌 기록을 보낼 때 그 사이 이 기기에서 보상형 광고로 받은 보상 수, 광고 제거로 광고 없이 받은 보상 수, 은퇴 전면광고가 뜬 횟수와 광고 제거 보유 여부를 함께 보냅니다. 이 숫자는 다른 시즌 기록처럼 익명 프로필 단위로 서버(Cloudflare D1)에 저장되고 광고 회사에는 보내지 않습니다.</p><p>Google의 광고 쿠키 사용과 맞춤 광고 설정은 <a href="https://policies.google.com/technologies/ads">Google 광고 정책</a>과 <a href="https://adssettings.google.com">Google 광고 설정</a>에서 확인하고 바꿀 수 있습니다. 브라우저 설정에서 쿠키를 차단하거나 기기 설정에서 광고 식별자를 재설정·삭제해도 게임은 그대로 이용할 수 있습니다.</p></section><section class="os-panel" id="push"><h2>10. 선택적 앱 알림과 알림함</h2><p>iOS·Android 앱에서 알림 받기를 선택하고 기기 권한을 허용한 경우에만 수신 기기를 등록합니다. 알림 연결에는 기기별 설치 식별자의 해시, 푸시 토큰, 연결된 프로필·세션, 운영체제 종류, 앱 버전, 마지막 등록 시각을 사용합니다. 게임 진행·선수 이름·이메일을 푸시 내용에 넣지 않습니다. 설치 식별자 원본은 기기 보안 저장소에만 보관합니다.</p><p>푸시 토큰과 알림 내용은 Expo Push Service를 거쳐 Apple APNs 또는 Google FCM으로 전송되어 해당 사업자의 해외 서버에서 처리될 수 있습니다. 새 공지·릴리즈 노트는 게시판마다 한국 시간 하루 한 번 보내며, 알림을 켠 이용자는 본인 기기의 연결 테스트를 10분에 한 번·하루 3회까지 요청할 수 있습니다. 앱 알림을 켠 기기에는 마지막 등록 갱신 시각을 참고해 7일 이상 미방문한 이용자에게 오전 9시부터 오후 8시 사이에 안내합니다. <a href="https://expo.dev/privacy">Expo 개인정보처리방침</a>을 확인할 수 있습니다.</p><p>앱 설정에서 알림을 끄면 서버의 기기 등록을 해제합니다. 연결이 끊겨 해제가 실패하면 기기에서 해제 대기를 보관하고 다음 연결 때 다시 처리합니다. 서버의 등록 정보는 마지막 등록에서 90일이 지나면 정기 정리 때 삭제합니다. 폐기·만료된 세션이나 삭제된 프로필에는 새 알림을 보내지 않습니다. 알림함은 프로필별 알림 내용·관련 화면·생성 시각과 읽음 시각을 서버에 90일간 보관하고, 기간이 지나면 정기 정리 때 삭제합니다. 계정을 삭제하면 알림함과 발송 기록도 함께 삭제합니다. 발송 큐는 만료 30일 뒤 정리하며 종료한 큐의 푸시 토큰은 비웁니다. 알림 수신을 끄더라도 알림함 기록은 보관 기간 동안 남습니다. 서비스 운영과 알림 개선을 위해 발송 접수·전달 확인·실패·취소 결과, 앱 알림을 누른 시각과 연결 화면으로 이동한 시각을 해당 알림의 익명 프로필 기록에 연결하여 서버(Cloudflare D1)에 90일간 보관합니다. 알림함 열람은 푸시 클릭으로 집계하지 않으며, 계정을 삭제하면 이 기록도 함께 삭제합니다. 이 운영 기록은 Google Analytics로 전송하지 않습니다. 알림을 받지 않아도 게임을 이용할 수 있습니다.</p></section><section class="os-panel" id="acquisition"><h2>유입과 앱 결제 연결(선택)</h2><p>별도로 동의하면 오프사이드 서버(Cloudflare D1)에 허용된 캠페인 구분, 임의 세션 식별자, 서버 수신 시각, 게임 시작·앱 이동 여부를 기록합니다. Google 또는 Apple로 연결한 동일 프로필에서만 검증된 앱 구매와 연결하며, 로그인하지 않은 웹 방문과 익명 앱 설치를 자동 연결하지 않습니다. 구매 전 30일 내 유입의 최초·최종 접점을 각각 기록합니다. 광고 식별자, 기기 지문, 이메일은 수집하거나 광고 회사·Google Analytics로 전송하지 않습니다. 유입 기록은 90일 후 매일 최대 1,000건씩 삭제하고, 철회·계정 삭제 시 연결 기록을 삭제합니다. 철회 뒤 도착하는 오래된 동의 요청을 막기 위한 최소 철회 표식(프로필·철회 상태·revision·철회 시각)은 계정 삭제까지 보관합니다. 앱의 선택적 거래 전송 대기열은 동의한 프로필·스토어·구매 토큰·대기 시각만 기기에 최대 16건 저장하고, 7일이 지난 기록은 다음 앱 활동 때 삭제합니다. 분석 동의 철회나 앱 세션 변경 시 대기열을 삭제합니다. 스토어 결제 승인과 광고 제거 권한은 이 선택적 전송과 독립적으로 처리합니다. 결제 이행에 필요한 거래 원장은 별도로 유지됩니다. 네트워크 장애 시 철회 반영은 재접속 후 완료됩니다. 거절해도 게임을 이용할 수 있습니다.</p></section><section class="os-panel"><h2>11. 문의</h2><p>개인정보 관련 문의는 <a href="mailto:contact@offside-lab.com">contact@offside-lab.com</a>으로 연락해 주세요.</p></section><nav><a href="/">홈</a> · <a href="/app/">앱 받기</a> · <a href="/legal/terms/">이용약관</a></nav></div>`;

// 앱 번들의 진입 스크립트(예: <script type="module" crossorigin src="/assets/index-*.js">)와
// 그 청크들에 대한 modulepreload 링크. /guide, /faq, /legal/* 는 크롤러·noscript용 정적
// 페이지라 이 태그들이 남아 있으면 실제 브라우저(JS 켠 사용자)에서 main.ts가 즉시 실행되어
// 이 정적 콘텐츠를 홈 화면으로 덮어써 버린다. 스타일시트는 페이지가 제대로 보이도록 유지한다.
// 속성 순서와 무관하게 src가 있는 모든 <script>와 modulepreload를 지우고, 하나라도 남으면 빌드를
// 실패시킨다 — Vite 출력 형태가 바뀌어도 앱이 정적 페이지를 덮어쓰는 상태로 조용히 배포되지 않는다.
export function stripAppBundle(html) {
  const out = html
    .replace(/\s*<script\b[^>]*\bsrc=[^>]*>\s*<\/script>/gi, '')
    .replace(/\s*<link\b[^>]*\brel=["']?modulepreload["']?[^>]*>/gi, '');
  if (/<script\b[^>]*\bsrc=/i.test(out) || /modulepreload/i.test(out))
    throw new Error('seo: 공개 페이지에서 앱 번들 태그를 모두 제거하지 못했습니다.');
  return out;
}

export function pageHtml(
  baseHtml,
  config,
  path,
  body,
  { forceNoIndex = false, keepAppBundle = false } = {},
) {
  const page = PUBLIC_PAGES[path] ?? PUBLIC_PAGES['/'];
  const html = keepAppBundle ? baseHtml : stripAppBundle(baseHtml);
  return html
    .replace(/<html lang="[^"]*"/, `<html lang="${GUIDE_LOCALES[pathLang(path)].html}"`)
    .replace(/<title>.*?<\/title>/s, `<title>${page.title}</title>`)
    .replace(
      /<!-- offside-seo:start -->[\s\S]*?<!-- offside-seo:end -->/,
      createHeadMarkup(config, path, forceNoIndex),
    )
    .replace(
      /<div id="app">[\s\S]*?<\/div>\s*<div id="modal"/,
      `<div id="app"><main id="game-content">${body}</main></div>\n<div id="modal"`,
    );
}
async function createBrandAssets(outputDirectory) {
  const sizes = [64, 180, 192, 512];
  const resized = new Map();
  const brandSvg = Buffer.from(iconSvg('light'));
  for (const size of sizes) {
    const buffer = await sharp(brandSvg).resize(size, size).png().toBuffer();
    resized.set(size, buffer);
    await writeFile(
      join(outputDirectory, 'brand', `offside-icon-${BRAND_VERSION}-${size}.png`),
      buffer,
    );
  }
  await sharp(Buffer.from(iconSvg('dark')))
    .resize(64, 64)
    .png()
    .toFile(join(outputDirectory, 'brand', `offside-icon-${BRAND_VERSION}-dark-64.png`));
  await sharp(Buffer.from(iconSvg('light', { rounded: false, artScale: 0.8 })))
    .resize(512, 512)
    .png()
    .toFile(join(outputDirectory, 'brand', `offside-icon-${BRAND_VERSION}-maskable-512.png`));
  await writeFile(join(outputDirectory, 'favicon.svg'), brandSvg);
  await writeFile(join(outputDirectory, 'favicon.png'), resized.get(64));
  // PNG를 그대로 담은 단일 이미지 ICO — /favicon.ico를 직접 요청하는 크롤러·브라우저용.
  const png = resized.get(64);
  const ico = Buffer.alloc(22);
  ico.writeUInt16LE(1, 2);
  ico.writeUInt16LE(1, 4);
  ico.writeUInt8(64, 6);
  ico.writeUInt8(64, 7);
  ico.writeUInt16LE(1, 10);
  ico.writeUInt16LE(32, 12);
  ico.writeUInt32LE(png.length, 14);
  ico.writeUInt32LE(22, 18);
  await writeFile(join(outputDirectory, 'favicon.ico'), Buffer.concat([ico, png]));
  const ogPath = join(outputDirectory, `og-offside-${BRAND_VERSION}.png`);
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: BRAND_BG } })
    .composite([
      { input: await sharp(brandSvg).resize(260, 260).png().toBuffer(), left: 84, top: 185 },
      {
        input: Buffer.from(
          `<svg width="760" height="260"><text x="0" y="112" fill="#E9EEE8" font-family="Arial,sans-serif" font-size="112" font-weight="800">OFFSIDE</text><text x="4" y="184" fill="#F2B632" font-family="Arial,sans-serif" font-size="40">FULLTIME · FOOTBALL CAREER</text></svg>`,
        ),
        left: 390,
        top: 192,
      },
    ])
    .png()
    .toFile(ogPath);
  await writeFile(join(outputDirectory, 'og-offside.png'), await readFile(ogPath));
  const flag = await sharp(brandSvg).resize(96, 96).png().toBuffer();
  for (const [id, label, rarity] of CAREER_OG_BANDS) {
    const stars = '★'.repeat(rarity) + '☆'.repeat(4 - rarity);
    await sharp({ create: { width: 1200, height: 630, channels: 4, background: BRAND_BG } })
      .composite([
        { input: flag, left: 84, top: 72 },
        {
          input: Buffer.from(
            `<svg width="1200" height="630"><text x="200" y="136" fill="#E9EEE8" font-family="Arial,sans-serif" font-size="48" font-weight="800">OFFSIDE</text>` +
              `<text x="84" y="300" fill="#9FB0A4" font-family="Arial,sans-serif" font-size="34" letter-spacing="6">RETIRED · HALL OF FAME</text>` +
              `<text x="84" y="392" fill="#F2B632" font-family="Arial,sans-serif" font-size="76" font-weight="800">${label}</text>` +
              `<text x="84" y="470" fill="#F2B632" font-family="Arial,sans-serif" font-size="44">${stars}</text>` +
              `<rect x="84" y="522" width="1032" height="2" fill="#2A3A30"/>` +
              `<text x="84" y="572" fill="#9FB0A4" font-family="Arial,sans-serif" font-size="30">offside-lab.com · FOOTBALL CAREER SIMULATOR</text></svg>`,
          ),
          left: 0,
          top: 0,
        },
      ])
      .png()
      .toFile(join(outputDirectory, `og-career-${id}-${BRAND_VERSION}.png`));
  }
  await writeFile(
    join(outputDirectory, 'site.webmanifest'),
    JSON.stringify({
      id: '/',
      name: 'OFFSIDE',
      short_name: 'OFFSIDE',
      lang: 'ko',
      start_url: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: BRAND_BG,
      theme_color: BRAND_BG,
      icons: [
        {
          src: `/brand/offside-icon-${BRAND_VERSION}-192.png`,
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: `/brand/offside-icon-${BRAND_VERSION}-512.png`,
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: `/brand/offside-icon-${BRAND_VERSION}-maskable-512.png`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    }),
  );
}
// T-11-231 운영 소개. AdSense 심사가 보는 운영 주체 · 연락처 · 정책 링크를 한 곳에 모은다.
const aboutBody = `<div class="os-screen"><header><p class="os-eyebrow">ABOUT</p><h1>오프사이드 소개</h1><p>오프사이드(풀타임)는 웹 브라우저와 iOS · Android 앱에서 무료로 즐기는 축구 선수 커리어 시뮬레이션 게임입니다.</p></header><section class="os-panel"><h2>어떤 게임인가요</h2><p>고교 3학년 선수 한 명을 만들어 은퇴할 때까지 키웁니다. 시즌마다 훈련 방향을 고르고, 성공 확률이 표시된 이벤트 선택지를 고르며, 이적 · 국가대표 · 병역 · 부상 같은 갈림길을 지납니다. 같은 선수라도 선택과 확률에 따라 전혀 다른 커리어가 나옵니다.</p><p>은퇴한 선수는 통산 기록으로 레전드 점수를 받고 <a href="/legends/">명예의 전당</a>에 오릅니다. 지금까지 이용자들이 키운 선수 수만 명의 시즌별 기록을 누구나 볼 수 있습니다. 은퇴한 선수로는 구단주 팀을 꾸려 다른 이용자의 팀과 경기하고, 시즌마다 열리는 오프사이드 컵에 나갑니다.</p></section><section class="os-panel"><h2>어떻게 운영하나요</h2><p>오프사이드는 1인 개발자가 만들고 운영합니다. 게임 규칙과 확률은 <a href="/fairness/">확률과 공정성</a>에 공개하고, 바뀐 내용은 <a href="/news/">공지와 업데이트</a>에 기록으로 남깁니다. 밸런스는 실제 은퇴 기록과 대량 시뮬레이션으로 확인한 뒤 모든 이용자에게 같은 값으로 바꿉니다.</p><p>게임은 설치나 로그인 없이 바로 할 수 있고, 진행 상황은 이용자의 기기에 저장됩니다. 서버에는 명예의 전당과 구단주 팀에 필요한 기록만 남습니다. iPhone · Android 앱은 <a href="/app/">앱 소개 페이지</a>에서 받을 수 있습니다. 자세한 내용은 <a href="/legal/privacy/">개인정보처리방침</a>과 <a href="/legal/terms/">이용약관</a>을 확인해 주세요.</p></section><section class="os-panel"><h2>문의</h2><p>게임 문의, 오류 제보, 제안은 <a href="mailto:contact@offside-lab.com">contact@offside-lab.com</a>으로 보내 주세요. 게임 안 라운지 채팅과 게시판에서도 의견을 받습니다.</p></section><p><a href="/">게임 시작</a></p><nav><a href="/">홈</a> · <a href="/app/">앱 받기</a> · <a href="/guide/">게임 가이드</a> · <a href="/faq/">자주 묻는 질문</a> · <a href="/legends/">명예의 전당</a></nav></div>`;

export const STATIC_PAGES = {
  '/about/': aboutBody,
  ...Object.fromEntries(
    GUIDE_LANGS.flatMap((lang) => {
      const { prefix, articles } = GUIDE_LOCALES[lang];
      return [
        [`${prefix}/guide/`, guideBody(lang)],
        ...articles.map((a) => [`${prefix}${articlePath(a.slug)}`, articleBody(lang, a)]),
        [`${prefix}/faq/`, faqBody(lang)],
      ];
    }),
  ),
  '/fairness/': fairnessBody,
  '/legal/terms/': termsBody,
  '/legal/privacy/': privacyBody,
};

/** T-11-584 /app/ 랜딩 문서. 다른 공개 페이지와 같은 SEO 머리(색인 · canonical · 구조화 데이터)를 쓴다. */
export const landingPage = (config) =>
  landingHtml(createHeadMarkup(config, '/app/'), PUBLIC_PAGES['/app/'].title);

export function seoPlugin(config) {
  let outputDirectory = 'dist';
  return {
    name: 'offside-seo',
    configResolved(c) {
      outputDirectory = c.build.outDir;
    },
    // 정적 공개 페이지는 빌드 때만 만들어져 로컬 dev 서버에서는 SPA 홈으로 떨어졌다 — dev에서도 같은 본문을 낸다.
    // 앱 번들을 걷어 내면 CSS도 빠지므로(dev는 main.ts가 CSS를 주입한다) 스타일시트를 직접 건다.
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0];
        const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
        if (path === '/app/') {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.end(landingPage(config));
        }
        const body = STATIC_PAGES[path];
        if (!body) return next();
        // #app 은 pageHtml이 본문으로 갈아 끼우므로 앱 셸 렌더(T-10-041)는 건너뛴다.
        const index = (await readFile(join(server.config.root, 'index.html'), 'utf8')).replace(
          APP_SHELL_MARK,
          '',
        );
        const base = await server.transformIndexHtml(path, index);
        const html = pageHtml(base, config, path, body).replace(
          '</head>',
          '<link rel="stylesheet" href="/src/style.css" />\n</head>',
        );
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
      });
    },
    transformIndexHtml(html) {
      return html
        .replace(/<title>.*?<\/title>/s, `<title>${PUBLIC_PAGES['/'].title}</title>`)
        .replace('</head>', `${createHeadMarkup(config)}\n</head>`);
    },
    async closeBundle() {
      const base = await readFile(join(outputDirectory, 'index.html'), 'utf8');
      for (const [path, body] of Object.entries(STATIC_PAGES)) {
        const directory = join(outputDirectory, path.slice(1));
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, 'index.html'), pageHtml(base, config, path, body));
      }
      await mkdir(join(outputDirectory, 'app'), { recursive: true });
      await writeFile(join(outputDirectory, 'app', 'index.html'), landingPage(config));
      await writeFile(
        join(outputDirectory, 'news-shell.html'),
        pageHtml(base, config, '/', '<!-- public-news-body -->', { forceNoIndex: true }),
      );
      await writeFile(
        join(outputDirectory, 'app-shell.html'),
        pageHtml(base, config, '/', '<p>게임을 불러오는 중입니다.</p>', {
          forceNoIndex: true,
          keepAppBundle: true,
        }),
      );
      await writeFile(join(outputDirectory, 'robots.txt'), createRobotsTxt(config));
      if (config.origin)
        await writeFile(join(outputDirectory, 'llms.txt'), createLlmsTxt(config.origin));
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
      await mkdir(join(outputDirectory, 'brand'), { recursive: true });
      await createBrandAssets(outputDirectory);
    },
  };
}
