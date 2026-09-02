import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: 'src/routes',
      generatedRouteTree: 'src/routeTree.gen.ts',
    }),
    react(),
    tailwindcss(),
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
});
