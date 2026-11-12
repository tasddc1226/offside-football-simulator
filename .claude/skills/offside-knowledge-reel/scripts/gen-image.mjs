// 사용: GCP_PROJECT=<프로젝트> node gen-image.mjs <out.png> "<prompt>" [ref.png ...]
// Vertex AI gemini-2.5-flash-image, 9:16. 참조 이미지를 주면 화풍 · 색을 맞춘다.
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const [out, prompt, ...refs] = process.argv.slice(2);
const project = process.env.GCP_PROJECT;
if (!out || !prompt || !project) {
  console.error('usage: GCP_PROJECT=<id> node gen-image.mjs <out.png> "<prompt>" [ref.png ...]');
  process.exit(2);
}
const token = execSync('gcloud auth print-access-token').toString().trim();
const parts = [
  ...refs.map((f) => ({
    inlineData: { mimeType: 'image/png', data: fs.readFileSync(f).toString('base64') },
  })),
  { text: prompt },
];
const url = `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/gemini-2.5-flash-image:generateContent`;
const r = await fetch(url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '9:16' } },
  }),
});
const j = await r.json();
const img = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
if (!img) {
  // 429(RESOURCE_EXHAUSTED)는 1~2분 뒤 다시 시도한다.
  console.error(JSON.stringify(j).slice(0, 400));
  process.exit(1);
}
fs.writeFileSync(out, Buffer.from(img, 'base64'));
console.log('ok', out);
