import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { APP_SHELL_MARK } from './app-shell.mjs';

const BRAND_SOURCE = fileURLToPath(
  new URL('../brand/offside-app-icon-fulltime-v6.svg', import.meta.url),
);
export const BRAND_VERSION = 'v6';
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

export const PUBLIC_PAGES = {
  '/': {
    title: '오프사이드 | 이번 생은 축구다 — 축구선수 커리어 시뮬레이션',
    description:
      '이번 생은 축구다. 오프사이드(풀타임)에서 고교 3학년부터 은퇴까지, 훈련·이적·이벤트 선택으로 한 선수의 커리어를 만듭니다. 설치 없이 바로 하는 무료 웹 시뮬레이션 게임입니다.',
  },
  '/guide/': {
    title: '게임 가이드 | 오프사이드',
    description:
      '오프사이드(풀타임)의 선수 생성, 시즌 진행, 이벤트와 확률, 성장, 이적, 국가대표, 병역, 은퇴와 명예의 전당까지 처음부터 알아봅니다.',
  },
  '/faq/': {
    title: '자주 묻는 질문 | 오프사이드',
    description:
      '오프사이드(풀타임)의 저장 방식, 계정 연동, 진행 방법, 지원 문의 등 게임 이용 전에 궁금한 점을 확인하세요.',
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
// FAQPage는 /faq/ 본문과 같은 FAQ_ITEMS에서 만들어 화면과 어긋나지 않게 한다.
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
        image: `${origin}/og-offside-flag-${BRAND_VERSION}.png`,
        inLanguage: 'ko',
        genre: ['스포츠', '시뮬레이션'],
        gamePlatform: 'Web browser',
        applicationCategory: 'GameApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
      },
    ];
  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: home },
      {
        '@type': 'ListItem',
        position: 2,
        name: PUBLIC_PAGES[path].title.split(' | ')[0],
        item: url,
      },
    ],
  };
  if (path !== '/faq/') return [breadcrumb];
  const text = (html) => html.replace(/<[^>]+>/g, '');
  return [
    breadcrumb,
    {
      '@type': 'FAQPage',
      mainEntity: FAQ_ITEMS.map(([q, a]) => ({
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
  const imagePath = `/og-offside-flag-${BRAND_VERSION}.png`;
  const image = config.origin ? `${config.origin}${imagePath}` : imagePath;
  return `<!-- offside-seo:start --><script>document.documentElement.dataset.publicRobots=${JSON.stringify(robots)}</script><meta name="description" content="${escapeHtml(page.description)}" />
    <meta name="robots" content="${robots}" />
    <meta property="og:type" content="website" /><meta property="og:locale" content="ko_KR" /><meta property="og:site_name" content="OFFSIDE" />
    <meta property="og:title" content="${escapeHtml(page.title)}" /><meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:image" content="${escapeHtml(image)}" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />
    ${canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}" /><link rel="canonical" href="${escapeHtml(canonical)}" />` : ''}
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/brand/offside-flag-${BRAND_VERSION}-64.png" type="image/png" sizes="64x64" />
    <link rel="apple-touch-icon" href="/brand/offside-flag-${BRAND_VERSION}-180.png" sizes="180x180" />
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
  return `# 오프사이드 (OFFSIDE · 풀타임)\n\n> ${PUBLIC_PAGES['/'].description}\n\n웹 브라우저에서 무료로 플레이하는 한국어 축구 선수 커리어 스토리 시뮬레이션 게임이다. 설치나 로그인 없이 바로 시작할 수 있다.\n\n## 문서\n\n${['/guide/', '/faq/'].map(link).join('\n')}\n\n## 정책\n\n${['/legal/terms/', '/legal/privacy/'].map(link).join('\n')}\n`;
}
export function createHeaders({ indexingEnabled }) {
  const publicHeaders = PUBLIC_PATHS.map(
    (path) => `${path}\n  X-Robots-Tag: ${indexingEnabled ? 'index, follow' : 'noindex, nofollow'}`,
  ).join('\n\n');
  return `/*\n  X-Robots-Tag: noindex, nofollow\n\n${publicHeaders}\n`;
}

// T-10-065 선수 이름 공개 정책(가이드·FAQ·약관·개인정보처리방침이 같은 문장을 쓴다).
const NAME_POLICY =
  '선수 이름은 환경설정의 ‘선수 이름 공개’가 켜져 있으면(기본값) 홈 라이브 현황·명예의 전당·서버 최초 업적에 함께 공개되고, 끄면 익명으로 표시됩니다.';
const guideBody = `<div class="os-screen"><header><p class="os-eyebrow">HOW TO PLAY</p><h1>게임 가이드</h1><p>고교 3학년 킥오프부터 은퇴까지, 한 명의 축구 선수를 만들고 이어 가는 기본 흐름입니다.</p></header><section class="os-panel"><h2>1. 선수 생성</h2><p>이름, 등번호, 포지션(FW·MF·DF·GK), 주발, 플레이 유형(강점·약점), 성장 특성을 정하고 고교 3학년 시즌을 시작합니다. 잠재력 평가는 은퇴할 때 공개됩니다. 현재 능력치와 실제 성장 기록을 보며 선수를 키웁니다.</p></section><section class="os-panel"><h2>2. 시즌 진행 — 프리시즌 · 전반기 · 후반기</h2><p>한 시즌은 프리시즌과 전반기·후반기 두 구간으로 진행됩니다. 구간마다 훈련 방향(체력·기술·전술 등)을 고르고 진행하면, 그 구간의 경기 결과가 한 번에 시뮬레이션되어 출전·골·도움·평점으로 쌓입니다.</p></section><section class="os-panel"><h2>3. 확률 이벤트와 스토리</h2><p>구간을 진행할 때마다 무작위 이벤트가 등장할 수 있습니다. 선택지마다 성공 확률이 공개되며, 일부 이벤트는 여러 시즌에 걸쳐 이어지는 연속 스토리로 발전합니다.</p></section><section class="os-panel"><h2>4. 능력치 성장</h2><p>OVR 하나가 아니라 스피드·슈팅·패스·드리블·수비·피지컬 같은 카드 능력치와, 그 아래 세부 능력치(포지션별 역할 OVR에 반영)가 함께 성장합니다. 육각형 레이더로 현재 능력치와 시즌 시작 시점을 비교할 수 있습니다.</p></section><section class="os-panel"><h2>5. 컵 대회 · 대륙 대회</h2><p>소속 리그에 따라 국내 컵, 슈퍼컵, 대륙 클럽 대회(챔피언스리그 등)에 함께 출전하며, 시즌이 끝나면 득점왕·MVP·발롱도르 같은 개인상을 노려볼 수 있습니다.</p></section><section class="os-panel"><h2>6. 이적 시장 · 계약</h2><p>시즌이 끝나면 잔류·재계약·이적 제안 중에서 다음 행선지를 정합니다. 성적과 평판에 따라 해외 리그로 도약할 수도 있습니다.</p></section><section class="os-panel"><h2>7. 국가대표 · 병역</h2><p>대표팀에 발탁되면 A매치·아시안컵·월드컵 등 국제 대회에 출전합니다. 병역 의무가 있는 나이가 되면 김천 상무 입대, 일반 입대, 국제대회 병역 특례 등 병역 관련 선택을 만나게 됩니다.</p></section><section class="os-panel"><h2>8. 은퇴와 명예의 전당</h2><p>나이가 들거나 더 이상 팀을 찾지 못하면 은퇴를 선언합니다. 통산 기록과 트로피, 수상 경력을 바탕으로 레전드 점수가 매겨지고, 명예의 전당에 이름이 남습니다.</p></section><section class="os-panel"><h2>진행 상황 저장</h2><p>진행 상황(세이브)은 이 브라우저(기기)에만 저장되며, 다른 기기로 옮기려면 같은 브라우저를 사용해야 합니다. 다만 커리어·시즌 요약 기록과 플레이 중 선택 기록은 서비스 개선·밸런스 분석을 위해 익명 프로필 단위로 서버에도 함께 저장됩니다. 은퇴한 선수의 커리어 기록은 명예의 전당에서 모든 이용자에게 공개됩니다. ${NAME_POLICY} 자세한 내용은 <a href="/legal/privacy/">개인정보처리방침</a>을 확인해 주세요.</p></section><p><a href="/">첫 커리어 시작</a></p><nav><a href="/">홈</a> · <a href="/faq/">자주 묻는 질문</a></nav></div>`;
const FAQ_ITEMS = [
  [
    '어떤 게임인가요?',
    '고교 3학년부터 은퇴까지, 한 축구 선수의 입장에서 매 시즌 훈련 방향을 고르고 확률 이벤트에 반응하며 커리어를 만들어 가는 스토리 시뮬레이션입니다.',
  ],
  [
    '진행 내용은 어디에 저장되나요?',
    '플레이 중인 세이브(선수 능력치, 진행 중인 시즌 등)는 이 브라우저의 로컬 저장소에만 남습니다. 저장소를 지우거나 기기를 바꾸면 세이브 자체는 이어갈 수 없습니다. 다만 커리어·시즌 요약 기록과 선택 기록은 익명 프로필 단위로 서버(Cloudflare D1)에도 저장되어 서비스 개선과 밸런스 분석에 쓰입니다. 은퇴한 선수의 기록은 명예의 전당에 공개됩니다. ' +
      NAME_POLICY +
      ' 계정을 삭제하면 이 기록도 함께 삭제됩니다.',
  ],
  [
    '구글 로그인은 왜 있나요?',
    '구글 계정 연결은 로그인 상태만을 위한 것으로, 게임 진행 데이터와는 별개입니다. 계정을 연결·해제하거나 로그아웃해도 이 기기의 게임 저장 데이터는 그대로 남습니다.',
  ],
  [
    '이벤트 성공 확률은 어떻게 정해지나요?',
    '선택지마다 표시되는 퍼센트가 실제 성공 확률입니다. 확률이 없는 선택지는 확정 결과(안전하지만 보상이 낮을 수 있음)입니다.',
  ],
  [
    '세이브가 꼬였어요 / 예전 버전 저장을 불러올 수 있나요?',
    '과거 버전의 저장 데이터(세부 능력치·병역·반기제 도입 이전 등)도 불러오는 즉시 자동으로 최신 형식으로 변환됩니다. 별도로 조치할 필요는 없습니다.',
  ],
  [
    '문제가 생겼어요.',
    '<a href="mailto:contact@offside-lab.com">contact@offside-lab.com</a>으로 사용 환경과 문제가 발생한 화면을 보내 주세요.',
  ],
];
const faqBody = `<div class="os-screen"><header><p class="os-eyebrow">HELP</p><h1>자주 묻는 질문</h1><p>게임을 시작하거나 이어 할 때 필요한 답을 모았습니다.</p></header><section class="os-panel">${FAQ_ITEMS.map(([q, a]) => `<h2>${q}</h2><p>${a}</p>`).join('')}</section><p><a href="/">게임 시작</a></p><nav><a href="/">홈</a> · <a href="/guide/">게임 가이드</a></nav></div>`;
const termsBody = `<div class="os-screen"><header><p class="os-eyebrow">LEGAL</p><h1>이용약관</h1><p>시행일: 2026년 9월 30일</p></header><section class="os-panel"><h2>1. 서비스</h2><p>오프사이드(풀타임)는 웹 브라우저와 iOS·Android 앱에서 이용하는 무료 축구 커리어 스토리 시뮬레이션 게임입니다. 플레이 중인 세이브(게임 진행) 자체는 이용자의 기기(브라우저·앱 저장소)에만 저장됩니다. 다만 커리어·시즌 요약 기록과 플레이 중 선택 기록은 익명 프로필 단위로 서버(Cloudflare D1)에도 저장되어 서비스 개선과 밸런스 분석에 쓰입니다. 은퇴한 선수의 커리어 기록은 명예의 전당에서 모든 이용자에게 공개됩니다. ${NAME_POLICY} 자세한 내용은 개인정보처리방침을 따릅니다.</p></section><section class="os-panel"><h2>2. 계정</h2><p>게임은 로그인 없이 바로 이용할 수 있습니다. 구글 계정(iOS 앱은 Apple 계정도)을 연결하면 로그인 상태만 서버에 남고, 게임 진행 데이터는 여전히 이용자의 기기에만 남습니다.</p></section><section class="os-panel"><h2>3. 이용자의 의무</h2><p>서비스를 부정한 목적으로 이용하거나 타인의 계정을 도용해서는 안 됩니다.</p><p>댓글, 라운지 채팅 메시지, 공개한 선수 이름, 구단 이름·감독 이름 등 이용자가 올리는 글에 욕설·비방·차별, 음란하거나 불쾌한 내용, 광고·스팸, 타인의 개인정보를 담아서는 안 됩니다. 오프사이드는 이런 내용과 이를 올리는 이용자를 용인하지 않으며, 발견하거나 신고를 받으면 해당 글을 지우거나 이름을 가리고, 댓글·채팅 작성 등 서비스 이용을 제한할 수 있습니다.</p><p>이용자는 댓글마다 있는 신고 버튼으로 부적절한 댓글을 신고하고, 작성자를 차단해 그 사람의 댓글을 보지 않을 수 있습니다. 라운지 채팅에서도 메시지마다 있는 메뉴(⋯)로 신고하고 작성자를 차단할 수 있으며, 여러 이용자가 신고한 메시지는 운영자 확인 전에도 자동으로 가려집니다. 명예의 전당 선수 상세와 팀 프로필의 이름 신고 버튼으로 부적절한 이름도 신고할 수 있습니다. 신고는 운영자가 24시간 안에 확인해 조치합니다.</p></section><section class="os-panel"><h2>4. 서비스 변경·중단</h2><p>운영상·기술상 필요에 따라 서비스 내용이 변경되거나 중단될 수 있으며, 이 경우 합리적인 방법으로 안내합니다. 게임 데이터가 기기에만 저장되는 특성상, 서비스 중단이 곧바로 이용자의 진행 데이터 손실로 이어지지는 않습니다(단, 브라우저 저장소 삭제·기기 변경 시에는 데이터가 사라질 수 있습니다).</p></section><section class="os-panel"><h2>5. 면책</h2><p>본 서비스는 현 상태(AS-IS)로 제공되며, 게임 결과나 확률적 연출로 인한 손해에 대해 책임지지 않습니다.</p></section><section class="os-panel"><h2>6. 문의</h2><p><a href="mailto:contact@offside-lab.com">contact@offside-lab.com</a></p></section><nav><a href="/">홈</a> · <a href="/legal/privacy/">개인정보처리방침</a></nav></div>`;
const privacyBody = `<div class="os-screen"><header><p class="os-eyebrow">LEGAL</p><h1>개인정보처리방침</h1><p>시행일: 2026년 10월 4일</p></header><section class="os-panel"><h2>1. 수집하는 정보</h2><p>게임은 로그인 없이 이용할 수 있습니다. 로그인·공개 기록·선택적 이용 분석에서 처리하는 정보는 아래와 같습니다. 구글 계정으로 로그인하는 경우에만 구글이 제공하는 고유 식별자(sub)와 이메일 주소를 수집합니다. iOS 앱에서 Apple로 로그인하는 경우에는 Apple이 제공하는 고유 식별자(sub)만 저장하며 이메일은 저장하지 않습니다. 플레이 중인 세이브(선수 능력치, 진행 중인 시즌 등) 자체는 서버로 전송되지 않고 이용자의 브라우저(앱은 기기 저장소)에만 저장됩니다. 그와 별개로, 커리어·시즌 요약 기록(포지션·소속·기록·수상 등)과 플레이 중 선택 기록은 서비스 개선과 밸런스 분석을 위해 로그인 여부와 관계없이 익명 프로필 단위로 서버(Cloudflare D1)에 저장됩니다. 은퇴한 선수의 커리어 기록(레전드 점수·시즌별 기록·수상·등번호·포지션)은 명예의 전당에서 모든 이용자에게 공개됩니다. ${NAME_POLICY} 이름은 공개하는 동안에만 서버에 저장되며, 설정을 끄면 다음 시즌 기록부터 익명으로 올라갑니다. 은퇴한 선수는 은퇴 화면과 내 선수 상세에서 언제든 익명으로 되돌릴 수 있습니다. 댓글·이름을 신고하거나 작성자를 차단하면 그 기록(신고한 댓글·사유, 신고한 이름, 차단한 작성자)이 익명 프로필 단위로 저장되며, 계정을 삭제하면 함께 삭제됩니다. 라운지 채팅에 보낸 메시지(닉네임·내용·보낸 시각)는 채팅 서버(Cloudflare Durable Objects)에 보관되어 모든 이용자에게 보이며, 채팅 메시지를 신고하면 운영자 확인을 위해 그 메시지의 사본(작성자 닉네임·내용)과 신고 사유가 함께 저장됩니다.</p></section><section class="os-panel"><h2>2. 자동 수집 정보</h2><p>서비스 운영과 보안을 위해 접속 세션 정보와 요청 로그(접속 시각, IP, 오류 로그 등)를 일정 기간 보관합니다.</p></section><section class="os-panel"><h2>3. 이용 목적</h2><p>로그인 상태 유지, 계정 연동·해제, 부정 이용 방지, 서비스 안정성 확보와 위에서 설명한 서비스 개선·밸런스 분석에 이용합니다. 선택적 Google Analytics 분석은 동의한 경우에만 수행합니다.</p></section><section class="os-panel"><h2>4. 제3자 제공 및 국외 이전</h2><p>서비스는 Cloudflare(호스팅·인프라), Google(로그인, 동의한 경우 이용 분석, 광고), Apple(iOS 앱 로그인)을 이용하며, 이 과정에서 위 정보가 해당 사업자의 해외 서버로 이전되어 처리될 수 있습니다.</p></section><section class="os-panel"><h2>5. 보유 기간</h2><p>계정 정보와 커리어·시즌 요약·선택 기록은 이용자가 계정 삭제를 요청할 때까지 보관하며, 요청 시 지체 없이 함께 삭제합니다. 라운지 채팅 메시지는 보낸 지 7일, 채팅 신고 기록은 90일이 지나면 자동으로 삭제하고, 채팅 정지 기록은 정지 기간이 끝나면 삭제합니다(계정을 삭제하면 채팅 신고·정지 기록은 바로 삭제되고, 이미 보낸 메시지는 7일 보관 기간이 끝날 때 삭제됩니다). 플레이 중인 세이브는 이용자의 브라우저(앱은 기기)에만 있으므로, 브라우저 저장소를 지우거나 앱을 삭제하면 즉시 삭제됩니다.</p></section><section class="os-panel"><h2>6. 이용자의 권리</h2><p>웹과 앱의 설정·계정 화면에서 언제든 구글 계정 연동 해제, 로그아웃, 계정 삭제를 요청할 수 있습니다. 계정 삭제는 확인 절차를 거쳐 처리됩니다.</p></section><section class="os-panel" id="analytics"><h2>7. 선택적 이용 분석 (Google Analytics)</h2><p>게임 개선과 유입 경로·플레이 지속률 분석을 위해, 이용자가 분석에 동의한 경우에만 Google Analytics 4 태그를 불러옵니다. 동의 전과 거절한 경우에는 이 태그와 분석 요청을 보내지 않습니다. 거절해도 게임 이용에는 불이익이 없습니다. iOS·Android 앱에서는 Google Analytics를 사용하지 않습니다.</p><p>Google LLC는 쿠키 기반 브라우저 식별자, 방문 시각·기기·브라우저 정보, 허용된 유입 경로와 캠페인, 정규화한 화면 이동, 커리어 시작·첫 시즌 완료·은퇴·공유 버튼 시도 및 링크 복사 성공 정보를 해외 서버에서 처리합니다. 선수 이름·닉네임·이메일·계정 및 커리어 ID·인증 정보·입력한 자유 텍스트는 분석 이벤트에 포함하지 않으며, 원본 주소의 식별자·검색어·해시를 제거합니다. 광고 연동·Google Signals·User-ID는 사용하지 않습니다.</p><p>GA4의 사용자·이벤트 데이터 보관 기간은 2개월로 설정합니다. 집계 보고서는 이 기간과 다르게 보관될 수 있습니다. 이 브라우저의 분석 쿠키는 최대 60일, 이벤트 중복 방지 기록은 최근 30일·최대 200개 커리어와 현재 커리어만 보관합니다. 분석 기록은 게임 세이브와 분리합니다.</p><p>환경설정의 이용 분석 선택에서 언제든 동의를 철회할 수 있습니다. 철회하면 이후 수집을 중단하고 이 브라우저의 분석용 쿠키와 중복 방지 기록을 삭제합니다. 이미 전송된 정보가 자동 삭제되는 것은 아니며, 관련 문의는 아래 연락처로 할 수 있습니다. Google의 처리 방식은 <a href="https://policies.google.com/privacy">Google 개인정보처리방침</a>에서 확인할 수 있습니다.</p></section><section class="os-panel" id="ads"><h2>8. 광고 (Google AdSense · AdMob)</h2><p>기록실·소식·선수 상세처럼 읽는 화면의 맨 아래에 광고를 보여 줄 수 있습니다. 웹은 Google AdSense, iOS·Android 앱은 Google AdMob을 씁니다. 게임을 조작하는 화면에는 광고를 두지 않으며, 광고를 보지 않아도 게임 이용에 불이익이 없습니다.</p><p>광고를 보여 주기 위해 Google LLC가 웹에서는 쿠키 등으로 브라우저 정보와 방문한 페이지 주소를, 앱에서는 기기 광고 식별자와 앱 정보를, 그리고 기기 정보와 IP 주소를 해외 서버에서 처리합니다. 서비스는 관심사에 따른 맞춤 광고를 요청하지 않고 비개인화 광고만 요청합니다. 비개인화 광고도 빈도 제한·부정 클릭 방지·집계 보고를 위해 쿠키나 광고 식별자를 사용할 수 있습니다. iOS 앱은 앱 추적 동의를 요청하지 않습니다. 유럽경제지역·영국·스위스의 앱 이용자에게는 광고를 요청하기 전에 Google 동의 메시지를 보여 주며, 동의하지 않아도 게임은 그대로 이용할 수 있습니다. 선수 이름·닉네임·이메일·계정 및 커리어 정보는 광고에 전달하지 않습니다.</p><p>Google의 광고 쿠키 사용과 맞춤 광고 설정은 <a href="https://policies.google.com/technologies/ads">Google 광고 정책</a>과 <a href="https://adssettings.google.com">Google 광고 설정</a>에서 확인하고 바꿀 수 있습니다. 브라우저 설정에서 쿠키를 차단하거나 기기 설정에서 광고 식별자를 재설정·삭제해도 게임은 그대로 이용할 수 있습니다.</p></section><section class="os-panel" id="push"><h2>9. 선택적 앱 새 소식 알림</h2><p>iOS·Android 앱에서 알림 받기를 선택하고 기기 권한을 허용한 경우에만 수신 기기를 등록합니다. 알림 연결에는 기기별 설치 식별자의 해시, 푸시 토큰, 연결된 프로필·세션, 운영체제 종류, 앱 버전, 마지막 등록 시각을 사용합니다. 게임 진행·선수 이름·이메일을 푸시 내용에 넣지 않습니다. 설치 식별자 원본은 기기 보안 저장소에만 보관합니다.</p><p>푸시 토큰과 알림 내용은 Expo Push Service를 거쳐 Apple APNs 또는 Google FCM으로 전송되어 해당 사업자의 해외 서버에서 처리될 수 있습니다. 현재 정식 자동 발송은 시작하지 않았으며, 관리자의 본인 기기 연결 테스트만 지원합니다. <a href="https://expo.dev/privacy">Expo 개인정보처리방침</a>을 확인할 수 있습니다.</p><p>앱 설정에서 알림을 끄면 서버의 기기 등록을 해제합니다. 연결이 끊겨 해제가 실패하면 기기에서 해제 대기를 보관하고 다음 연결 때 다시 처리합니다. 서버의 등록 정보는 마지막 등록에서 90일이 지나면 정기 정리 때 삭제합니다. 폐기·만료된 세션이나 삭제된 프로필에는 테스트 알림을 보내지 않습니다. 알림을 받지 않아도 게임을 이용할 수 있습니다.</p></section><section class="os-panel"><h2>10. 문의</h2><p>개인정보 관련 문의는 <a href="mailto:contact@offside-lab.com">contact@offside-lab.com</a>으로 연락해 주세요.</p></section><nav><a href="/">홈</a> · <a href="/legal/terms/">이용약관</a></nav></div>`;

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
// T-10-118 maskable 아이콘: 배경은 모서리 없이 꽉 채우고(OS 가 마스크로 깎는다) 깃발·깃대만 80% 로 줄여 안전 영역 안에 둔다.
// 원본 SVG 구조(둥근 배경 rect · 깃대 rect 부터가 로고)에 기대므로 바뀌면 조용히 틀어지지 않게 던진다.
export function maskableSvg(svg) {
  const text = svg.toString();
  const BG = ' rx="112"';
  const LOGO = '<rect x="146" y="96"';
  if (!text.includes(BG) || !text.includes(LOGO) || !text.includes('</svg>')) {
    throw new Error('brand SVG 구조가 바뀌어 maskable 아이콘을 만들 수 없습니다.');
  }
  return text
    .replace(BG, '')
    .replace(LOGO, `<g transform="translate(51.2 51.2) scale(0.8)">${LOGO}`)
    .replace('</svg>', '</g></svg>');
}
async function createBrandAssets(outputDirectory) {
  const sizes = [64, 180, 192, 512];
  const resized = new Map();
  const brandSvg = await readFile(BRAND_SOURCE);
  for (const size of sizes) {
    const buffer = await sharp(brandSvg).resize(size, size).png().toBuffer();
    resized.set(size, buffer);
    await writeFile(
      join(outputDirectory, 'brand', `offside-flag-${BRAND_VERSION}-${size}.png`),
      buffer,
    );
  }
  await sharp(Buffer.from(maskableSvg(brandSvg)))
    .resize(512, 512)
    .png()
    .toFile(join(outputDirectory, 'brand', `offside-flag-${BRAND_VERSION}-maskable-512.png`));
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
  const ogPath = join(outputDirectory, `og-offside-flag-${BRAND_VERSION}.png`);
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
          src: `/brand/offside-flag-${BRAND_VERSION}-192.png`,
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: `/brand/offside-flag-${BRAND_VERSION}-512.png`,
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: `/brand/offside-flag-${BRAND_VERSION}-maskable-512.png`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    }),
  );
}
const STATIC_PAGES = {
  '/guide/': guideBody,
  '/faq/': faqBody,
  '/legal/terms/': termsBody,
  '/legal/privacy/': privacyBody,
};

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
