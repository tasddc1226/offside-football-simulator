import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // wrangler는 roles/*.md를 문자열 모듈로 묶는다(wrangler.jsonc rules). 테스트에서도 같게 읽는다.
  plugins: [
    {
      name: 'md-text',
      transform: (code, id) =>
        id.endsWith('.md') ? `export default ${JSON.stringify(code)};` : undefined,
    },
  ],
  resolve: {
    alias: {
      'cloudflare:workers': fileURLToPath(
        new URL('./src/test/cloudflare-workers.ts', import.meta.url),
      ),
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
