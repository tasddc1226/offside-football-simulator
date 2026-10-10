import { base, svelteConfig, typedConfig } from '@offside/eslint-config';

// 워크스페이스(web/api/contracts) 경계는 표준 no-restricted-imports로 직접 적는다(ADR-013).
export default [
  ...base,
  // T-11-004 Expo가 만드는 네이티브 폴더·캐시(깃에도 없다). T-11-159 Expo 설정 플러그인은 app.config.js처럼 CommonJS다.
  {
    ignores: [
      'apps/mobile/ios/**',
      'apps/mobile/android/**',
      'apps/mobile/.expo/**',
      'apps/mobile/plugins/**',
    ],
  },
  // T-10-001: apps/web UI가 Svelte 5(runes)로 옮겨오며 .svelte 파일에도 린트를 켠다.
  ...svelteConfig(['apps/web/src/**/*.svelte']),
  ...typedConfig(
    [
      'apps/*/src/**/*.ts',
      'apps/web/e2e/**/*.ts',
      'apps/mobile/src/**/*.tsx',
      'packages/contracts/src/**/*.ts',
      'packages/game/src/**/*.ts',
      'packages/app-core/src/**/*.ts',
      'tooling/fulltime-sim/*.ts',
    ],
    import.meta.dirname,
  ),
  {
    // 클라이언트 전용 web은 서버(api) 코드를 직접 import하지 않는다 — 둘은 별도 Cloudflare Worker다.
    // T-10-076 영구결번 판정 규칙(기준 점수)은 서버만 안다 — 웹 번들에 들어가면 누구나 읽는다.
    files: [
      'apps/web/src/**/*.ts',
      'apps/web/src/**/*.svelte',
      'apps/mobile/src/**/*.ts',
      'apps/mobile/src/**/*.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@offside/api', '@offside/api/*', '**/apps/api/*'],
              message: '클라이언트(web·mobile)는 apps/api를 import할 수 없다(별도 Worker).',
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
  {
    // T-11-001 게임 엔진·T-11-002 클라이언트 공용 층은 웹·앱이 함께 쓴다 — 어느 앱에도, 화면 프레임워크에도 기대지 않는다.
    files: ['packages/game/src/**/*.ts', 'packages/app-core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@offside/web',
                '@offside/web/*',
                '@offside/mobile',
                '@offside/mobile/*',
                '**/apps/*',
              ],
              message: '공용 패키지(game·app-core)는 앱 코드를 import할 수 없다.',
            },
            {
              group: ['svelte', 'svelte/*', 'react', 'react-native'],
              message: '공용 패키지는 화면 프레임워크를 모른다.',
            },
          ],
        },
      ],
    },
  },
];
