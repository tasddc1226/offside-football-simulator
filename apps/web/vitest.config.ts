import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 유닛 테스트는 웹 쪽 순수 TS(src/**)만 다룬다(게임 엔진 테스트는 packages/game) — DOM 렌더링(ui.ts)은 Playwright e2e가
    // 커버하므로 jsdom 의존성을 새로 추가하지 않고 node 환경만 쓴다.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
