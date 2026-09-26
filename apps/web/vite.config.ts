import { defineConfig, loadEnv, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { appShellPlugin } from './scripts/app-shell.mjs';
import { resolveSeoConfig, seoPlugin } from './scripts/seo.mjs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const seoConfig = resolveSeoConfig({
    mode,
    publicSiteUrl: env.VITE_PUBLIC_SITE_URL,
    enableSearchIndexing: env.VITE_ENABLE_SEARCH_INDEXING,
  });

  // T-9-009: 플레이 데이터에 어느 배포에서 온 기록인지 남긴다. CI에서는 커밋 SHA, 로컬은 'dev'.
  const version = (process.env.GITHUB_SHA ?? 'dev').slice(0, 7);
  // T-10-023: 열려 있던 탭이 새 배포를 알아챌 수 있게 같은 값을 dist/version.json으로도 내보낸다.
  const versionJson: Plugin = {
    name: 'offside-version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version }),
      });
    },
  };

  const define = { __APP_VERSION__: JSON.stringify(version) };
  return {
    plugins: [svelte(), appShellPlugin({ define }), seoPlugin(seoConfig), versionJson],
    define,
  };
});
