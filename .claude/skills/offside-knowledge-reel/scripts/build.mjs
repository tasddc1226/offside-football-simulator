// 사용: node build.mjs <reel.json> <작업 폴더(스크래치)> <out.mp4>
// 장면 클립을 내레이션 시각에 맞춰 자르고 → 자막을 얹고 → 내레이션 · 배경 음악을 섞어 1080×1920 30fps mp4를 만든다.
// reel.json: { speed, tag, end, narration, bgm, bars: [초...], scenes: [{ clip, at, from? }], subs: [{ s, e, h }] }
//   시간(at · s · e · end · bars)은 모두 내레이션 원본(배속 전) 초. scenes는 at 오름차순.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const [cfgPath, work, out] = process.argv.slice(2);
if (!cfgPath || !work || !out) {
  console.error('usage: node build.mjs <reel.json> <work dir> <out.mp4>');
  process.exit(2);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = process.env.OFFSIDE_REPO || path.resolve(here, '../../../..'); // node_modules가 있는 체크아웃
const { chromium } = createRequire(path.join(repo, 'apps/web/package.json'))('@playwright/test');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const src = (p) => path.resolve(path.dirname(cfgPath), p);
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
const frame = (t) => Math.round((t / cfg.speed) * 30);
const total = frame(cfg.end + 1.3);
for (const d of ['seg', 'bg', 'comp']) fs.mkdirSync(path.join(work, d), { recursive: true });

// 1. 장면 자르기. 클립(4초)보다 길게 써야 하면 그만큼만 느리게 늘린다.
const list = [];
cfg.scenes.forEach((s, i) => {
  const n = (cfg.scenes[i + 1] ? frame(cfg.scenes[i + 1].at) : total) - frame(s.at);
  const from = s.from ?? 0;
  const slow = Math.max(1, (n / 30 + 0.05) / (4 - from));
  const seg = path.join(work, 'seg', `${String(i).padStart(2, '0')}.mp4`);
  ff([
    '-ss',
    String(from),
    '-i',
    src(s.clip),
    '-vf',
    `setpts=${slow}*PTS,fps=30,scale=1080:1920,eq=saturation=1.08:contrast=1.04`,
    '-frames:v',
    String(n),
    '-an',
    '-c:v',
    'libx264',
    '-crf',
    '14',
    '-pix_fmt',
    'yuv420p',
    seg,
  ]);
  list.push(`file '${seg}'`);
});
fs.writeFileSync(path.join(work, 'list.txt'), list.join('\n'));
ff([
  '-f',
  'concat',
  '-safe',
  '0',
  '-i',
  path.join(work, 'list.txt'),
  '-c',
  'copy',
  path.join(work, 'bg.mp4'),
]);
ff([
  '-i',
  path.join(work, 'bg.mp4'),
  '-start_number',
  '0',
  '-q:v',
  '2',
  path.join(work, 'bg', 'f_%05d.jpg'),
]);

// 2. 자막 · 진행 막대 합성
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 1,
});
await page.goto(`file://${here}/overlay.html`);
await page.evaluate((c) => window.init(c), cfg);
for (let i = 0; i < total; i++) {
  await page.evaluate(
    ([i, d]) => window.seekFrame(i, d),
    [i, 'file://' + path.resolve(work, 'bg')],
  );
  await page.screenshot({
    path: path.join(work, 'comp', `${String(i).padStart(5, '0')}.jpg`),
    type: 'jpeg',
    quality: 93,
  });
}
await browser.close();

// 3. 소리: 내레이션 배속 · -14 LUFS, 배경 음악은 내레이션이 나올 때 줄인다.
const dur = total / 30;
const vo = `[1:a]atempo=${cfg.speed},loudnorm=I=-14:TP=-1.5:LRA=11,apad`;
const audio = cfg.bgm
  ? `${vo},asplit[vo][sc];[2:a]volume=0.5[m];[m][sc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md];[vo][md]amix=inputs=2:normalize=0:duration=first,afade=t=out:st=${dur - 1.2}:d=1.2[a]`
  : `${vo}[a]`;
ff([
  '-framerate',
  '30',
  '-i',
  path.join(work, 'comp', '%05d.jpg'),
  '-i',
  src(cfg.narration),
  ...(cfg.bgm ? ['-stream_loop', '-1', '-i', src(cfg.bgm)] : []),
  '-filter_complex',
  audio,
  '-map',
  '0:v',
  '-map',
  '[a]',
  '-t',
  String(dur),
  '-c:v',
  'libx264',
  '-crf',
  '19',
  '-preset',
  'slow',
  '-pix_fmt',
  'yuv420p',
  '-c:a',
  'aac',
  '-b:a',
  '192k',
  '-movflags',
  '+faststart',
  out,
]);
console.log('ok', out, `${dur}s`, `${total} frames`);
