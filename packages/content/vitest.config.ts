import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'packs/**/*.test.ts'],
    // T-4-008: packs/0.3.0/reachability.test.ts는 seed 500 × 2시즌 실도메인 시뮬레이션을 돌려
    // 메모리를 많이 쓴다. 단독 실행(this package alone)에서는 항상 통과하지만, 전체
    // `pnpm test`(12개 패키지 turbo 병렬 실행) 아래에서는 이 패키지의 여러 테스트 파일이
    // 동시에 워커 스레드로 뜨며 다른 패키지(api·web)의 무거운 테스트와 메모리를 다퉈
    // vitest 프로세스가 조용히 죽는 사례를 재현 확인했다(스택트레이스 없이 ELIFECYCLE만 출력).
    // 파일 병렬 실행을 끄면 이 패키지 자체의 동시 워커 수가 줄어 피크 메모리가 낮아진다.
    fileParallelism: false,
  },
});
