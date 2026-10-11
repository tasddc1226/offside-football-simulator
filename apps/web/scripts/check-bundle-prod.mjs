#!/usr/bin/env node
// 운영 배포(deploy-production.yml)와 같은 모양의 공개 설정으로 빌드한 뒤 첫 화면 예산을 잰다(PR CI·전체 검증용).
// 분석·픽셀 설정이 없는 e2e용 빌드는 운영보다 ~0.1KB 작게 재져, PR은 통과하고 운영 배포의 번들 검사에서 멈춘 적이 있다(#618).
// 분석·픽셀 ID는 production 환경 변수라 PR CI에서 못 읽는다 — 번들 크기는 값이 아니라 설정 유무로 갈리므로 길이가 같은
// 가짜 값을 쓴다(실제 값과 0.01KB 이내). 운영에 새 VITE_ 설정을 더하면 여기도 함께 더한다.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRODUCTION_SHAPE = {
  VITE_PUBLIC_SITE_URL: 'https://offside-lab.com',
  VITE_ENABLE_SEARCH_INDEXING: 'true',
  VITE_API_BASE_URL: 'https://api.offside-lab.com',
  VITE_GA4_MEASUREMENT_ID: 'G-BUNDLE0000',
  VITE_GA4_HOSTNAME: 'offside-lab.com',
  VITE_META_PIXEL_ID: '000000000000000',
};
const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, ...PRODUCTION_SHAPE };
execFileSync('pnpm', ['run', 'build'], { cwd, env, stdio: 'inherit' });
execFileSync('node', ['scripts/check-bundle.mjs'], { cwd, env, stdio: 'inherit' });
