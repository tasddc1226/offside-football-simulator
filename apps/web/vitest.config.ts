import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 유닛 테스트는 게임 로직(src/game/**)만 다룬다 — DOM 렌더링(ui.ts)은 Playwright e2e가
    // 커버하므로 jsdom 의존성을 새로 추가하지 않고 node 환경만 쓴다.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
