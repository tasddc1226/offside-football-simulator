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
  };
});
