import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'cloudflare:workers': fileURLToPath(
        new URL('./src/test/cloudflare-workers.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // 테스트마다 로컬 D1을 새로 만들고, 은퇴 테스트는 시즌을 먼저 올린다(조작 방어) — CI 러너에서 한 테스트가 5초를
    // 넘기기도 한다.
    testTimeout: 20_000,
  },
});
