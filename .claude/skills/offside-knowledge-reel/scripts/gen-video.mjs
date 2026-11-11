// 사용: GCP_PROJECT=<프로젝트> node gen-video.mjs <image.png> <out.mp4> "<움직임 프롬프트>"
// Vertex Veo 이미지 → 영상. 9:16, 4초, 1080p, 24fps, 소리 없음.
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const [img, out, prompt] = process.argv.slice(2);
const project = process.env.GCP_PROJECT;
if (!img || !out || !prompt || !project) {
  console.error('usage: GCP_PROJECT=<id> node gen-video.mjs <image.png> <out.mp4> "<prompt>"');
  process.exit(2);
}
const token = () => execSync('gcloud auth print-access-token').toString().trim();
const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });
const MODELS = [
  'veo-3.1-fast-generate-001',
  'veo-3.1-fast-generate-preview',
  'veo-3.0-fast-generate-001',
];
const base = (m) =>
  `https://us-central1-aiplatform.googleapis.com/v1/projects/${project}/locations/us-central1/publishers/google/models/${m}`;

let model, op;
for (const m of MODELS) {
  const r = await fetch(`${base(m)}:predictLongRunning`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      instances: [
        {
          prompt,
          image: {
            bytesBase64Encoded: fs.readFileSync(img).toString('base64'),
            mimeType: 'image/png',
          },
        },
      ],
      parameters: {
        aspectRatio: '9:16',
        durationSeconds: 4,
        resolution: '1080p',
        generateAudio: false,
        sampleCount: 1,
      },
    }),
  });
  const j = await r.json();
  if (j.name) {
    model = m;
    op = j.name;
    break;
  }
  console.error(m, (j.error?.message || '').slice(0, 160));
}
if (!op) process.exit(1);
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 10000));
  const r = await fetch(`${base(model)}:fetchPredictOperation`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ operationName: op }),
  });
  const j = await r.json();
  if (!j.done) continue;
  const v = j.response?.videos?.[0]?.bytesBase64Encoded;
  if (!v) {
    console.error(JSON.stringify(j).slice(0, 400));
    process.exit(1);
  }
  fs.writeFileSync(out, Buffer.from(v, 'base64'));
  console.log('ok', model, out);
  process.exit(0);
}
console.error('timeout');
process.exit(1);
