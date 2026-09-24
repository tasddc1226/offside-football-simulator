import { defineConfig, loadEnv } from 'vite';
import { resolveSeoConfig, seoPlugin } from './scripts/seo.mjs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const seoConfig = resolveSeoConfig({
    mode,
    publicSiteUrl: env.VITE_PUBLIC_SITE_URL,
    enableSearchIndexing: env.VITE_ENABLE_SEARCH_INDEXING,
  });

  return {
    plugins: [seoPlugin(seoConfig)],
    // T-9-009: 플레이 데이터에 어느 배포에서 온 기록인지 남긴다. CI에서는 커밋 SHA, 로컬은 'dev'.
    define: { __APP_VERSION__: JSON.stringify((process.env.GITHUB_SHA ?? 'dev').slice(0, 7)) },
  };
});
