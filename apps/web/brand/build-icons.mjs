// T-11-073 시즌 1 새 아이콘(v7). 기울어진 OFF를 빨간 오프사이드 라인이 가르고, 라인 오른쪽이 한 칸 앞서 있다.
// 배경에는 하얀 센터서클·하프라인을 깐다. 라이트(라임 배경)·다크(짙은 배경) 두 벌.
// 앱 아이콘·스플래시·배지 PNG는 여기서 만들어 커밋한다: `node apps/web/brand/build-icons.mjs`
// 웹 빌드(seo.mjs)는 brandSvg를 불러 파비콘·매니페스트·OG를 그때그때 만든다.
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const INK = '#0F2219';
const LIME = '#D6F24A';
const RED = '#E8412C';
const WHITE = '#FFFFFF';
export const BRAND_VERSION = 'v7';
// chalk = 센터서클·하프라인(하얀색)의 불투명도.
const THEMES = {
  light: { bg: LIME, mark: INK, chalk: 1 },
  dark: { bg: INK, mark: LIME, chalk: 0.22 },
};

const SKEW = 'translate(512 512) skewX(-12) translate(-512 -512)';
const O = (x, fill) =>
  `<rect x="${x + 40}" y="352" width="130" height="320" rx="65" fill="none" stroke="${fill}" stroke-width="80"/>`;
const F = (x, fill) =>
  `<path d="M${x} 312 H${x + 170} V390 H${x + 80} V474 H${x + 150} V548 H${x + 80} V712 H${x} Z" fill="${fill}"/>`;
const word = (fill) => O(206, fill) + F(446, fill) + F(646, fill);

/** OFF + 오프사이드 라인(1024 기준). */
function mark(fill, line = RED) {
  return (
    `<defs><clipPath id="ml"><rect width="536" height="1024"/></clipPath>` +
    `<clipPath id="mr"><rect x="560" width="464" height="1024"/></clipPath></defs>` +
    `<g transform="${SKEW}"><g clip-path="url(#ml)">${word(fill)}</g>` +
    `<g transform="translate(0 -64)"><g clip-path="url(#mr)">${word(fill)}</g></g>` +
    `<rect x="540" y="190" width="16" height="640" rx="8" fill="${line}"/></g>`
  );
}
/** 센터서클과 센터 스폿. 하프라인은 가장자리까지 가야 해서 따로 둔다. */
const circle = (t) =>
  `<g opacity="${t.chalk}"><circle cx="512" cy="512" r="300" fill="none" stroke="${WHITE}" stroke-width="18"/>` +
  `<circle cx="512" cy="512" r="22" fill="${WHITE}"/></g>`;
const halfway = (t) =>
  `<rect y="503" width="1024" height="18" fill="${WHITE}" opacity="${t.chalk}"/>`;
const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${body}</svg>`;

/**
 * 완성 아이콘. rounded=false면 모서리를 OS가 깎는 정사각형(iOS·maskable).
 * maskable은 배경·하프라인은 꽉 채우고 서클·글자만 artScale(0.8)로 줄여 안전 영역 안에 둔다(T-10-118).
 */
export function brandSvg(theme, { rounded = true, artScale = 1 } = {}) {
  const t = THEMES[theme];
  const art = `${circle(t)}${mark(t.mark)}`;
  const off = (512 * (1 - artScale)).toFixed(1);
  return svg(
    `<rect width="1024" height="1024"${rounded ? ' rx="224"' : ''} fill="${t.bg}"/>` +
      halfway(t) +
      (artScale === 1
        ? art
        : `<g transform="translate(${off} ${off}) scale(${artScale})">${art}</g>`),
  );
}

// 안드로이드 적응형 아이콘은 108dp 중 가운데 72dp만 보이므로 iOS와 같은 모양이 되게 0.66배로 줄인다.
const ADAPTIVE = 'translate(174 174) scale(0.66)';

async function png(markup, path, size = 1024) {
  await sharp(Buffer.from(markup)).resize(size, size).png().toFile(path);
}

async function main() {
  const images = new URL('../../mobile/assets/images/', import.meta.url);
  const at = (base, name) => fileURLToPath(new URL(name, base));
  const L = THEMES.light;
  const D = THEMES.dark;

  // iOS: 모서리는 OS가 깎으므로 꽉 찬 정사각형. 틴트 아이콘은 회색조 마크만 두고 색은 OS가 입힌다.
  await png(brandSvg('light', { rounded: false }), at(images, 'icon.png'));
  await png(brandSvg('dark', { rounded: false }), at(images, 'icon-dark.png'));
  await png(
    svg(`<rect width="1024" height="1024" fill="#000"/>${mark(WHITE, '#9A9A9A')}`),
    at(images, 'icon-tinted.png'),
  );

  // 안드로이드 적응형: 배경 층(라임·하프라인·서클) + 전경 층(글자·라인) + 테마 아이콘용 단색.
  await png(
    svg(
      `<rect width="1024" height="1024" fill="${L.bg}"/>${halfway(L)}<g transform="${ADAPTIVE}">${circle(L)}</g>`,
    ),
    at(images, 'android-icon-background.png'),
  );
  await png(
    svg(`<g transform="${ADAPTIVE}">${mark(L.mark)}</g>`),
    at(images, 'android-icon-foreground.png'),
  );
  await png(
    svg(`<g transform="${ADAPTIVE}">${mark(WHITE, WHITE)}</g>`),
    at(images, 'android-icon-monochrome.png'),
  );

  // 스플래시: 투명 배경의 마크만. 배경색은 app.json 플러그인 설정이 칠한다.
  await png(svg(mark(L.mark)), at(images, 'splash-icon.png'));
  await png(svg(mark(D.mark)), at(images, 'splash-icon-dark.png'));
  await png(brandSvg('light'), at(images, 'favicon.png'), 48);

  // 상단 브랜드 줄 배지(웹 Topbar.svelte·앱 Topbar.tsx). 웹 빌드는 seo.mjs가 다시 만들지만 dev 서버는 public을 쓴다.
  // public/brand의 v6 PNG는 AdSense 동의 메시지 로고가 가리키고 있어 지우지 않는다.
  const web = new URL('../public/brand/', import.meta.url);
  const app = new URL('../../mobile/assets/brand/', import.meta.url);
  await png(brandSvg('light'), at(web, `offside-icon-${BRAND_VERSION}-64.png`), 64);
  await png(brandSvg('dark'), at(web, `offside-icon-${BRAND_VERSION}-dark-64.png`), 64);
  await png(brandSvg('light'), at(app, `offside-icon-${BRAND_VERSION}-180.png`), 180);
  await png(brandSvg('dark'), at(app, `offside-icon-${BRAND_VERSION}-dark-180.png`), 180);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
