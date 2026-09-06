import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { resolveSeoConfig, seoPlugin } from './scripts/seo.mjs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const seoConfig = resolveSeoConfig({
    mode,
    publicSiteUrl: env.VITE_PUBLIC_SITE_URL,
    enableSearchIndexing: env.VITE_ENABLE_SEARCH_INDEXING,
  });

  return {
    plugins: [
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        routesDirectory: 'src/routes',
        generatedRouteTree: 'src/routeTree.gen.ts',
      }),
      react(),
      tailwindcss(),
      seoPlugin(seoConfig),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes('node_modules') &&
              (/[\\/]react[\\/]/.test(id) ||
                /[\\/]react-dom[\\/]/.test(id) ||
                /[\\/]@tanstack[\\/]/.test(id))
            ) {
              return 'vendor';
            }
            return undefined;
          },
        },
      },
    },
  };
});
