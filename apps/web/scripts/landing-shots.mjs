// 소개 페이지 스크린샷 변환. e2e/landing-shots.spec.ts가 찍은 landing-shots/<언어>/<화면>.png(540×1169)를
// public/landing/<언어>/<화면>.webp(540px) · <화면>-320.webp(320px)로 만든다. 한국어(ko)는 public/landing/ 바로 아래에 둔다.
// 사용: node scripts/landing-shots.mjs ja
import { mkdirSync, readdirSync } from 'node:fs';
import sharp from 'sharp';

const lang = process.argv[2];
if (!lang) throw new Error('언어를 주세요(예: ja)'); // i18n-ignore 개발 도구 메시지
const src = new URL(`../landing-shots/${lang}/`, import.meta.url);
const dest = new URL(`../public/landing/${lang === 'ko' ? '' : `${lang}/`}`, import.meta.url);
mkdirSync(dest, { recursive: true });
for (const file of readdirSync(src).filter((f) => f.endsWith('.png'))) {
  const key = file.replace(/\.png$/, '');
  const img = sharp(new URL(file, src).pathname);
  await img
    .clone()
    .resize({ width: 540 })
    .webp({ quality: 78 })
    .toFile(new URL(`${key}.webp`, dest).pathname);
  await img
    .clone()
    .resize({ width: 320 })
    .webp({ quality: 74 })
    .toFile(new URL(`${key}-320.webp`, dest).pathname);
  console.log(`${lang}/${key}`);
}
