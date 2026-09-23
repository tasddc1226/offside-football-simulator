import { base } from '@offside/eslint-config';

// 워크스페이스(web/api/contracts) 경계는 표준 no-restricted-imports로 직접 적는다(ADR-013).
export default [
  ...base,
  {
    // 클라이언트 전용 web은 서버(api) 코드를 직접 import하지 않는다 — 둘은 별도 Cloudflare Worker다.
    files: ['apps/web/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@offside/api', '@offside/api/*', '**/apps/api/*'],
              message: 'apps/web은 apps/api를 import할 수 없다(별도 Worker).',
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
              group: ['@offside/web', '@offside/web/*', '@offside/api', '@offside/api/*', '**/apps/*'],
              message: 'packages/contracts는 apps/web·apps/api를 import할 수 없다.',
            },
          ],
        },
      ],
    },
  },
];
