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

  // T-11-589 사업자 정보는 VITE_가 아닌 이름으로 받아 푸터에만 넣는다. VITE_로 두면 import.meta.env를 통째로 읽는 모듈(ads ·
  // analytics)에 값 전체가 실려 첫 화면 번들이 커진다.
  const define = {
    __APP_VERSION__: JSON.stringify(version),
    __BUSINESS_INFO__: JSON.stringify(process.env.BUSINESS_INFO ?? ''),
  };
  return {
    plugins: [svelte(), appShellPlugin({ define }), seoPlugin(seoConfig), versionJson],
    define,
    // Share gzip dictionaries across modules already required by the initial page.
    // $initial + no recursive capture preserves all existing lazy game screens/events.
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'initial',
                test: /./,
                tags: ['$initial'],
                includeDependenciesRecursively: false,
              },
            ],
          },
        },
      },
    },
  };
});
