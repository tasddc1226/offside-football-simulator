// T-11-004 앱 아이콘·스플래시를 웹 브랜드 원본(apps/web/brand)에서 만든다. 원본이 바뀌면 `node scripts/icons.mjs`.
// iOS 아이콘은 모서리 없는 정사각(시스템이 둥글린다), 안드로이드 적응형 아이콘은 전경(깃발)만 안전 영역 안에 둔다.
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const src = readFileSync(
  new URL('../../web/brand/offside-app-icon-fulltime-v6.svg', import.meta.url),
  'utf8',
);
const out = (name) => new URL(`../assets/images/${name}`, import.meta.url).pathname;
const png = (svg, size, name) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(out(name));

const square = src.replace('rx="112" ', '');
// 배경(그라운드)을 뺀 깃발·선만. 적응형 아이콘은 가운데 66%만 보이므로 0.66배로 줄여 가운데 둔다.
const body = src
  .replace(/<rect width="512" height="512"[^>]*\/>/, '')
  .replace(/<svg([^>]*)>/, '<svg$1><g transform="translate(87 87) scale(0.66)">')
  .replace('</svg>', '</g></svg>');
const mono = body
  .replace(/fill="#[0-9A-Fa-f]{6}"/g, 'fill="#FFFFFF"')
  .replace(/stroke="#[0-9A-Fa-f]{6}"/g, 'stroke="#FFFFFF"');

await png(square, 1024, 'icon.png');
await png(body, 1024, 'android-icon-foreground.png');
await png(mono, 1024, 'android-icon-monochrome.png');
await png(body, 512, 'splash-icon.png');
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#1c4a35' } })
  .png()
  .toFile(out('android-icon-background.png'));
await png(square, 64, 'favicon.png');
console.log('icons written');
