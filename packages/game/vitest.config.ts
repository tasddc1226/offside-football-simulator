import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // CI 러너는 모든 패키지 테스트를 한꺼번에 돌려서, 테스트 안의 첫 `await import('./season.js')`가 기본 5초를
    // 넘기기도 한다(T-11-274, 로컬 86ms · CI 13.4초). 코드 문제가 아니라 느린 모듈 로드라 여유를 둔다.
    testTimeout: 20_000,
  },
});
