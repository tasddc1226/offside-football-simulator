import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { APP_SHELL_MARK } from './app-shell.mjs';

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

export const PUBLIC_PAGES = {
  '/': {
    title: '오프사이드 | 이번 생은 축구다 — 축구선수 커리어 시뮬레이션',
    description:
      '이번 생은 축구다. 오프사이드(풀타임)에서 고교 3학년부터 은퇴까지, 훈련·이적·이벤트 선택으로 한 선수의 커리어를 만듭니다. 설치 없이 바로 하는 무료 웹 시뮬레이션 게임입니다.',
  },
  '/guide/': {
    title: '게임 가이드 | 오프사이드',
    description:
      '오프사이드(풀타임)의 선수 생성부터 시즌 진행, 성장, 이적, 병역, 은퇴와 명예의 전당, 구단주 팀과 이적시장까지 알아봅니다.',
  },
  '/faq/': {
    title: '자주 묻는 질문 | 오프사이드',
    description:
      '오프사이드(풀타임)의 저장 방식, 계정 연동, 진행 방법, 지원 문의 등 게임 이용 전에 궁금한 점을 확인하세요.',
  },
  '/fairness/': {
    title: '확률과 공정성 | 오프사이드',
    description:
      '오프사이드(풀타임)의 확률 판정 방식, 광고·결제와 확률의 관계, 밸런스 조정 원칙, 숨겨 둔 정보와 그 이유를 공개합니다.',
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
        image: `${origin}/og-offside-${BRAND_VERSION}.png`,
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
  const imagePath = `/og-offside-${BRAND_VERSION}.png`;
  const image = config.origin ? `${config.origin}${imagePath}` : imagePath;
  return `<!-- offside-seo:start --><script>document.documentElement.dataset.publicRobots=${JSON.stringify(robots)}</script><meta name="description" content="${escapeHtml(page.description)}" />
    <meta name="robots" content="${robots}" />
    <meta property="og:type" content="website" /><meta property="og:locale" content="ko_KR" /><meta property="og:site_name" content="OFFSIDE" />
    <meta property="og:title" content="${escapeHtml(page.title)}" /><meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:image" content="${escapeHtml(image)}" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />
    ${canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}" /><link rel="canonical" href="${escapeHtml(canonical)}" />` : ''}
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
  return `# 오프사이드 (OFFSIDE · 풀타임)\n\n> ${PUBLIC_PAGES['/'].description}\n\n웹 브라우저에서 무료로 플레이하는 한국어 축구 선수 커리어 스토리 시뮬레이션 게임이다. 설치나 로그인 없이 바로 시작할 수 있다.\n\n## 문서\n\n${['/guide/', '/faq/', '/fairness/'].map(link).join('\n')}\n\n## 정책\n\n${['/legal/terms/', '/legal/privacy/'].map(link).join('\n')}\n`;
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
// 가이드 절(제목, 문단들). 번호는 순서대로 붙는다. 게임 규칙·수치를 바꾸는 PR은 여기도 함께 고친다.
const GUIDE_SECTIONS = [
  [
    '선수 생성',
    [
      '이름, 등번호, 국적, 포지션(FW·MF·DF·GK)과 세부 포지션, 주발, 주력 능력치, 성장 특성(조기 성장·대기만성 등)을 정합니다. 그러면 능력치 총합이 같은 후보 3명이 나오고, 그중 한 명으로 고교 3학년 시즌을 시작합니다.',
      '실제 잠재력은 은퇴할 때 공개됩니다. 앱에서는 후보 선택 때 보상형 광고를 보면 후보 3명의 초기 잠재력 등급 범위를 확인할 수 있습니다. 로그인한 구단주는 웹과 앱에서 광고 대신 구단 자금으로도 확인할 수 있습니다. 현재 능력치와 성장 기록을 보며 선수를 키웁니다.',
    ],
  ],
  [
    '고교 · 대학 · 프로 입단',
    [
      '고교 3학년 시즌이 끝나면 프로 구단의 입단 제의를 받거나 대학에 진학합니다. 대학에서는 4학년 전까지 언제든 프로에 도전할 수 있고, 졸업반까지 제의가 없으면 K3 리그 입단 테스트를 봅니다.',
    ],
  ],
  [
    '시즌 진행 · 훈련 · 자기 투자',
    [
      '한 시즌은 프리시즌, 전반기, 후반기로 진행됩니다. 구간마다 훈련 방향(능력치 훈련, 휴식·회복, 개인 코치, 미디어 활동)을 고르면 경기 결과가 한 번에 계산되고 출전·골·도움·평점·리그 순위가 기록됩니다.',
      '훈련과 별도로 구간마다 자금을 써서 자기 투자(약점 보강 특훈, 강점 특화 특훈, 메디컬 케어, 멘탈 코칭)를 할 수 있습니다. 비용은 연봉에 비례하고, 특훈으로도 잠재력을 넘어서 성장하지는 않습니다.',
    ],
  ],
  [
    '확률 이벤트와 스토리',
    [
      '구간을 진행할 때마다 무작위 이벤트가 등장할 수 있습니다. 선택지마다 성공 확률이 표시되며, 일부 이벤트는 여러 시즌에 걸쳐 이어집니다.',
      '페널티킥·1대1·승부차기처럼 경기 장면이 있는 선택지는 타이밍 게이지로 판정합니다. 능력치가 좋을수록 성공 구간이 넓어지고, 성공 여부는 바늘을 멈추는 순간에 정해집니다. 확률 도감에서는 이벤트마다 성공 확률의 범위와 확률을 올리고 내리는 요인을 볼 수 있습니다. 스토리·특별 이벤트는 한 번 만나야 도감에 열립니다.',
    ],
  ],
  [
    '능력치 성장과 잠재력',
    [
      '스피드·슈팅·패스·드리블·수비·피지컬 같은 카드 능력치와 포지션별 OVR에 반영되는 세부 능력치가 함께 성장합니다. 선수 생성과 후보 선택에서 포지션별 OVR 주요 능력치를 확인할 수 있습니다. 헤딩 정확도는 수비 항목에 포함되며, 스트라이커의 OVR에는 수비 항목 중 헤딩 정확도만 반영됩니다. OVR 반영 비중과 훈련 성장률은 다릅니다. 성장 폭은 나이와 잠재력까지 남은 여유, 사기에 따라 달라집니다. 코치 메모에서 시즌 시작과 비교해 OVR과 능력치가 얼마나 달라졌는지 확인할 수 있습니다.',
      '시즌 결산에서는 스카우트가 내 선수의 수준을 한마디로 알려 줍니다. 첫 시즌을 마친 뒤부터 29세까지는 선수 탭의 잠재력 강화에서 자금으로 잠재력을 올릴 수 있습니다. 시즌마다 한 번, 최대 4단계까지 시도할 수 있고, 단계가 높을수록 비용은 커지고 성공 확률은 낮아집니다. 실패하면 자금만 잃고, 실패할 때마다 다음 성공 확률이 5%p씩 오릅니다. 앱에서는 자금이 모자란 시즌에 보상형 광고를 끝까지 보면 자금 없이 한 번 시도할 수 있습니다. 로그인한 구단주는 광고 대신 구단 자금으로도 같은 한 번을 시도할 수 있습니다(웹 포함). 자금이 모자란 시즌에는 그 한 번을 쓴 뒤에도 광고나 구단 자금으로 더 시도할 수 있고(한 선수에 모두 합쳐 2번까지), 광고로 받는 강화에는 하루 횟수 제한이 없습니다. 앱에서 사는 잠재력 강화권 한 장으로도 광고 대신 같은 시도를 할 수 있습니다(쓸 수 있는 때와 횟수는 같습니다). 성공 확률은 자금으로 시도할 때와 같습니다.',
    ],
  ],
  [
    '컵 대회 · 대륙 대회 · 개인상',
    [
      '소속 리그에 따라 국내 컵, 슈퍼컵, 대륙 클럽 대회(챔피언스리그 등)에 함께 출전합니다. 시즌이 끝나면 득점왕·MVP·발롱도르 같은 개인상을 노릴 수 있습니다. K리그2에서 1위로 시즌을 마치면 다음 시즌에 구단과 함께 K리그1로 승격합니다.',
    ],
  ],
  [
    '이적 시장 · 계약',
    [
      '시즌이 끝나면 잔류, 재계약, 이적 제의 중에서 다음 행선지를 정합니다. 성적과 평판에 따라 해외 리그에서도 제의가 오고, 제의마다 평가 요소와 출전 조건이 표시됩니다. 계약 기간이 출전을 보장하지는 않습니다.',
      '계약이 1년 남으면 구단이 조기 연장을 제안할 수 있습니다. 연장하지 않고 기존 조건으로 잔류하거나 다른 구단으로 이적해도 됩니다. 41세부터는 1년 계약만 받고, 재계약은 지난 시즌 활약에 따라 정해집니다.',
    ],
  ],
  [
    '국가대표 · 병역',
    [
      '대표팀에 발탁되면 A매치·아시안컵·월드컵·올림픽·아시안게임 등 국제 대회에 출전합니다. 대한민국 선수는 병역 의무가 있는 나이가 되면 김천 상무 입대나 현역 입대를 선택합니다.',
      '대회 명단에 들어 아시안게임 금메달이나 올림픽 메달을 받으면 병역 특례로 체육요원에 편입됩니다. 상무나 현역 입대 없이 선수로 뛰면서 시즌마다 복무 기간을 채우고, 34개월이 차면 복무가 끝납니다.',
    ],
  ],
  [
    '은퇴 · 명예의 전당 · 영구결번',
    [
      '은퇴는 25세부터 선택할 수 있고, 은퇴 나이가 되면 은퇴합니다. 25세 전에 제의가 없으면 하부 리그 입단 테스트로 계속 뛸 수 있습니다. 시즌 1에 만든 선수는 45세, 프리시즌에 만든 선수는 41세에 은퇴합니다. 한 시즌에 누군가 은퇴 나이까지 뛰고 은퇴하면 다음 시즌 선수의 은퇴 나이가 한 살 늘어납니다.',
      '은퇴하면 통산 기록과 트로피, 수상 경력으로 레전드 점수와 등급이 매겨지고, 잠재력 평가와 최고 OVR이 공개됩니다. 만 30세 이상에 은퇴한 선수는 명예의 전당에 오르고, 공유 링크와 이미지로 커리어를 자랑할 수 있습니다. 그보다 일찍 은퇴한 짧은 커리어는 내 선수 목록에만 남습니다.',
      '한 구단에서 레전드급 활약을 남기고 은퇴하면 그 구단의 등번호를 영구결번으로 받을 수 있습니다. 구단·번호마다 시즌별로 한 명만 받을 수 있어 먼저 자격을 채운 선수가 가져가고, 기준은 포지션마다 따로 정해집니다.',
      '영구결번 자격을 채웠지만 후보 구단의 번호가 모두 먼저 결번되면 명예의 벽 칭호를 받습니다. 영구결번과는 별개이며 대표 칭호는 직접 고릅니다. 기존 선수는 은퇴 당시 조건을 서버 기록으로 확인할 수 있는 경우에만 칭호가 기록됩니다.',
    ],
  ],
  [
    '구단주 팀',
    [
      '직접 키운 선수의 업적은 은퇴 후 해당 서비스 시즌에서 판정합니다. 장기근속은 한 일반 프로 구단의 누적 재적 10시즌 이상으로, 이적 후 복귀한 기간도 합산하고 상무·현역 복무는 제외합니다. 원클럽맨은 총 프로 10시즌 이상과 일반 구단 한 곳이 조건이며, 상무·현역 복무는 구단 수에서 제외합니다. 고교·대학 시즌은 두 업적에 포함하지 않습니다.',
      '로그인하면 구단주가 되어 서비스 시즌마다 팀 하나를 만듭니다. 그 시즌에 은퇴한 내 선수와 이적시장에서 영입한 선수로 4-3-3·4-4-2·3-5-2 포메이션의 11명을 편성하고, 빈자리는 유스 선수가 채웁니다. 은퇴 선수가 한 명만 있어도 경기할 수 있습니다.',
      '선수를 맞는 자리에 둘수록 적합도가 높아지고, 선수 유형 조합·주발·직접 키운 선수로 팀 시너지가 켜지면 경기에서 힘이 오릅니다. 다른 구단주의 팀과 하루 10경기까지 치를 수 있고(같은 상대는 하루 한 번), 결과에 따라 팀 레이팅이 오르내립니다. 선수·팀·구단주·감독 업적을 모아 구단주 랭킹에 도전하고, 팀 로고를 꾸며 팀 소개 이미지를 공유할 수 있습니다.',
    ],
  ],
  [
    '오프사이드 컵',
    [
      '서비스 시즌마다 구단주 팀끼리 겨루는 컵 대회가 열립니다. 접수 기간에 대회 화면에서 신청하며, 선발 11자리 중 8자리 이상을 채우고 선발 선수를 이적시장에 내놓지 않은 팀만 참가할 수 있습니다. 정원은 64팀, 선착순입니다.',
      '접수가 끝나면 팀 OVR로 포트를 나눠 조를 추첨하고, 조별 풀리그 상위 2팀이 단판 토너먼트로 결승까지 갑니다. 비기면 승부차기로 가립니다. 경기는 매일 21시에 자동으로 치러지고, 경기 1시간 전부터 끝날 때까지 참가 팀의 선발 명단을 바꿀 수 없습니다. 컵 경기는 도전 경기 횟수·레이팅·전적에 들어가지 않습니다.',
      '성적에 따라 선수 후보 리롤권을 받습니다(우승 10장 · 준우승 7장 · 4강 5장 · 8강 3장 · 16강 2장 · 32강과 조별 예선 1장). 리롤권은 로그인한 상태로 새 선수를 만들 때 후보 선택 화면에서 1장씩 써서 후보 3명을 다시 뽑는 데 씁니다. 다시 뽑으면 지금 후보와 광고로 확인한 잠재력 범위는 사라집니다. 4강 이상은 구단 프로필에 트로피로 남습니다.',
    ],
  ],
  [
    '이적시장 · 구단 자금',
    [
      '구단주 화면의 이적시장에서 이번 시즌 은퇴 선수 카드를 사고팝니다. 카드마다 최고 OVR 시즌의 몸값으로 정한 기준가가 있고, 같은 포지션·등급 선수의 최근 시세를 차트로 볼 수 있습니다.',
      '직접 키운 선수를 방출하면 카드 기준가만큼 구단 자금이 생깁니다. 구단 가치는 구단 자금에 가진 선수 카드의 기준가를 더한 값입니다.',
      '구단 자금으로 선수 후보 리롤권을 살 수 있습니다. 구단주 화면의 리롤권 상점에서 사고, 같은 날 한 장 더 살 때마다 값이 오르며 하루에 살 수 있는 장수가 정해져 있습니다(기본 100억 원부터 두 배씩, 하루 3장). 매일 0시(한국 시간)에 값과 장수가 처음으로 돌아갑니다. 산 리롤권은 오프사이드 컵에서 받은 리롤권과 같이 씁니다. 앱에서는 리롤권과 별도로 하루 2번까지 보상형 광고를 보고 후보를 다시 뽑을 수 있습니다.',
      '구단 자금이 들어오고 나간 기록(방출 · 판매 · 영입 · 리롤권 구매 · 광고 대신 쓴 구단 자금)은 구단주 화면에서 구단 자금을 누르면 나오는 구단 자금 내역에서 볼 수 있습니다.',
    ],
  ],
  [
    '친구 · 친선전',
    [
      '구단주끼리 팀 프로필의 친구 신청, 친구 코드, 초대 링크로 친구를 맺을 수 있습니다. 친구 팀과는 하루 10경기까지 친선전을 치르며, 친선전은 레이팅·전적·업적에 들어가지 않고 친구와의 상대 전적만 남습니다.',
      '친구 초대 이벤트: 아직 은퇴시킨 선수가 없는 구단주가 친구의 초대 링크나 친구 코드로 친구 신청을 하면 초대로 기록됩니다. 그 구단주가 선수 커리어를 끝까지 마치면 두 사람 모두 선수 후보 리롤권 2장을 받습니다. 한 사람은 한 번만 초대받을 수 있고, 초대한 사람의 보상은 10번까지입니다. 초대 현황은 친구 화면에서 볼 수 있습니다.',
    ],
  ],
  [
    '서비스 시즌',
    [
      '기록실의 순위와 기록은 서비스 시즌마다 따로 집계됩니다. 2026년 10월 6일 시즌 1이 개막했고, 그 전에 만든 선수는 프리시즌 기록으로 남습니다. 선수가 어느 시즌에 속할지는 첫 시즌 기록이 서버에 올라간 시각으로 정해집니다.',
    ],
  ],
];
const guideBody = `<div class="os-screen"><header><p class="os-eyebrow">HOW TO PLAY</p><h1>게임 가이드</h1><p>고교 3학년부터 은퇴까지 한 선수의 커리어를 진행하고, 은퇴한 선수로 구단주 팀을 꾸리는 방법입니다.</p></header>${GUIDE_SECTIONS.map(([h, ps], i) => `<section class="os-panel"><h2>${i + 1}. ${h}</h2>${ps.map((t) => `<p>${t}</p>`).join('')}</section>`).join('')}<section class="os-panel"><h2>진행 상황 저장</h2><p>진행 상황(세이브)은 이 브라우저(기기)에만 저장됩니다. 다른 기기나 앱으로 옮기려면 환경설정에서 백업 코드나 파일을 내보낸 뒤 새 기기에서 불러와야 합니다. 백업 코드는 다른 사람에게 보내지 마세요. 다만 커리어·시즌 요약 기록과 플레이 중 선택 기록은 서비스 개선·밸런스 분석을 위해 익명 프로필 단위로 서버에도 함께 저장됩니다. 은퇴한 선수의 커리어 기록은 명예의 전당에서 모든 이용자에게 공개됩니다. ${NAME_POLICY} 자세한 내용은 <a href="/legal/privacy/">개인정보처리방침</a>을 확인해 주세요.</p></section><p><a href="/">첫 커리어 시작</a></p><nav><a href="/">홈</a> · <a href="/faq/">자주 묻는 질문</a> · <a href="/fairness/">확률과 공정성</a></nav></div>`;
const FAQ_ITEMS = [
  [
    '다른 팀으로 이적했다가 복귀해도 장기근속인가요?',
    '한 일반 구단에서 누적 10시즌 이상 재적한 직접 육성 선수가 은퇴하면 장기근속 업적을 달성합니다. 복귀 전후를 합산하지만 여러 선수의 시즌은 합치지 않습니다. 다른 일반 구단 경력이 있으면 원클럽맨은 아닙니다. 상무·현역 복무 기간은 원래 구단의 장기근속 시즌으로 더하지 않습니다.',
  ],
  [
    '명예의 벽 칭호와 영구결번은 어떻게 다른가요?',
    '명예의 벽은 영구결번 자격을 채웠지만 후보 구단의 번호가 모두 먼저 결번된 선수에게 주는 칭호입니다. 번호를 영구결번으로 받거나 점수·구단 가치가 오르는 보상은 없습니다. 대표 칭호는 받은 칭호 목록에서 직접 바꿉니다. 기존 선수는 은퇴 당시 조건을 서버 기록으로 확인할 수 있는 경우에만 적용됩니다.',
  ],
  [
    '오프사이드 컵 리롤권은 어디에 쓰나요?',
    "로그인한 상태로 새 선수를 만들 때 후보 선택 화면의 '후보 다시 뽑기'에서 1장씩 씁니다. 후보 3명을 새로 뽑으며, 지금 후보와 광고로 확인한 잠재력 범위는 사라집니다. 컵 성적에 따라 받고, 쓸 때는 서버에서 차감되어 기기를 바꿔도 남은 장수가 같습니다.",
  ],
  [
    '광고 대신 구단 자금을 쓸 수 있나요?',
    '네. 로그인한 구단주는 후보 잠재력 보기, 시즌 평가 보기, 잠재력 강화(자금이 모자란 시즌의 한 번과 그 뒤 추가 시도)에 구단 자금을 쓸 수 있습니다. 앱에서는 광고와 구단 자금 중 고르고, 웹에는 광고가 없어 구단 자금으로 받습니다. 같은 날 같은 보상을 다시 받을수록 값이 오르고 하루에 받을 수 있는 횟수가 정해져 있으며, 매일 0시(한국 시간)에 처음으로 돌아갑니다. 확률과 결과는 광고로 받을 때와 같고, 쓴 구단 자금은 되돌릴 수 없으며 구단 자금 내역에 남습니다.',
  ],
  [
    '리롤권을 구단 자금으로 살 수 있나요?',
    '네. 구단주 화면의 리롤권 상점에서 삽니다. 같은 날 더 살수록 값이 오르고 하루에 살 수 있는 장수가 정해져 있으며, 매일 0시(한국 시간)에 처음으로 돌아갑니다. 산 리롤권과 쓴 구단 자금은 되돌릴 수 없습니다. 리롤권이 없을 때 후보 선택 화면의 상점 안내를 누르면 바로 상점으로 갑니다.',
  ],
  [
    '친구를 초대하면 무엇을 받나요?',
    '아직 은퇴시킨 선수가 없는 친구가 내 초대 링크나 친구 코드로 친구 신청을 하고 선수 커리어를 끝까지 마치면, 두 사람 모두 선수 후보 리롤권 2장을 받습니다. 보상은 로그인한 구단주에게 주고, 초대한 사람은 10번까지 받습니다. 받은 리롤권은 다른 리롤권과 같이 씁니다.',
  ],
  [
    '광고를 보고 후보를 다시 뽑을 수 있나요?',
    '앱에서는 됩니다. 후보 선택 화면에서 보상형 광고를 끝까지 보면 리롤권 없이 후보 3명을 바로 다시 뽑습니다. 하루 2번까지이고 매일 0시(한국 시간)에 다시 채워지며, 횟수는 그 기기에서 셉니다. 로그인하지 않아도 쓸 수 있고, 광고 제거를 구매했다면 광고 없이 다시 뽑습니다. 구단 자금으로 사는 리롤권(하루 3장)과 합치면 하루 최대 5번 다시 뽑을 수 있습니다. 웹에는 광고가 없어 리롤권으로만 다시 뽑습니다.',
  ],
  [
    '어떤 게임인가요?',
    '고교 3학년부터 은퇴까지, 매 시즌 훈련과 이벤트 선택으로 한 선수의 커리어를 만드는 스토리 시뮬레이션입니다.',
  ],
  [
    '진행 내용은 어디에 저장되나요?',
    '플레이 중인 세이브(선수 능력치, 진행 중인 시즌 등)는 이 브라우저의 로컬 저장소에만 남습니다. 저장소를 지우면 세이브가 사라집니다. 기기를 바꾸기 전 환경설정에서 백업 코드나 파일을 내보내면 새 기기에서 불러와 이어 갈 수 있습니다. 백업 코드는 다른 사람에게 보내지 마세요. 다만 커리어·시즌 요약 기록과 선택 기록은 익명 프로필 단위로 서버(Cloudflare D1)에도 저장되어 서비스 개선과 밸런스 분석에 쓰입니다. 은퇴한 선수의 기록은 명예의 전당에 공개됩니다. ' +
      NAME_POLICY +
      ' 계정을 삭제하면 이 기록도 함께 삭제됩니다.',
  ],
  [
    '구글 로그인은 왜 있나요?',
    '구글로 로그인하면 다른 기기에서도 같은 구단주 계정과 공개 기록을 이용합니다. 진행 중인 게임은 자동으로 옮겨지지 않습니다. 계정을 연결·해제하거나 로그아웃해도 이 기기의 게임 저장 데이터는 그대로 남습니다.',
  ],
  [
    '이벤트 성공 확률은 어떻게 정해지나요?',
    '퍼센트가 표시된 선택지는 그 퍼센트가 실제 성공 확률이며, 숨은 보정 없이 모든 이용자에게 같은 규칙으로 판정합니다. 페널티킥·1대1·승부차기처럼 타이밍 게이지가 나오는 선택지는 퍼센트 대신 바늘을 멈춘 위치로 판정합니다(감속 모션을 켜 두면 표시된 확률로 판정합니다). 확률이 없는 선택지는 결과가 정해져 있으며, 보상이 낮을 수 있습니다.',
  ],
  [
    '광고를 보거나 결제하면 확률이 달라지나요?',
    '달라지지 않습니다. 앱의 보상형 광고(또는 광고 대신 쓰는 구단 자금)는 후보의 잠재력 범위나 스카우트 평가 같은 정보를 보여 주거나, 잠재력 강화를 자금 없이 시도하게 해 줍니다(자금이 모자란 시즌에 한 번, 그 뒤 한 선수에 2번까지 더). 앱에서 파는 잠재력 강화권은 광고·구단 자금 대신 같은 시도를 하게 해 줄 뿐 횟수 상한을 늘리지 않고, 리롤권은 새 선수 후보를 다시 뽑을 뿐 후보의 잠재력 확률을 바꾸지 않습니다. 시도 횟수는 늘 수 있지만 성공 확률은 자금으로 시도할 때와 같습니다. 광고 제거 구매, 계정 연결, 언어 설정도 게임 결과에 영향을 주지 않습니다. 게임 판정은 이용자의 기기에서 이루어지고, 서버가 커리어 결과를 정하지 않습니다.',
  ],
  [
    '운영자가 확률을 바꾸기도 하나요?',
    '성장·부상·이벤트 확률 같은 밸런스 수치는 운영 중 조정될 수 있습니다. 조정은 특정 이용자가 아니라 모든 이용자에게 같은 값으로 적용되고 버전으로 기록됩니다. 진행 중인 커리어에는 다음 시즌이 시작될 때부터 적용되고, 새로 만드는 커리어에는 바로 적용됩니다.',
  ],
  [
    '예전 버전의 저장 데이터도 불러오나요?',
    '과거 버전의 저장 데이터는 불러올 때 자동으로 최신 형식으로 변환됩니다.',
  ],
  [
    '문제가 생겼어요.',
    '<a href="mailto:contact@offside-lab.com">contact@offside-lab.com</a>으로 사용 환경과 문제가 발생한 화면을 보내 주세요.',
  ],
];
const faqBody = `<div class="os-screen"><header><p class="os-eyebrow">HELP</p><h1>자주 묻는 질문</h1><p>게임을 시작하거나 이어 할 때 필요한 답을 모았습니다.</p></header><section class="os-panel">${FAQ_ITEMS.map(([q, a]) => `<h2>${q}</h2><p>${a}</p>`).join('')}</section><p><a href="/">게임 시작</a></p><nav><a href="/">홈</a> · <a href="/guide/">게임 가이드</a> · <a href="/fairness/">확률과 공정성</a></nav></div>`;
// T-11-141 확률과 공정성. 숫자 표는 지금 적용 중인 밸런스로 계산해야 해서 게임 안 확률 도감에 두고, 여기에는 약속과 방법만 적는다.
const fairnessBody = `<div class="os-screen"><header><p class="os-eyebrow">FAIRNESS</p><h1>확률과 공정성</h1><p>오프사이드는 모든 이용자에게 같은 규칙과 같은 확률을 적용합니다. 어떤 판정이 어떻게 이루어지는지, 무엇을 숨기고 왜 숨기는지 공개합니다.</p></header><section class="os-panel"><h2>약속</h2><p><b>같은 규칙</b> 광고 시청, 광고 제거 구매, 계정 연결, 언어 설정은 확률에 영향을 주지 않습니다. 보상형 광고(또는 광고 대신 쓰는 구단 자금)는 후보의 잠재력 범위나 스카우트 평가 같은 정보를 보여 주거나, 잠재력 강화를 자금 없이 시도하게 해 줍니다(자금이 모자란 시즌에 한 번, 그 뒤 한 선수에 2번까지 더). 시도 횟수는 늘 수 있지만 성공 확률은 자금으로 시도할 때와 같습니다.</p><p><b>유료 아이템</b> 앱에서 파는 잠재력 강화권은 광고·구단 자금 대신 같은 시도 한 번을 하게 해 줄 뿐, 시도할 수 있는 때와 횟수 상한, 성공 확률(단계별 50%·35%·25%·15%, 실패할 때마다 다음 확률 +5%p)은 같습니다. 리롤권은 새 선수 후보 3명을 다시 뽑게 해 줄 뿐, 후보의 잠재력 확률은 그대로입니다.</p><p><b>기기에서 판정</b> 커리어의 판정은 모두 이용자의 기기에서 이루어집니다. 서버는 커리어 결과를 정하지 않고 시즌·은퇴 기록만 받습니다. 구단주 팀 경기는 모든 팀이 같은 규칙으로 서버에서 치릅니다.</p><p><b>보이는 확률이 실제 확률</b> 선택지에 표시된 퍼센트가 실제 성공 확률이며 숨은 보정은 없습니다. 페널티킥·1대1·승부차기처럼 타이밍 게이지가 나오는 선택지는 퍼센트 대신 바늘을 멈춘 위치로 판정합니다(감속 모션을 켜 두면 표시된 확률로 판정합니다).</p><p><b>조정은 버전으로</b> 성장·부상·이벤트 확률 같은 밸런스 수치는 운영 중 조정될 수 있습니다. 조정은 특정 이용자가 아니라 모든 이용자에게 같은 값으로, 버전을 붙여 적용됩니다. 진행 중인 커리어에는 다음 시즌이 시작될 때부터, 새로 만드는 커리어에는 바로 적용됩니다.</p></section><section class="os-panel"><h2>확률표는 게임 안에서</h2><p>잠재력 등급별 확률, 잠재력 강화 단계별 확률, 이벤트 선택지 확률과 밸런스 변경 이력은 게임의 <b>확률 도감 → 확률과 공정성</b>에서 볼 수 있습니다. 표는 지금 적용 중인 밸런스 값으로 게임 코드가 직접 계산합니다. 환경설정의 도움말에서도 바로 열 수 있습니다.</p></section><section class="os-panel"><h2>숨겨 둔 것과 이유</h2><p><b>실제 잠재력</b> 은퇴할 때 공개합니다. 플레이 중 보이는 스카우트 평가는 실제 값과 조금 다를 수 있습니다.</p><p><b>늦게 피는 선수</b> 실제 잠재력은 25세까지 조금씩 오르내리고 21세와 24세 재평가 때 반영됩니다. 모든 선수에게 같은 규칙입니다.</p><p><b>스토리·특별 이벤트</b> 스포일러를 막기 위해 한 번 겪어야 확률 도감에 열립니다. 확률 규칙은 다른 이벤트와 같습니다.</p></section><p><a href="/">게임 시작</a></p><nav><a href="/">홈</a> · <a href="/guide/">게임 가이드</a> · <a href="/faq/">자주 묻는 질문</a></nav></div>`;
const termsBody = `<div class="os-screen"><header><p class="os-eyebrow">LEGAL</p><h1>이용약관</h1><p>시행일: 2026년 10월 9일</p></header><section class="os-panel"><h2>1. 서비스</h2><p>오프사이드(풀타임)는 웹 브라우저와 iOS·Android 앱에서 이용하는 무료 축구 커리어 스토리 시뮬레이션 게임입니다. 플레이 중인 세이브(게임 진행) 자체는 이용자의 기기(브라우저·앱 저장소)에만 저장됩니다. 다만 커리어·시즌 요약 기록과 플레이 중 선택 기록은 익명 프로필 단위로 서버(Cloudflare D1)에도 저장되어 서비스 개선과 밸런스 분석에 쓰입니다. 은퇴한 선수의 커리어 기록은 명예의 전당에서 모든 이용자에게 공개됩니다. ${NAME_POLICY} 자세한 내용은 개인정보처리방침을 따릅니다. 앱의 '광고 제거'는 한 번 사면 계속 쓰는 유료 인앱 상품입니다. 앱에서 파는 리롤권·잠재력 강화권 묶음은 로그인한 구단주 계정에 들어오는 소모성 유료 인앱 상품으로, 쓰면 없어지고 다른 계정으로 옮길 수 없습니다. 결제와 환불은 App Store·Google Play 정책을 따르며, 환불된 구매로 받은 아이템은 회수할 수 있습니다.</p></section><section class="os-panel"><h2>2. 계정</h2><p>게임은 로그인 없이 바로 이용할 수 있습니다. 구글 계정(iOS 앱은 Apple 계정도)을 연결하면 로그인 상태만 서버에 남고, 게임 진행 데이터는 여전히 이용자의 기기에만 남습니다.</p></section><section class="os-panel"><h2>3. 이용자의 의무</h2><p>서비스를 부정한 목적으로 이용하거나 타인의 계정을 도용해서는 안 됩니다.</p><p>댓글, 라운지 채팅 메시지, 공개한 선수 이름, 구단 이름·감독 이름 등 이용자가 올리는 글에 욕설·비방·차별, 음란하거나 불쾌한 내용, 광고·스팸, 타인의 개인정보를 담아서는 안 됩니다. 오프사이드는 이런 내용과 이를 올리는 이용자를 용인하지 않으며, 발견하거나 신고를 받으면 해당 글을 지우거나 이름을 가리고, 댓글·채팅 작성 등 서비스 이용을 제한할 수 있습니다.</p><p>이용자는 댓글마다 있는 신고 버튼으로 부적절한 댓글을 신고하고, 작성자를 차단해 그 사람의 댓글을 보지 않을 수 있습니다. 라운지 채팅에서도 메시지마다 있는 메뉴(⋯)로 신고하고 작성자를 차단할 수 있으며, 여러 이용자가 신고한 메시지는 운영자 확인 전에도 자동으로 가려집니다. 명예의 전당 선수 상세와 팀 프로필의 이름 신고 버튼으로 부적절한 이름도 신고할 수 있습니다. 신고는 운영자가 24시간 안에 확인해 조치합니다.</p></section><section class="os-panel"><h2>4. 서비스 변경·중단</h2><p>운영상·기술상 필요에 따라 서비스 내용이 변경되거나 중단될 수 있으며, 이 경우 합리적인 방법으로 안내합니다. 게임 데이터가 기기에만 저장되는 특성상, 서비스 중단이 곧바로 이용자의 진행 데이터 손실로 이어지지는 않습니다(단, 브라우저 저장소 삭제·기기 변경 시에는 데이터가 사라질 수 있습니다).</p></section><section class="os-panel"><h2>5. 면책</h2><p>본 서비스는 현 상태(AS-IS)로 제공되며, 게임 결과나 확률적 연출로 인한 손해에 대해 책임지지 않습니다.</p></section><section class="os-panel"><h2>6. 문의</h2><p><a href="mailto:contact@offside-lab.com">contact@offside-lab.com</a></p></section><nav><a href="/">홈</a> · <a href="/legal/privacy/">개인정보처리방침</a></nav></div>`;
const privacyBody = `<div class="os-screen"><header><p class="os-eyebrow">LEGAL</p><h1>개인정보처리방침</h1><p>시행일: 2026년 10월 9일</p></header><section class="os-panel"><h2>1. 수집하는 정보</h2><p>게임은 로그인 없이 이용할 수 있습니다. 로그인·공개 기록·선택적 이용 분석에서 처리하는 정보는 아래와 같습니다. 구글 계정으로 로그인하는 경우에만 구글이 제공하는 고유 식별자(sub)와 이메일 주소를 수집합니다. iOS 앱에서 Apple로 로그인하는 경우에는 Apple이 제공하는 고유 식별자(sub)만 저장하며 이메일은 저장하지 않습니다. 플레이 중인 세이브(선수 능력치, 진행 중인 시즌 등) 자체는 서버로 전송되지 않고 이용자의 브라우저(앱은 기기 저장소)에만 저장됩니다. 그와 별개로, 커리어·시즌 요약 기록(포지션·소속·기록·수상 등)과 플레이 중 선택 기록은 서비스 개선과 밸런스 분석을 위해 로그인 여부와 관계없이 익명 프로필 단위로 서버(Cloudflare D1)에 저장됩니다. 은퇴한 선수의 커리어 기록(레전드 점수·시즌별 기록·수상·등번호·포지션)은 명예의 전당에서 모든 이용자에게 공개됩니다. ${NAME_POLICY} 이름은 공개하는 동안에만 서버에 저장되며, 설정을 끄면 다음 시즌 기록부터 익명으로 올라갑니다. 은퇴한 선수는 은퇴 화면과 내 선수 상세에서 언제든 익명으로 되돌릴 수 있습니다. 댓글·이름을 신고하거나 작성자를 차단하면 그 기록(신고한 댓글·사유, 신고한 이름, 차단한 작성자)이 익명 프로필 단위로 저장되며, 계정을 삭제하면 함께 삭제됩니다. 라운지 채팅에 보낸 메시지(닉네임·내용·보낸 시각)는 채팅 서버(Cloudflare Durable Objects)에 보관되어 모든 이용자에게 보이며, 채팅 메시지를 신고하면 운영자 확인을 위해 그 메시지의 사본(작성자 닉네임·내용)과 신고 사유가 함께 저장됩니다.</p></section><section class="os-panel"><h2>2. 자동 수집 정보</h2><p>서비스 운영과 보안을 위해 접속 세션 정보와 요청 로그(접속 시각, IP, 오류 로그 등)를 일정 기간 보관합니다.</p></section><section class="os-panel"><h2>3. 이용 목적</h2><p>로그인 상태 유지, 계정 연동·해제, 부정 이용 방지, 서비스 안정성 확보와 위에서 설명한 서비스 개선·밸런스 분석에 이용합니다. 선택적 Google Analytics 분석은 동의한 경우에만 수행합니다.</p></section><section class="os-panel"><h2>4. 제3자 제공 및 국외 이전</h2><p>서비스는 Cloudflare(호스팅·인프라), Google(로그인, 동의한 경우 이용 분석, 광고), Apple(iOS 앱 로그인)을 이용하며, 이 과정에서 위 정보가 해당 사업자의 해외 서버로 이전되어 처리될 수 있습니다.</p></section><section class="os-panel"><h2>5. 보유 기간</h2><p>계정 정보와 커리어·시즌 요약·선택 기록은 이용자가 계정 삭제를 요청할 때까지 보관하며, 요청 시 지체 없이 함께 삭제합니다. 라운지 채팅 메시지는 보낸 지 7일, 채팅 신고 기록은 90일이 지나면 자동으로 삭제하고, 채팅 정지 기록은 정지 기간이 끝나면 삭제합니다(계정을 삭제하면 채팅 신고·정지 기록은 바로 삭제되고, 이미 보낸 메시지는 7일 보관 기간이 끝날 때 삭제됩니다). 플레이 중인 세이브는 이용자의 브라우저(앱은 기기)에만 있으므로, 브라우저 저장소를 지우거나 앱을 삭제하면 즉시 삭제됩니다.</p></section><section class="os-panel"><h2>6. 이용자의 권리</h2><p>웹과 앱의 설정·계정 화면에서 언제든 구글 계정 연동 해제, 로그아웃, 계정 삭제를 요청할 수 있습니다. 계정 삭제는 확인 절차를 거쳐 처리됩니다.</p></section><section class="os-panel" id="analytics"><h2>7. 선택적 이용 분석 (Google Analytics)</h2><p>게임 개선과 유입 경로·플레이 지속률 분석을 위해, 이용자가 분석에 동의한 경우에만 웹에서는 Google Analytics 4 태그를, 앱에서는 Google Analytics for Firebase를 사용합니다. 동의 전과 거절한 경우에는 분석 요청을 보내지 않으며, 앱은 동의 전 활동을 나중에 몰아 보내지도 않습니다. 거절해도 게임 이용에는 불이익이 없습니다.</p><p>Google LLC는 쿠키 기반 브라우저 식별자, 방문 시각·기기·브라우저 정보, 허용된 유입 경로와 캠페인, 정규화한 화면 이동, 커리어 시작·첫 시즌 완료·은퇴·공유 버튼 시도 및 링크 복사 성공 정보를 해외 서버에서 처리합니다. 앱에서는 브라우저 쿠키 대신 앱 설치마다 만들어지는 분석용 식별자(앱 인스턴스 ID)와 세션·기기 모델·운영체제·앱 버전·대략적인 지역 같은 Firebase 표준 정보, 그리고 게임 화면 이동과 커리어 시작·첫 진행·첫 시즌 완료·시즌 진행 단계·이어하기·은퇴 정보를 처리합니다. 앱 이용 분석에는 광고 식별자(IDFA·Android 광고 ID)를 사용하지 않습니다. 앱에 표시되는 광고가 쓰는 정보는 8항에서 따로 안내합니다. 선수 이름·닉네임·이메일·계정 및 커리어 ID·인증 정보·입력한 자유 텍스트는 분석 이벤트에 포함하지 않으며, 원본 주소의 식별자·검색어·해시를 제거합니다. 이용 분석에는 광고 연동·Google Signals·User-ID를 사용하지 않습니다.</p><p>GA4의 사용자·이벤트 데이터 보관 기간은 2개월로 설정합니다. 집계 보고서는 이 기간과 다르게 보관될 수 있습니다. 이 브라우저의 분석 쿠키는 최대 60일, 이벤트 중복 방지 기록(웹·앱)은 최근 30일·최대 200개 커리어와 현재 커리어만 보관합니다. 분석 기록은 게임 세이브와 분리합니다.</p><p>웹은 환경설정의 이용 분석 선택에서, 앱은 설정의 '앱 이용 분석 동의 (선택)'에서 언제든 동의를 철회할 수 있습니다. 철회하면 이후 수집을 중단하고 웹은 이 브라우저의 분석용 쿠키와 중복 방지 기록을, 앱은 기기의 분석 데이터(앱 인스턴스 ID 포함)와 중복 방지 기록을 삭제합니다. 이미 전송된 정보가 자동 삭제되는 것은 아니며, 관련 문의는 아래 연락처로 할 수 있습니다. Google의 처리 방식은 <a href="https://policies.google.com/privacy">Google 개인정보처리방침</a>에서 확인할 수 있습니다.</p></section><section class="os-panel" id="ads"><h2>8. 광고 (Google AdSense · AdMob)</h2><p>기록실·소식·선수 상세처럼 읽는 화면의 맨 아래에 광고를 보여 줄 수 있습니다. 웹은 Google AdSense, iOS·Android 앱은 Google AdMob을 씁니다. 게임을 조작하는 화면에는 광고를 두지 않으며, 광고를 보지 않아도 게임 이용에 불이익이 없습니다.</p><p>광고를 보여 주기 위해 Google LLC가 웹에서는 쿠키 등으로 브라우저 정보와 방문한 페이지 주소를, 앱에서는 기기 광고 식별자와 앱 정보를, 그리고 기기 정보와 IP 주소를 해외 서버에서 처리합니다. 서비스는 관심사에 따른 맞춤 광고를 요청하지 않고 비개인화 광고만 요청합니다. 비개인화 광고도 빈도 제한·부정 클릭 방지·집계 보고를 위해 쿠키나 광고 식별자를 사용할 수 있습니다. iOS 앱은 앱 추적 동의를 요청하지 않습니다. 유럽경제지역·영국·스위스의 앱 이용자에게는 광고를 요청하기 전에 Google 동의 메시지를 보여 주며, 동의하지 않아도 게임은 그대로 이용할 수 있습니다. 앱에서는 광고를 영구히 끄는 '광고 제거'를 인앱 결제로 살 수 있습니다. 결제는 Apple·Google이 처리하며, 서비스는 결제 정보를 받지 않고 구매 여부만 기기에서 확인합니다. 리롤권·잠재력 강화권 묶음을 사면 아이템을 한 번만 주기 위해 스토어가 준 거래 식별자, 상품, 구매 시각, 테스트 구매 여부를 구단주 프로필에 연결해 서버(Cloudflare D1)에 보관하고, 계정을 삭제하면 함께 삭제합니다. 구매를 확인하려고 Apple이 서명한 거래 정보를 서버에서 검증하고, Google Play 구매는 Google Play Developer API로 Google에 확인합니다. 선수 이름·닉네임·이메일·계정 및 커리어 정보는 광고에 전달하지 않습니다.</p><p>Google의 광고 쿠키 사용과 맞춤 광고 설정은 <a href="https://policies.google.com/technologies/ads">Google 광고 정책</a>과 <a href="https://adssettings.google.com">Google 광고 설정</a>에서 확인하고 바꿀 수 있습니다. 브라우저 설정에서 쿠키를 차단하거나 기기 설정에서 광고 식별자를 재설정·삭제해도 게임은 그대로 이용할 수 있습니다.</p></section><section class="os-panel" id="push"><h2>9. 선택적 앱 알림과 알림함</h2><p>iOS·Android 앱에서 알림 받기를 선택하고 기기 권한을 허용한 경우에만 수신 기기를 등록합니다. 알림 연결에는 기기별 설치 식별자의 해시, 푸시 토큰, 연결된 프로필·세션, 운영체제 종류, 앱 버전, 마지막 등록 시각을 사용합니다. 게임 진행·선수 이름·이메일을 푸시 내용에 넣지 않습니다. 설치 식별자 원본은 기기 보안 저장소에만 보관합니다.</p><p>푸시 토큰과 알림 내용은 Expo Push Service를 거쳐 Apple APNs 또는 Google FCM으로 전송되어 해당 사업자의 해외 서버에서 처리될 수 있습니다. 새 공지·릴리즈 노트는 게시판마다 한국 시간 하루 한 번 보내며, 알림을 켠 이용자는 본인 기기의 연결 테스트를 10분에 한 번·하루 3회까지 요청할 수 있습니다. 앱 알림을 켠 기기에는 마지막 등록 갱신 시각을 참고해 7일 이상 미방문한 이용자에게 오전 9시부터 오후 8시 사이에 안내합니다. <a href="https://expo.dev/privacy">Expo 개인정보처리방침</a>을 확인할 수 있습니다.</p><p>앱 설정에서 알림을 끄면 서버의 기기 등록을 해제합니다. 연결이 끊겨 해제가 실패하면 기기에서 해제 대기를 보관하고 다음 연결 때 다시 처리합니다. 서버의 등록 정보는 마지막 등록에서 90일이 지나면 정기 정리 때 삭제합니다. 폐기·만료된 세션이나 삭제된 프로필에는 새 알림을 보내지 않습니다. 알림함은 프로필별 알림 내용·관련 화면·생성 시각과 읽음 시각을 서버에 90일간 보관하고, 기간이 지나면 정기 정리 때 삭제합니다. 계정을 삭제하면 알림함과 발송 기록도 함께 삭제합니다. 발송 큐는 만료 30일 뒤 정리하며 종료한 큐의 푸시 토큰은 비웁니다. 알림 수신을 끄더라도 알림함 기록은 보관 기간 동안 남습니다. 서비스 운영과 알림 개선을 위해 발송 접수·전달 확인·실패·취소 결과, 앱 알림을 누른 시각과 연결 화면으로 이동한 시각을 해당 알림의 익명 프로필 기록에 연결하여 서버(Cloudflare D1)에 90일간 보관합니다. 알림함 열람은 푸시 클릭으로 집계하지 않으며, 계정을 삭제하면 이 기록도 함께 삭제합니다. 이 운영 기록은 Google Analytics로 전송하지 않습니다. 알림을 받지 않아도 게임을 이용할 수 있습니다.</p></section><section class="os-panel"><h2>10. 문의</h2><p>개인정보 관련 문의는 <a href="mailto:contact@offside-lab.com">contact@offside-lab.com</a>으로 연락해 주세요.</p></section><nav><a href="/">홈</a> · <a href="/legal/terms/">이용약관</a></nav></div>`;

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
const STATIC_PAGES = {
  '/guide/': guideBody,
  '/faq/': faqBody,
  '/fairness/': fairnessBody,
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
