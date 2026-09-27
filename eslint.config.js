import { base, svelteConfig, typedConfig } from '@offside/eslint-config';

// 워크스페이스(web/api/contracts) 경계는 표준 no-restricted-imports로 직접 적는다(ADR-013).
export default [
  ...base,
  // T-10-001: apps/web UI가 Svelte 5(runes)로 옮겨오며 .svelte 파일에도 린트를 켠다.
  ...svelteConfig(['apps/web/src/**/*.svelte']),
  ...typedConfig(
    [
      'apps/*/src/**/*.ts',
      'apps/web/e2e/**/*.ts',
      'packages/contracts/src/**/*.ts',
      'tooling/fulltime-sim/*.ts',
    ],
    import.meta.dirname,
  ),
  {
    // 클라이언트 전용 web은 서버(api) 코드를 직접 import하지 않는다 — 둘은 별도 Cloudflare Worker다.
    // T-10-076 영구결번 판정 규칙(기준 점수·가중치)은 서버만 안다 — 웹 번들에 들어가면 누구나 읽는다(테스트는 예외).
    files: ['apps/web/src/**/*.ts', 'apps/web/src/**/*.svelte'],
    ignores: ['apps/web/src/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@offside/api', '@offside/api/*', '**/apps/api/*'],
              message: 'apps/web은 apps/api를 import할 수 없다(별도 Worker).',
            },
            {
              group: ['@offside/contracts/retired-numbers'],
              message: '영구결번 판정 규칙은 서버 전용이다(기준값이 웹 번들에 노출된다).',
            },
          ],
        },
      ],
    },
  },
  {
    // 공유 계약 패키지는 어느 app에도 의존하지 않는다(의존 방향은 web/api -> contracts만 허용).
    files: ['packages/contracts/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@offside/web',
                '@offside/web/*',
                '@offside/api',
                '@offside/api/*',
                '**/apps/*',
              ],
              message: 'packages/contracts는 apps/web·apps/api를 import할 수 없다.',
            },
          ],
        },
      ],
    },
  },
];
